// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudioPage from './StudioPage'

type MockTemplate = {
  templateId: string
  templateVersion: string
  runtime: 'remotion'
  status: 'active'
  priority: number
  supportedAspectRatios: string[]
  supportedResolutions: Array<{ width: number; height: number }>
  fps: number
  propsSchemaVersion: string
  propsSchema: Record<string, unknown>
  agentPrompt: string
  tags: string[]
  previewStorageKey?: string
  licenseStatus: 'approved'
}

type MockJob = {
  id: string
  status: 'queued' | 'planning' | 'rendering' | 'completed' | 'failed' | 'canceled'
  prompt: string
  runtime: 'remotion'
  aspectRatio: string
  durationSeconds: number
  templateId: string
  templateVersion: string
  progress: number
  artifactId: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: number | null
  completedAt: number | null
  failedAt: number | null
  canceledAt: number | null
  createdAt: number
  updatedAt: number
}

function buildTemplates(): MockTemplate[] {
  return [
    {
      templateId: 'yt-simple-ai-product',
      templateVersion: '1.0.0',
      runtime: 'remotion',
      status: 'active',
      priority: 10,
      supportedAspectRatios: ['16:9'],
      supportedResolutions: [{ width: 1280, height: 720 }],
      fps: 30,
      propsSchemaVersion: '1',
      propsSchema: {},
      agentPrompt: 'Create a concise 16:9 product explainer using a clean SaaS launch style.',
      tags: ['product-demo', 'launch'],
      previewStorageKey: 'studio/templates/yt-simple-ai-product/preview.mp4',
      licenseStatus: 'approved',
    },
    {
      templateId: 'dashboard-story',
      templateVersion: '1.2.0',
      runtime: 'remotion',
      status: 'active',
      priority: 20,
      supportedAspectRatios: ['16:9'],
      supportedResolutions: [{ width: 1920, height: 1080 }],
      fps: 30,
      propsSchemaVersion: '1',
      propsSchema: {},
      agentPrompt: 'Tell the story of an analytics dashboard launch.',
      tags: ['dashboard'],
      previewStorageKey: undefined,
      licenseStatus: 'approved',
    },
  ]
}

function buildHistory(): MockJob[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `job-${index + 1}`,
    status: index === 0 ? 'completed' : index === 1 ? 'planning' : 'queued',
    prompt: `Prompt ${index + 1}`,
    runtime: 'remotion',
    aspectRatio: '16:9',
    durationSeconds: 15,
    templateId: index === 0 ? 'yt-simple-ai-product' : 'dashboard-story',
    templateVersion: '1.0.0',
    progress: index === 0 ? 100 : index === 1 ? 20 : 5,
    artifactId: index === 0 ? 'artifact-1' : null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: index === 0 ? 1_720_000_000_000 : null,
    failedAt: null,
    canceledAt: null,
    createdAt: 1_720_000_000_000 + index,
    updatedAt: 1_720_000_000_000 + index,
  }))
}

function buildCurrentJob(): MockJob {
  return {
    id: 'job-1',
    status: 'completed',
    prompt: 'Prompt 1',
    runtime: 'remotion',
    aspectRatio: '16:9',
    durationSeconds: 15,
    templateId: 'yt-simple-ai-product',
    templateVersion: '1.0.0',
    progress: 100,
    artifactId: 'artifact-1',
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: 1_720_000_000_100,
    failedAt: null,
    canceledAt: null,
    createdAt: 1_720_000_000_000,
    updatedAt: 1_720_000_000_100,
  }
}

const mocks = vi.hoisted(() => {
  const createGenerationJob = vi.fn()
  const cancelGenerationJob = vi.fn()

  return {
    createGenerationJob,
    cancelGenerationJob,
    randomUUID: vi.fn(() => 'uuid-task-7'),
    templates: buildTemplates(),
    history: buildHistory(),
    currentJob: buildCurrentJob() as MockJob | undefined,
    artifactAccess: {
      artifactId: 'artifact-1',
      jobId: 'job-1',
      playback: {
        url: 'https://cdn.example.com/playback.mp4',
        expiresAt: 1_720_000_000_500,
      },
      download: {
        url: 'https://cdn.example.com/download.mp4',
        expiresAt: 1_720_000_000_500,
      },
      thumbnail: {
        url: 'https://cdn.example.com/thumbnail.jpg',
        expiresAt: 1_720_000_000_500,
        source: 'artifact',
      },
      mimeType: 'video/mp4',
      fileSizeBytes: 1024,
      width: 1280,
      height: 720,
      fps: 30,
      durationSeconds: 15,
      aspectRatio: '16:9',
      runtime: 'remotion',
    },
    confirm: vi.fn(() => true),
  }
})

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    studio: {
      listStudioTemplates: 'listStudioTemplates',
      getMyStudioHistory: 'getMyStudioHistory',
      getGenerationJob: 'getGenerationJob',
      getGenerationArtifactAccess: 'getGenerationArtifactAccess',
      createGenerationJob: 'createGenerationJob',
      cancelGenerationJob: 'cancelGenerationJob',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (reference: string, args: unknown) => {
    if (reference === 'listStudioTemplates') {
      return mocks.templates
    }
    if (reference === 'getMyStudioHistory') {
      return mocks.history
    }
    if (reference === 'getGenerationJob') {
      return args === 'skip' ? undefined : mocks.currentJob
    }
    if (reference === 'getGenerationArtifactAccess') {
      return args === 'skip' ? undefined : mocks.artifactAccess
    }
    return undefined
  },
  useMutation: (reference: string) => {
    if (reference === 'createGenerationJob') {
      return mocks.createGenerationJob
    }
    if (reference === 'cancelGenerationJob') {
      return mocks.cancelGenerationJob
    }
    return vi.fn()
  },
}))

vi.mock('#/components/I18nProvider', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string | number>) => {
      const template =
        (
          {
            'studio.eyebrow': 'AI-first workbench',
            'studio.title': 'Prompt, pick a template, and ship one clean video.',
            'studio.description':
              'A minimal studio flow for prompt-first 16:9 Remotion product demos.',
            'studio.promptKicker': 'Prompt',
            'studio.promptTitle': 'Start from the creative brief',
            'studio.promptLabel': 'Prompt',
            'studio.promptPlaceholder':
              'Describe the product story, audience, and visual tone you want.',
            'studio.templateGate': 'Pick or confirm a template before generating.',
            'studio.templateSelected': 'Template: {template}',
            'studio.useRecommended': 'Use recommended template',
            'studio.generate': 'Generate video',
            'studio.generating': 'Creating job…',
            'studio.resultKicker': 'Result',
            'studio.resultTitle': 'Latest generation',
            'studio.statusLabel': 'Status',
            'studio.progressLabel': 'Progress',
            'studio.updatedLabel': 'Updated',
            'studio.templateLabel': 'Template',
            'studio.aspectLabel': 'Aspect',
            'studio.durationLabel': 'Duration',
            'studio.runtimeLabel': 'Runtime',
            'studio.fpsLabel': 'FPS',
            'studio.preview': 'Preview video',
            'studio.download': 'Download MP4',
            'studio.emptyResultTitle': 'No generation selected yet',
            'studio.emptyResultDescription':
              'Select a recent job or create a new prompt-first generation to see status here.',
            'studio.artifactPending':
              'The job completed, but the playback links are still being prepared.',
            'studio.cancel': 'Cancel job',
            'studio.canceling': 'Canceling…',
            'studio.cancelConfirmQueued':
              'Cancel this queued job? Credits should be refunded if work has not started.',
            'studio.cancelConfirmPlanning':
              'Cancel this planning job? Credits may not return after model start.',
            'studio.templatesKicker': 'Templates',
            'studio.templatesTitle': 'Choose a launch-ready frame',
            'studio.templatesEmptyTitle': 'No templates available',
            'studio.templatesEmptyDescription':
              'Seed an approved Remotion studio template to unlock generation.',
            'studio.recommended': 'Recommended',
            'studio.historyKicker': 'History',
            'studio.historyTitle': 'Recent jobs',
            'studio.historyEmpty': 'No jobs yet.',
            'studio.errorTitle': 'Studio request failed',
          } as Record<string, string>
        )[key] ?? key

      return Object.entries(values ?? {}).reduce(
        (result, [name, value]) =>
          result.replaceAll(`{${name}}`, String(value)),
        template,
      )
    },
  }),
}))

function renderStudioPage() {
  return render(<StudioPage />)
}

describe('StudioPage', () => {
  beforeEach(() => {
    mocks.templates = buildTemplates()
    mocks.history = buildHistory()
    mocks.currentJob = buildCurrentJob()
    mocks.createGenerationJob.mockReset().mockResolvedValue({
      id: 'job-created',
      status: 'queued',
    })
    mocks.cancelGenerationJob.mockReset().mockResolvedValue({
      ...mocks.currentJob,
      status: 'canceled',
    })
    mocks.randomUUID.mockReset().mockReturnValue('uuid-task-7')
    mocks.confirm.mockReset().mockReturnValue(true)

    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: mocks.confirm,
    })
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: mocks.randomUUID },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders templates and keeps mobile-first section order', () => {
    const { container } = renderStudioPage()
    const templateSection = screen
      .getByRole('heading', { name: 'Choose a launch-ready frame' })
      .closest('section')

    expect(templateSection).toBeTruthy()
    expect(
      within(templateSection as HTMLElement).getByRole('button', {
        name: /Yt Simple Ai Product/i,
      }),
    ).toBeTruthy()
    expect(
      within(templateSection as HTMLElement).getByRole('button', {
        name: /Dashboard Story/i,
      }),
    ).toBeTruthy()

    const sections = Array.from(
      container.querySelectorAll('[data-studio-section]'),
    ).map((node) => node.getAttribute('data-studio-section'))

    expect(sections).toEqual(['prompt', 'result', 'templates', 'history'])
  })

  it('injects the template agent prompt when a template is selected', async () => {
    renderStudioPage()
    const templateSection = screen
      .getByRole('heading', { name: 'Choose a launch-ready frame' })
      .closest('section')

    fireEvent.click(
      within(templateSection as HTMLElement).getByRole('button', {
        name: /Dashboard Story/i,
      }),
    )

    await waitFor(() => {
      expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).value).toBe(
        'Tell the story of an analytics dashboard launch.',
      )
    })
  })

  it('gates generation behind explicit template selection and sends an idempotency key', async () => {
    renderStudioPage()

    const generateButton = screen.getByRole('button', { name: 'Generate video' }) as HTMLButtonElement
    expect(generateButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended template' }))
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(mocks.createGenerationJob).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'uuid-task-7',
          templateId: 'yt-simple-ai-product',
          templateVersion: '1.0.0',
          aspectRatio: '16:9',
          durationSeconds: 15,
        }),
      )
    })
  })

  it('renders at most ten history items', () => {
    renderStudioPage()

    const historyList = screen.getByRole('list')
    expect(within(historyList).getAllByRole('button')).toHaveLength(10)
    expect(screen.queryByText('Prompt 11')).toBeNull()
    expect(screen.queryByText('Prompt 12')).toBeNull()
  })

  it('keeps the selected result area in a pending state while a new job is still loading', async () => {
    mocks.currentJob = undefined
    mocks.createGenerationJob.mockResolvedValue({
      id: 'job-created',
      status: 'queued',
    })

    renderStudioPage()

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended template' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate video' }))

    await waitFor(() => {
      expect(screen.getByTestId('studio-selected-job-loading')).toBeTruthy()
    })
    expect(screen.queryByTestId('studio-video')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Download MP4' })).toBeNull()
    expect(screen.getByText('Creating job…')).toBeTruthy()
  })

  it('shows playback and download URLs for completed jobs', () => {
    renderStudioPage()

    expect(screen.getByTestId('studio-video').getAttribute('src')).toBe(
      'https://cdn.example.com/playback.mp4',
    )
    expect(
      screen.getByRole('link', { name: 'Download MP4' }).getAttribute('href'),
    ).toBe('https://cdn.example.com/download.mp4')
  })

  it('warns that planning cancellations may not refund after model start', async () => {
    mocks.currentJob = {
      ...mocks.currentJob,
      id: 'job-2',
      status: 'planning',
      artifactId: null,
      progress: 20,
    }

    renderStudioPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel job' }))

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(
        'Cancel this planning job? Credits may not return after model start.',
      )
    })
    expect(mocks.cancelGenerationJob).toHaveBeenCalledWith({
      jobId: 'job-2',
      reason: 'Canceled from studio.',
    })
  })
})
