import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveAssetCommit } from './generate-catalog'

const createdDirs: string[] = []

async function makeGitRepo() {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-catalog-'))
  createdDirs.push(repo)

  execFileSync('git', ['init'], { cwd: repo })
  await fs.writeFile(path.join(repo, 'README.md'), 'test\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: repo })
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Test User',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'initial commit',
    ],
    { cwd: repo },
  )

  return repo
}

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0, createdDirs.length)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  )
})

describe('resolveAssetCommit', () => {
  it('resolves symbolic refs to immutable commit SHAs', async () => {
    const repo = await makeGitRepo()
    const expected = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()

    expect(resolveAssetCommit(repo, 'HEAD')).toBe(expected)
    expect(resolveAssetCommit(repo, 'HEAD')).toMatch(/^[0-9a-f]{40}$/)
  })

  it('rejects dirty asset repositories before resolving refs', async () => {
    const repo = await makeGitRepo()
    await fs.writeFile(path.join(repo, 'dirty.txt'), 'dirty\n', 'utf8')

    expect(() => resolveAssetCommit(repo, 'HEAD')).toThrow(
      /uncommitted changes/i,
    )
  })
})
