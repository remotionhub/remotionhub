import { useAuthActions } from '@convex-dev/auth/react'
import { GithubIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStatus } from '#/lib/useAuthStatus'
import { useI18n } from './I18nProvider'

function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()

  if (isLoading) {
    return (
      <span
        aria-label={t('auth.loading')}
        className="h-9 w-28 rounded-md bg-[var(--surface-muted)]"
      />
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <button
        type="button"
        aria-label={t('auth.signInWithGitHub')}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
        onClick={() => {
          void signIn('github', { redirectTo: getCurrentRelativeUrl() }).catch(() => {
            toast.error(t('auth.signInFailed'))
          })
        }}
      >
        <GithubIcon aria-hidden="true" size={17} />
        <span className="hidden sm:inline">{t('auth.signInWithGitHub')}</span>
      </button>
    )
  }

  const handle = getDisplayHandle(me)

  return (
    <div
      role="group"
      aria-label={t('auth.signedInAs', { handle })}
      className="flex items-center gap-2"
    >
      <div
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm text-[var(--sea-ink)]"
      >
        {me.image ? (
          <img
            src={me.image}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-mark-bg)] text-[10px] font-bold text-[var(--brand-mark-fg)]">
            {handle.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-28 truncate sm:inline">{handle}</span>
      </div>
      <button
        type="button"
        className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        onClick={() => {
          void signOut().catch(() => {
            toast.error(t('auth.signOutFailed'))
          })
        }}
      >
        <span className="sr-only">{t('auth.signOut')}</span>
        <LogOutIcon aria-hidden="true" size={18} />
      </button>
    </div>
  )
}
