import { GithubIcon, XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './I18nProvider'

export type AuthProvider = 'github' | 'wechat'

type AuthDialogProps = {
  open: boolean
  pendingProvider: AuthProvider | null
  onClose: () => void
  onSignIn: (provider: AuthProvider) => void
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function WeChatIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.2 5.5c-3.43 0-6.2 2.27-6.2 5.08 0 1.62.94 3.06 2.4 3.99L3.75 17l2.83-1.4c.51.13 1.06.2 1.62.2 3.43 0 6.2-2.27 6.2-5.08S11.63 5.5 8.2 5.5Z"
        fill="#07C160"
      />
      <path
        d="M15.8 9.25c-3.43 0-6.2 2.27-6.2 5.08s2.77 5.07 6.2 5.07c.56 0 1.1-.07 1.62-.2l2.83 1.4-.65-2.43c1.46-.93 2.4-2.37 2.4-3.99 0-2.81-2.77-5.08-6.2-5.08Z"
        fill="#07C160"
      />
      <circle cx="6.2" cy="9.9" fill="white" r=".8" />
      <circle cx="10.2" cy="9.9" fill="white" r=".8" />
      <circle cx="13.8" cy="13.45" fill="white" r=".8" />
      <circle cx="17.8" cy="13.45" fill="white" r=".8" />
    </svg>
  )
}

export default function AuthDialog({ open, pendingProvider, onClose, onSignIn }: AuthDialogProps) {
  const { t } = useI18n()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = getFocusableElements(dialogRef.current)
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement
      const hasFocusWithinDialog = activeElement instanceof Node && dialogRef.current.contains(activeElement)

      if (event.shiftKey && (!hasFocusWithinDialog || activeElement === firstElement)) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (!hasFocusWithinDialog || activeElement === lastElement)) {
        event.preventDefault()
        firstElement.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open || !overlayRef.current) return

    const backgroundElements = Array.from(document.body.children).filter(
      (element) => element !== overlayRef.current,
    )
    const previousStates = backgroundElements.map((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      element,
      hadInert: element.hasAttribute('inert'),
    }))

    for (const { element } of previousStates) {
      element.setAttribute('aria-hidden', 'true')
      element.setAttribute('inert', '')
    }

    return () => {
      for (const { ariaHidden, element, hadInert } of previousStates) {
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
        if (!hadInert) element.removeAttribute('inert')
      }
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={overlayRef}
      data-testid="auth-dialog-overlay"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/45 px-4 py-8"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        aria-label={t('auth.loginToRemotionHub')}
        aria-modal="true"
        role="dialog"
        className="relative w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-7 py-8 text-[var(--sea-ink)] shadow-2xl sm:px-10"
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label={t('auth.close')}
          className="absolute top-4 right-4 rounded-md p-2 text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)]"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" size={20} />
        </button>

        <h2 className="m-0 text-center text-xl font-semibold">
          {t('auth.loginToRemotionHub')}
        </h2>

        <div className="my-8 flex items-center gap-4 text-xs text-[var(--sea-ink-soft)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          <span>{t('auth.otherMethods')}</span>
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <div className="flex justify-center gap-4">
          <button
            type="button"
            aria-label={t('auth.signInWithGitHub')}
            className="grid h-14 w-20 place-items-center rounded-lg border border-[var(--line)] hover:bg-[var(--link-bg-hover)] disabled:cursor-wait disabled:opacity-50"
            disabled={pendingProvider !== null}
            onClick={() => onSignIn('github')}
          >
            <GithubIcon aria-hidden="true" size={22} />
          </button>
          <button
            type="button"
            aria-label={t('auth.signInWithWeChat')}
            className="grid h-14 w-20 place-items-center rounded-lg border border-[var(--line)] hover:bg-[var(--link-bg-hover)] disabled:cursor-wait disabled:opacity-50"
            disabled={pendingProvider !== null}
            onClick={() => onSignIn('wechat')}
          >
            <WeChatIcon />
          </button>
        </div>

        <p className="mt-8 mb-0 text-center text-xs leading-5 text-[var(--sea-ink-soft)]">
          {t('auth.agreementText')}
        </p>
      </section>
    </div>,
    document.body,
  )
}
