// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    viewer: {
      userId: 'studio-user-1',
    } as { userId: string } | null | undefined,
    artifactAccessQueryArgs: [] as unknown[],
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
      getStudioViewer: 'getStudioViewer',
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
    if (reference === 'getStudioViewer') {
      return mocks.viewer
    }
    if (reference === 'getMyStudioHistory') {
      if (args === 'skip') {
        return undefined
      }
      return mocks.history
    }
    if (reference === 'getGenerationJob') {
      return args === 'skip' ? undefined : mocks.currentJob
    }
    if (reference === 'getGenerationArtifactAccess') {
      mocks.artifactAccessQueryArgs.push(args)
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
              'Cancel this queued job? Credits are not refunded after cancellation.',
            'studio.cancelConfirmPlanning':
              'Cancel this planning job? Credits are not refunded, and cancellation is not guaranteed after rendering starts.',
            'studio.authRequiredTitle': 'Sign in to use Studio',
            'studio.authRequiredDescription':
              'Sign in before creating, viewing, or downloading your AI Studio generation jobs.',
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
    mocks.viewer = { userId: 'studio-user-1' }
    mocks.artifactAccessQueryArgs = []
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
    vi.useRealTimers()
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

  it('gates owner-only studio calls when the viewer is unauthenticated', () => {
    mocks.viewer = null

    renderStudioPage()

    expect(screen.getByTestId('studio-auth-required')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Generate video' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(screen.getByText('No jobs yet.')).toBeTruthy()
  })

  it('keeps generation disabled while the viewer is loading', () => {
    mocks.viewer = undefined

    renderStudioPage()

    expect(screen.queryByTestId('studio-auth-required')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Generate video' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('renders template loading and empty states', () => {
    mocks.templates = undefined as never
    const { container, rerender } = renderStudioPage()

    expect(container.querySelectorAll('.studio-template-skeleton')).toHaveLength(3)

    mocks.templates = []
    rerender(<StudioPage />)

    expect(screen.getByText('No templates available')).toBeTruthy()
    expect(
      screen.getByText('Seed an approved Remotion studio template to unlock generation.'),
    ).toBeTruthy()
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

  it('renews signed artifact URLs before they expire', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_720_000_000_000)
    mocks.artifactAccess = {
      ...mocks.artifactAccess,
      playback: {
        ...mocks.artifactAccess.playback,
        expiresAt: 1_720_000_031_000,
      },
      download: {
        ...mocks.artifactAccess.download,
        expiresAt: 1_720_000_031_000,
      },
      thumbnail: {
        ...mocks.artifactAccess.thumbnail,
        expiresAt: 1_720_000_031_000,
      },
    }

    renderStudioPage()

    expect(mocks.artifactAccessQueryArgs).toContainEqual({
      jobId: 'job-1',
      refresh: 0,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(mocks.artifactAccessQueryArgs).toContainEqual('skip')

    mocks.artifactAccess = {
      ...mocks.artifactAccess,
      playback: {
        ...mocks.artifactAccess.playback,
        expiresAt: 1_720_000_300_000,
      },
      download: {
        ...mocks.artifactAccess.download,
        expiresAt: 1_720_000_300_000,
      },
      thumbnail: {
        ...mocks.artifactAccess.thumbnail,
        expiresAt: 1_720_000_300_000,
      },
    }
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    expect(mocks.artifactAccessQueryArgs).toContainEqual({
      jobId: 'job-1',
      refresh: 1,
    })
  })

  it('shows a pending artifact message when a completed job has no signed URLs yet', () => {
    mocks.artifactAccess = undefined as never

    renderStudioPage()

    expect(
      screen.getByText(
        'The job completed, but the playback links are still being prepared.',
      ),
    ).toBeTruthy()
    expect(screen.queryByTestId('studio-video')).toBeNull()
  })

  it('shows the fallback error message when generation fails with a non-error value', async () => {
    mocks.createGenerationJob.mockRejectedValue('network interrupted')

    renderStudioPage()

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended template' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate video' }))

    await waitFor(() => {
      expect(screen.getByText('Unknown studio error.')).toBeTruthy()
    })
  })

  it('does not cancel a queued job when the user rejects confirmation', async () => {
    const currentJob = mocks.currentJob ?? buildCurrentJob()
    mocks.currentJob = {
      ...currentJob,
      id: 'job-queued',
      status: 'queued',
      artifactId: null,
      progress: 5,
    }
    mocks.confirm.mockReturnValue(false)

    renderStudioPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel job' }))

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(
        'Cancel this queued job? Credits are not refunded after cancellation.',
      )
    })
    expect(mocks.cancelGenerationJob).not.toHaveBeenCalled()
  })

  it('warns that planning cancellations do not refund', async () => {
    const currentJob = mocks.currentJob ?? buildCurrentJob()
    mocks.currentJob = {
      ...currentJob,
      id: 'job-2',
      status: 'planning',
      artifactId: null,
      progress: 20,
    }

    renderStudioPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel job' }))

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(
        'Cancel this planning job? Credits are not refunded, and cancellation is not guaranteed after rendering starts.',
      )
    })
    expect(mocks.cancelGenerationJob).toHaveBeenCalledWith({
      jobId: 'job-2',
      reason: 'Canceled from studio.',
    })
  })
})
