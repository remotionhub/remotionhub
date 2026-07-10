// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../I18nProvider'
import StudioLanding from './StudioLanding'

const PENDING_PROMPT_KEY = 'remotionhub.studio.pendingPrompt'

const mocks = vi.hoisted(() => ({
  useAuthStatus: vi.fn(),
  signIn: vi.fn(),
  useQuery: vi.fn(),
  startPromptProject: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('#/lib/useAuthStatus', () => ({
  useAuthStatus: mocks.useAuthStatus,
}))

vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}))

vi.mock('convex/react', () => ({
  useQuery: mocks.useQuery,
  useMutation: () => mocks.startPromptProject,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))

function renderLanding({
  authenticated,
  projects = [],
}: {
  authenticated: boolean
  projects?: Array<{ _id: string; title: string }>
}) {
  mocks.useAuthStatus.mockReturnValue({
    isAuthenticated: authenticated,
    isLoading: false,
    me: authenticated ? { _id: 'users:1' } : null,
  })
  mocks.useQuery.mockReturnValue(authenticated ? projects : undefined)

  render(
    <I18nProvider>
      <StudioLanding />
    </I18nProvider>,
  )
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  const values = new Map<string, string>()
  const storage = {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  } satisfies Storage

  Object.defineProperty(window, name, {
    configurable: true,
    value: storage,
  })
}

function enterPrompt(value: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } })
}

function submitPrompt(value: string) {
  enterPrompt(value)
  fireEvent.click(screen.getByRole('button', { name: /生成|generate/i }))
}

describe('StudioLanding', () => {
  beforeEach(() => {
    installStorage('localStorage')
    installStorage('sessionStorage')
    mocks.signIn.mockReset().mockResolvedValue({ signingIn: true })
    mocks.useQuery.mockReset()
    mocks.startPromptProject.mockReset().mockResolvedValue({
      projectId: 'studioProjects:1',
      runId: 'studioGenerationRuns:1',
      status: 'queued',
    })
    mocks.navigate.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('stores the draft and starts sign-in when a signed-out user submits', async () => {
    renderLanding({ authenticated: false })

    submitPrompt('  Animate a product launch  ')

    await waitFor(() => {
      expect(window.sessionStorage.getItem(PENDING_PROMPT_KEY)).toBe(
        'Animate a product launch',
      )
      expect(mocks.signIn).toHaveBeenCalledWith('github', {
        redirectTo: '/studio',
      })
    })
  })

  it('restores and submits the draft after authentication', async () => {
    window.sessionStorage.setItem(
      PENDING_PROMPT_KEY,
      'Animate a product launch',
    )
    renderLanding({ authenticated: true })

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Animate a product launch',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: /生成|generate/i }))

    await waitFor(() => {
      expect(mocks.startPromptProject).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'Animate a product launch' }),
      )
      expect(window.sessionStorage.getItem(PENDING_PROMPT_KEY)).toBeNull()
    })
  })

  it('does not put the prompt in navigation or redirect parameters', async () => {
    renderLanding({ authenticated: false })

    submitPrompt('private draft')

    await waitFor(() => {
      expect(mocks.signIn.mock.calls[0]).toEqual([
        'github',
        { redirectTo: '/studio' },
      ])
    })
  })

  it('skips recent projects while signed out', () => {
    renderLanding({ authenticated: false })

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), 'skip')
    expect(screen.queryByRole('heading', { name: /最近项目|recent projects/i })).toBeNull()
  })

  it('shows recent projects only to authenticated users', () => {
    renderLanding({
      authenticated: true,
      projects: [{ _id: 'studioProjects:recent', title: 'Product launch' }],
    })

    expect(
      screen.getByRole('heading', { name: /最近项目|recent projects/i }),
    ).toBeTruthy()
    expect(screen.getByText('Product launch')).toBeTruthy()
  })

  it('navigates with the project id returned by the mutation', async () => {
    renderLanding({ authenticated: true })

    submitPrompt('Animate a product launch')

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/studio/$projectId',
        params: { projectId: 'studioProjects:1' },
      })
    })
  })

  it('replaces the current draft when an example is selected', () => {
    renderLanding({ authenticated: false })
    enterPrompt('Old draft')

    fireEvent.click(
      screen.getByRole('button', { name: /产品发布|product launch/i }),
    )

    expect(
      (screen.getByRole('textbox') as HTMLTextAreaElement).value,
    ).toMatch(/产品发布|product launch/i)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).not.toContain(
      'Old draft',
    )
  })
})
