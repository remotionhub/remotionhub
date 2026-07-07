import { useAuthActions } from '@convex-dev/auth/react'
import { LogInIcon, LogOutIcon, MessageCircleIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getCurrentRelativeUrl } from '#/lib/authRedirect'
import { useAuthStatus } from '#/lib/useAuthStatus'
import { useI18n } from './I18nProvider'

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <span
        aria-label={t('auth.loading')}
        className="h-9 w-9 rounded-md bg-[var(--surface-muted)]"
      />
    )
  }

  if (!isAuthenticated || !me) {
    return (
      <>
        <button
          type="button"
          aria-label={t('auth.login')}
          className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          onClick={() => setIsDialogOpen(true)}
        >
          <LogInIcon aria-hidden="true" size={20} />
        </button>

        {isDialogOpen ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 px-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsDialogOpen(false)
            }}
          >
            <section
              aria-modal="true"
              aria-label={t('auth.loginToRemotionHub')}
              role="dialog"
              className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--sea-ink)] shadow-xl"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="m-0 text-lg font-semibold">{t('auth.loginToRemotionHub')}</h2>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                  onClick={() => setIsDialogOpen(false)}
                >
                  <XIcon aria-hidden="true" size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="m-0 text-center text-sm text-[var(--sea-ink-soft)]">
                  {t('auth.otherMethods')}
                </p>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
                  onClick={() => {
                    void signIn('wechat', {
                      redirectTo: getCurrentRelativeUrl(),
                    }).catch(() => {
                      toast.error(t('auth.signInFailed'))
                    })
                  }}
                >
                  <MessageCircleIcon aria-hidden="true" size={18} />
                  {t('auth.signInWithWeChat')}
                </button>
              </div>

              <p className="mt-5 mb-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
                {t('auth.agreementPrefix')}{' '}
                <a className="text-[var(--sea-ink)]" href="/page/agreement">
                  {t('auth.userAgreement')}
                </a>{' '}
                <a className="text-[var(--sea-ink)]" href="/page/privacy">
                  {t('auth.privacyPolicy')}
                </a>
              </p>
            </section>
          </div>
        ) : null}
      </>
    )
  }

  const handle = getDisplayHandle(me)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={t('auth.signedInAs', { handle })}
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
      </button>
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
