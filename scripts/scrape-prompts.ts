import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import child_process from 'node:child_process';
import os from 'node:os';
import https from 'node:https';
import * as cheerio from 'cheerio';
import OSS from 'ali-oss';

// Load environment variables from .env.local
async function loadLocalEnv() {
  const envPath = path.resolve('.env.local');
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separator = trimmed.indexOf('=');
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, '');
      process.env[key] ??= value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function getFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);
}

// Download thumbnail using native fetch, with a robust fallback to node:https
async function downloadThumbnail(url: string, destPath: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Fetch status ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
  } catch (fetchErr) {
    console.warn(`Native fetch failed for thumbnail, falling back to node:https:`, fetchErr);
    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTPS get status ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }

  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
    throw new Error('Downloaded thumbnail file is empty or does not exist');
  }
}

// Download HLS manifest and segments locally, then transcode using ffmpeg.
// This avoids TLS handshake errors that ffmpeg's OpenSSL stack experiences with Fastly CDN.
async function downloadAndTranscodeHLS(m3u8Url: string, destMp4Path: string, slug: string): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `hls-${slug}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 1. Fetch main manifest
    const mainRes = await fetch(m3u8Url);
    if (!mainRes.ok) throw new Error(`Failed to fetch main manifest: ${mainRes.statusText}`);
    const mainContent = await mainRes.text();

    // 2. Find the highest bandwidth rendition URL
    let renditionUrl = '';
    let maxBandwidth = 0;
    const lines = mainContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const match = /BANDWIDTH=(\d+)/.exec(line);
        const bandwidth = match ? parseInt(match[1], 10) : 0;
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('#') && bandwidth > maxBandwidth) {
          maxBandwidth = bandwidth;
          renditionUrl = new URL(nextLine, m3u8Url).toString();
        }
      }
    }

    // Fallback if no explicit bandwidth stream is found
    if (!renditionUrl) {
      const firstUri = lines.find(l => {
        const trimmed = l.trim();
        return trimmed && !trimmed.startsWith('#');
      });
      if (firstUri) renditionUrl = new URL(firstUri.trim(), m3u8Url).toString();
    }

    if (!renditionUrl) {
      throw new Error('Could not find rendition URL in main manifest');
    }

    // 3. Fetch rendition manifest
    const renditionRes = await fetch(renditionUrl);
    if (!renditionRes.ok) throw new Error(`Failed to fetch rendition manifest: ${renditionRes.statusText}`);
    const renditionContent = await renditionRes.text();

    // 4. Parse rendition and download chunks (supporting both relative and absolute URLs)
    const renditionLines = renditionContent.split('\n');
    const localRenditionLines: string[] = [];
    let chunkIndex = 0;

    for (const line of renditionLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const chunkFileName = `${chunkIndex}.ts`;
        const chunkPath = path.join(tempDir, chunkFileName);
        
        // Resolve absolute URL (handles both relative and absolute URLs)
        const chunkUrl = new URL(trimmed, renditionUrl).toString();
        
        // Download chunk using fetch
        const chunkRes = await fetch(chunkUrl);
        if (!chunkRes.ok) throw new Error(`Failed to fetch chunk ${chunkIndex} from ${chunkUrl}: ${chunkRes.statusText}`);
        fs.writeFileSync(chunkPath, Buffer.from(await chunkRes.arrayBuffer()));

        localRenditionLines.push(chunkFileName);
        chunkIndex++;
      } else {
        localRenditionLines.push(trimmed);
      }
    }

    // 5. Write local manifest
    const localM3u8Path = path.join(tempDir, 'local.m3u8');
    fs.writeFileSync(localM3u8Path, localRenditionLines.join('\n'), 'utf8');

    // 6. Run ffmpeg on local manifest with +faststart for progressive web playback
    child_process.execFileSync('ffmpeg', ['-y', '-i', localM3u8Path, '-c', 'copy', '-movflags', '+faststart', destMp4Path], { stdio: 'pipe' });
  } finally {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Probe video metadata (width, height, duration, fps) using ffprobe
function probeVideoMetadata(mp4Path: string): { aspectRatios: string[], durationFrames: number, fps: number } {
  try {
    const ffprobeOutput = child_process.execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,duration',
      '-of', 'json',
      mp4Path
    ], { encoding: 'utf8' });
    const data = JSON.parse(ffprobeOutput);
    const stream = data.streams?.[0];
    if (stream) {
      const width = parseInt(stream.width, 10);
      const height = parseInt(stream.height, 10);
      const duration = parseFloat(stream.duration);
      
      const fpsParts = stream.r_frame_rate.split('/');
      const fps = fpsParts.length === 2 ? Math.round(parseInt(fpsParts[0], 10) / parseInt(fpsParts[1], 10)) : 30;
      
      const durationFrames = Math.round(duration * fps);
      
      let aspect = '16:9';
      if (width === height) {
        aspect = '1:1';
      } else if (width < height) {
        aspect = '9:16';
      }
      
      return {
        aspectRatios: [aspect],
        durationFrames: durationFrames || 150,
        fps: fps || 30
      };
    }
  } catch (err) {
    console.warn(`Failed to probe video metadata for ${mp4Path}, using defaults:`, err);
  }
  return { aspectRatios: ['16:9'], durationFrames: 150, fps: 30 };
}

async function main() {
  await loadLocalEnv();

  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const overwrite = args.includes('--overwrite');
  
  const ossAccessKeyId = process.env.ASSETS_OSS_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID;
  const ossAccessKeySecret = process.env.ASSETS_OSS_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET;
  const ossRegion = process.env.ASSETS_OSS_REGION || process.env.OSS_REGION || 'oss-cn-shenzhen';
  const ossBucket = process.env.ASSETS_OSS_BUCKET || process.env.OSS_BUCKET || 'remotionhub';
  const ossPublicBaseUrl = process.env.ASSETS_OSS_PUBLIC_BASE_URL || process.env.OSS_PUBLIC_BASE_URL;
  
  const isDryRun = args.includes('--dry-run') || !ossAccessKeyId || !ossAccessKeySecret;

  if (isDryRun) {
    console.log('Running in DRY-RUN mode or missing OSS credentials. Media will be transcoded but not uploaded to Aliyun OSS.');
  } else {
    console.log(`OSS Credentials found. Running in upload mode targeting region: ${ossRegion}, bucket: ${ossBucket}.`);
  }

  const ossClient = !isDryRun
    ? new OSS({
        region: ossRegion,
        accessKeyId: ossAccessKeyId!,
        accessKeySecret: ossAccessKeySecret!,
        bucket: ossBucket,
        secure: true,
      })
    : null;

  console.log('Fetching prompt list pages...');
  const promptSlugs = new Set<string>();
  let page = 1;

  while (true) {
    const url = page === 1 ? 'https://www.remotion.dev/prompts' : `https://www.remotion.dev/prompts/${page}`;
    console.log(`Fetching ${url}...`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`Page ${page} returned status ${res.status}. Stopping page traversal.`);
        break;
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      let foundOnPage = 0;

      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/prompts/') && !/^\/prompts\/\d+$/.test(href)) {
          const slug = href.replace('/prompts/', '').replace(/\/$/, '');
          if (slug && !promptSlugs.has(slug)) {
            promptSlugs.add(slug);
            foundOnPage++;
          }
        }
      });

      console.log(`Found ${foundOnPage} new prompts on page ${page}.`);
      if (foundOnPage === 0) {
        break;
      }
      
      if (limit && promptSlugs.size >= limit) {
        break;
      }

      page++;
    } catch (err) {
      console.error(`Error fetching page ${page}:`, err);
      break;
    }
  }

  const slugsToProcess = Array.from(promptSlugs);
  console.log(`Total prompts discovered: ${slugsToProcess.length}`);

  const targetSlugs = limit ? slugsToProcess.slice(0, limit) : slugsToProcess;
  console.log(`Prompts to process: ${targetSlugs.length}`);

  for (const slug of targetSlugs) {
    let fullSlug = `prompt-${slug}`;
    if (fullSlug.length > 80) {
      const allowedLength = 80 - 'prompt-'.length; // 73
      // To prevent collision when truncating, append a 5-character hash of the original slug
      const hash = crypto.createHash('md5').update(slug).digest('hex').substring(0, 5);
      let truncated = slug.substring(0, allowedLength - 6); // 67
      if (truncated.endsWith('-')) {
        truncated = truncated.substring(0, truncated.length - 1);
      }
      fullSlug = `prompt-${truncated}-${hash}`;
    }
    const jsonPath = path.resolve(`catalog/components/${fullSlug}.json`);

    if (fs.existsSync(jsonPath) && !overwrite) {
      console.log(`[${slug}] Catalog file already exists at ${jsonPath}. Skipping.`);
      continue;
    }

    const detailUrl = `https://www.remotion.dev/prompts/${slug}`;
    console.log(`\nProcessing [${slug}] from ${detailUrl}...`);

    const tempMp4Path = path.join(os.tmpdir(), `${slug}.mp4`);
    const tempPngPath = path.join(os.tmpdir(), `${slug}.png`);

    try {
      const detailRes = await fetch(detailUrl);
      if (!detailRes.ok) {
        console.error(`Failed to fetch detail page for ${slug}: ${detailRes.status}`);
        continue;
      }

      const detailHtml = await detailRes.text();
      const $ = cheerio.load(detailHtml);

      const displayName = $('h1').first().text().trim();
      if (!displayName) {
        console.error(`Could not find title for ${slug}`);
        continue;
      }

      // Parse original author
      let authorHandle = 'remotionlab';
      const promptedByText = $('div:contains("Prompted by")').first();
      if (promptedByText.length > 0) {
        const link = promptedByText.find('a').first();
        if (link.length > 0) {
          const rawText = link.text().trim();
          authorHandle = rawText.startsWith('@') ? rawText.substring(1) : rawText;
          authorHandle = authorHandle
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 40);
          
          if (!authorHandle) {
            authorHandle = 'remotionlab';
          }
        }
      }

      const m3u8Url = $('video source[type="application/x-mpegurl"]').attr('src') || $('video source').attr('src');
      if (!m3u8Url) {
        console.error(`Could not find video source (.m3u8) for ${slug}`);
        continue;
      }

      let agentPrompt = '';
      $('h2').each((_, el) => {
        if ($(el).text().trim().toLowerCase() === 'prompt') {
          agentPrompt = $(el).next('pre').text().trim();
        }
      });
      if (!agentPrompt) {
        agentPrompt = $('pre').first().text().trim();
      }

      if (!agentPrompt) {
        console.error(`Could not find prompt text for ${slug}`);
        continue;
      }

      // 1. Transcode HLS to MP4 locally
      console.log(`Downloading and transcoding HLS to MP4: ${m3u8Url} -> ${tempMp4Path}`);
      try {
        await downloadAndTranscodeHLS(m3u8Url, tempMp4Path, slug);
      } catch (err) {
        console.error(`Transcoding failed for ${slug}:`, err);
        continue;
      }

      // Probe video metadata (duration, aspect ratio, fps) using ffprobe
      const videoMeta = probeVideoMetadata(tempMp4Path);

      // 2. Download thumbnail
      const ogImage = $('meta[property="og:image"]').attr('content');
      let thumbUrl = ogImage;
      if (!thumbUrl) {
        const match = m3u8Url.match(/stream\.mux\.com\/([^.]+)\.m3u8/);
        const playbackId = match ? match[1] : null;
        if (playbackId) {
          thumbUrl = `https://image.mux.com/${playbackId}/thumbnail.png?width=1200&height=630&fit_mode=smartcrop`;
        }
      }

      if (!thumbUrl) {
        console.error(`Could not find thumbnail URL for ${slug}`);
        continue;
      }

      console.log(`Downloading thumbnail: ${thumbUrl} -> ${tempPngPath}`);
      try {
        await downloadThumbnail(thumbUrl, tempPngPath);
      } catch (err) {
        console.error(`Failed to download thumbnail for ${slug}:`, err);
        continue;
      }

      // 3. Compute hashes
      const videoHash = getFileHash(tempMp4Path);
      const thumbHash = getFileHash(tempPngPath);

      // 4. Upload to OSS
      const ossVideoPath = `showcase/${fullSlug}/${videoHash}-preview.mp4`;
      const ossThumbPath = `showcase/${fullSlug}/${thumbHash}-thumb.png`;

      let previewVideoUrl = ossPublicBaseUrl
        ? `${ossPublicBaseUrl}/${ossVideoPath}`
        : `https://${ossBucket}.${ossRegion}.aliyuncs.com/${ossVideoPath}`;
      let thumbnailUrl = ossPublicBaseUrl
        ? `${ossPublicBaseUrl}/${ossThumbPath}`
        : `https://${ossBucket}.${ossRegion}.aliyuncs.com/${ossThumbPath}`;

      if (ossClient) {
        try {
          console.log(`Uploading MP4 to OSS: ${ossVideoPath}`);
          await ossClient.put(ossVideoPath, tempMp4Path);
          console.log(`Uploading Thumbnail to OSS: ${ossThumbPath}`);
          await ossClient.put(ossThumbPath, tempPngPath);
        } catch (err) {
          console.error(`OSS upload failed for ${slug}:`, err);
          continue;
        }
      } else {
        console.log(`[DRY-RUN] Would upload to OSS:`);
        console.log(`  - MP4 -> ${ossVideoPath}`);
        console.log(`  - Thumbnail -> ${ossThumbPath}`);
      }

      // 5. Generate catalog JSON file
      const catalogJson = {
        publisher: authorHandle,
        runtime: 'remotion',
        slug: fullSlug,
        displayName: displayName,
        displayNameZh: displayName,
        summary: `AI Video Prompt: ${displayName}`,
        summaryZh: `AI 视频提示词：${displayName}`,
        categories: ['prompt'],
        tags: ['remotion', 'prompt', 'ai'],
        status: 'published',
        versions: [
          {
            version: '1.0.0',
            changelog: 'Initial migrated release.',
            preview: {
              thumbnailUrl,
              previewVideoUrl,
              demoUrl: detailUrl,
            },
            metadata: {
              runtime: 'remotion',
              aspectRatios: videoMeta.aspectRatios,
              durationFrames: videoMeta.durationFrames,
              fps: videoMeta.fps,
            },
            tags: ['prompt', 'ai'],
            artifact: {
              kind: 'none',
              license: 'Custom (See Source)',
              usageMarkdown: '这是一个 AI 视频 Prompt 资产。你可以直接复制 **Agent 提示词** 选项卡中的内容，在本地使用支持 Remotion 技能的 AI 编码助手（如 Claude Code、Cursor 或 Codex）来一键生成视频源码。',
              agentPrompt: agentPrompt,
            },
          },
        ],
      };

      if (isDryRun) {
        console.log(`[DRY-RUN] Would write catalog JSON to ${jsonPath} but skipping in dry-run mode.`);
      } else {
        console.log(`Writing catalog JSON to ${jsonPath}...`);
        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, JSON.stringify(catalogJson, null, 2), 'utf8');
      }

      console.log(`Successfully processed [${slug}]`);
    } catch (err) {
      console.error(`Unexpected error processing ${slug}:`, err);
    } finally {
      // Resource Cleanup: Guarantee temp files are deleted
      if (fs.existsSync(tempMp4Path)) {
        try {
          fs.unlinkSync(tempMp4Path);
        } catch (cleanupErr) {
          console.warn(`Failed to clean up ${tempMp4Path}:`, cleanupErr);
        }
      }
      if (fs.existsSync(tempPngPath)) {
        try {
          fs.unlinkSync(tempPngPath);
        } catch (cleanupErr) {
          console.warn(`Failed to clean up ${tempPngPath}:`, cleanupErr);
        }
      }
    }
  }

  console.log('\nAll processing completed.');
}

main().catch((err) => {
  console.error('Fatal error in main:', err);
  process.exit(1);
});
