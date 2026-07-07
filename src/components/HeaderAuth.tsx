import { useAuthActions } from '@convex-dev/auth/react'
import { LogInIcon, LogOutIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getCurrentRelativeUrl } from '#/lib/authRedirect'
import { useAuthStatus } from '#/lib/useAuthStatus'
import { useI18n } from './I18nProvider'

function getDisplayHandle(me: { handle?: string; name?: string } | null | undefined) {
  return me?.handle?.trim() || me?.name?.trim() || 'user'
}

function WeChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M15.6 4.5c-3.1 0-5.6 2-5.6 4.5 0 1 .4 2 1.1 2.8l-.4 1.5 1.5-.6c.8.4 1.8.7 2.8.7.4 0 .8 0 1.2-.1-.1-.4-.2-.8-.2-1.2 0-2.5 2.5-4.5 5.6-4.5.2 0 .3 0 .5.1-.6-2-2.7-3.2-6.5-3.2Z"
        fill="#07C160"
      />
      <path
        d="M8.8 6.4c-2.8 0-5 1.8-5 4s2.2 4 5 4c.5 0 1-.1 1.5-.2l1.6.7-.5-1.5c.9-.7 1.4-1.8 1.4-3 0-2.2-2.2-4-5-4Zm-1.7 2.4a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Zm3.5 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z"
        fill="#07C160"
      />
      <circle cx="7.1" cy="8.8" r="0.55" fill="#fff" />
      <circle cx="10.6" cy="8.8" r="0.55" fill="#fff" />
      <circle cx="14.9" cy="9.5" r="0.55" fill="#fff" />
      <circle cx="18.3" cy="9.5" r="0.55" fill="#fff" />
    </svg>
  )
}

export default function HeaderAuth() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const { signIn, signOut } = useAuthActions()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const loginButtonRef = useRef<HTMLButtonElement | null>(null)
  const wasDialogOpen = useRef(false)

  useEffect(() => {
    if (wasDialogOpen.current && !isDialogOpen) {
      loginButtonRef.current?.focus()
    }
    wasDialogOpen.current = isDialogOpen
  }, [isDialogOpen])

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
          ref={loginButtonRef}
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
                  aria-label={t('auth.close')}
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
                  <WeChatIcon />
                  {t('auth.signInWithWeChat')}
                </button>
              </div>

              <p className="mt-5 mb-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
                {t('auth.agreementPrefix')}{' '}
                <span className="text-[var(--sea-ink)]">
                  {t('auth.userAgreement')}
                </span>{' '}
                <span className="text-[var(--sea-ink)]">
                  {t('auth.privacyPolicy')}
                </span>
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
