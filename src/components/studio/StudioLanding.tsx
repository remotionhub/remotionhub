import { useAuthActions } from '@convex-dev/auth/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../../convex/_generated/api'
import { useAuthStatus } from '../../lib/useAuthStatus'
import { useI18n } from '../I18nProvider'

export const PENDING_PROMPT_KEY = 'remotionhub.studio.pendingPrompt'

const EXAMPLES = {
  zh: ['制作一个产品发布动画', '用柔光揭示品牌标志', '为活动制作优雅倒计时'],
  en: [
    'Animate a product launch',
    'Reveal a logo with soft light',
    'Create an elegant event countdown',
  ],
} as const

export default function StudioLanding() {
  const { locale, t } = useI18n()
  const { isAuthenticated, isLoading } = useAuthStatus()
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const startPromptProject = useMutation(api.studio.startPromptProject)
  const recentProjects = useQuery(
    api.studio.listRecentProjects,
    isAuthenticated ? { limit: 6 } : 'skip',
  )
  const [prompt, setPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasError, setHasError] = useState(false)
  const trimmedPrompt = prompt.trim()
  const isBusy = isLoading || isSubmitting
  const submitLabel = isLoading
    ? t('auth.loading')
    : isSubmitting
      ? t('studio.status.generating')
      : t('studio.landing.submit')

  useEffect(() => {
    if (!isAuthenticated) return

    try {
      const pendingPrompt = window.sessionStorage.getItem(PENDING_PROMPT_KEY)
      if (pendingPrompt) setPrompt(pendingPrompt)
    } catch {
      // The composer still works when session storage is unavailable.
    }
  }, [isAuthenticated])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!trimmedPrompt || isLoading || isSubmitting) return

    setHasError(false)
    setIsSubmitting(true)

    try {
      if (!isAuthenticated) {
        try {
          window.sessionStorage.setItem(PENDING_PROMPT_KEY, trimmedPrompt)
        } catch {
          // Authentication remains available even without draft persistence.
        }
        await signIn('github', { redirectTo: '/studio' })
        return
      }

      const result = await startPromptProject({
        prompt: trimmedPrompt,
        idempotencyKey: crypto.randomUUID(),
      })
      try {
        window.sessionStorage.removeItem(PENDING_PROMPT_KEY)
      } catch {
        // The project was created even if the stale draft cannot be removed.
      }
      await navigate({
        to: '/studio/$projectId',
        params: { projectId: result.projectId },
      })
    } catch {
      setHasError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-20 sm:pt-28">
      <div className="mx-auto max-w-3xl">
        <header className="max-w-2xl">
          <p className="island-kicker mb-4 mt-0">{t('studio.landing.eyebrow')}</p>
          <h1 className="m-0 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {t('studio.landing.title')}
          </h1>
          <p className="mb-0 mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            {t('studio.landing.description')}
          </p>
        </header>

        <form
          className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 sm:p-4"
          onSubmit={handleSubmit}
        >
          <textarea
            aria-label={t('studio.landing.placeholder')}
            className="block w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 outline-none placeholder:text-muted-foreground"
            maxLength={4_000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t('studio.landing.placeholder')}
            rows={4}
            value={prompt}
          />
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            {!isAuthenticated ? (
              <p className="m-0 text-sm text-muted-foreground">
                {t('studio.auth.required')}
              </p>
            ) : (
              <span />
            )}
            <button
              aria-busy={isBusy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent bg-[var(--brand-mark-bg)] px-5 text-sm font-semibold text-[var(--brand-mark-fg)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!trimmedPrompt || isBusy}
              type="submit"
            >
              {submitLabel}
            </button>
          </div>
        </form>

        {hasError ? (
          <p className="mb-0 mt-3 text-sm text-destructive" role="alert">
            {t('studio.status.failed')}
          </p>
        ) : null}

        <section aria-labelledby="studio-examples" className="mt-6">
          <h2
            className="m-0 text-sm font-medium text-muted-foreground"
            id="studio-examples"
          >
            {t('studio.landing.examples')}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES[locale].map((example) => (
              <button
                className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-left text-sm text-foreground transition hover:bg-[var(--link-bg-hover)]"
                key={example}
                onClick={() => setPrompt(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {isAuthenticated ? (
          <section aria-labelledby="studio-recent" className="mt-14">
            <h2 className="m-0 text-lg font-semibold" id="studio-recent">
              {t('studio.landing.recent')}
            </h2>
            {recentProjects?.length === 0 ? (
              <p className="mb-0 mt-4 text-sm text-muted-foreground">
                {t('studio.landing.emptyRecent')}
              </p>
            ) : null}
            {recentProjects && recentProjects.length > 0 ? (
              <ul className="m-0 mt-4 list-none border-t border-[var(--line)] p-0">
                {recentProjects.map((project) => (
                  <li className="border-b border-[var(--line)]" key={project._id}>
                    <Link
                      className="block py-4 text-sm font-medium no-underline transition hover:text-[var(--brand-mark-fg)]"
                      params={{ projectId: project._id }}
                      to="/studio/$projectId"
                    >
                      {project.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}
