import { useAuthActions } from '@convex-dev/auth/react'
import { CircleUserRoundIcon, LogOutIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getCurrentRelativeUrl } from '#/lib/authRedirect'
import { useAuthStatus } from '#/lib/useAuthStatus'
import AuthDialog, { type AuthProvider } from './AuthDialog'
import { useI18n } from './I18nProvider'

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)
  const loginButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingProviderRef = useRef<AuthProvider | null>(null)
  const wasDialogOpen = useRef(false)

  useEffect(() => {
    if (wasDialogOpen.current && !isDialogOpen) {
      loginButtonRef.current?.focus()
    }
    wasDialogOpen.current = isDialogOpen
  }, [isDialogOpen])

  const openDialog = useCallback(() => {
    setSignInError(null)
    setIsDialogOpen(true)
  }, [])
  const closeDialog = useCallback(() => setIsDialogOpen(false), [])
  const startSignIn = useCallback(
    (provider: AuthProvider) => {
      if (pendingProviderRef.current) return

      setSignInError(null)
      pendingProviderRef.current = provider
      setPendingProvider(provider)
      void signIn(provider, { redirectTo: getCurrentRelativeUrl() }).catch(() => {
        pendingProviderRef.current = null
        setPendingProvider(null)
        const errorMessage = t('auth.signInFailed')
        setSignInError(errorMessage)
        toast.error(errorMessage)
      })
    },
    [signIn, t],
  )

  if (isLoading) {
    return (
      <span
        aria-label={t('auth.loading')}
        className="inline-block h-9 w-28 rounded-md bg-[var(--surface-muted)]"
      />
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <>
        <button
          ref={loginButtonRef}
          type="button"
          aria-label={t('auth.login')}
          className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          onClick={openDialog}
        >
          <CircleUserRoundIcon aria-hidden="true" size={20} />
        </button>
        <AuthDialog
          errorMessage={signInError}
          open={isDialogOpen}
          pendingProvider={pendingProvider}
          onClose={closeDialog}
          onSignIn={startSignIn}
        />
      </>
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
          void signOut()
        }}
      >
        <span className="sr-only">{t('auth.signOut')}</span>
        <LogOutIcon aria-hidden="true" size={18} />
      </button>
    </div>
  )
}
