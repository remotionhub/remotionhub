import { Link } from '@tanstack/react-router'
import { GithubIcon } from 'lucide-react'
import { useI18n } from './I18nProvider'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            RemotionHub
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            {t('nav.catalog')}
          </Link>
          <Link
            to="/remotion"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            {t('nav.remotion')}
          </Link>
          <Link
            to="/hyperframes"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            {t('nav.hyperframes')}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <a
            href="https://github.com/tangwz/remotionhub"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-xl p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)] sm:block"
          >
            <span className="sr-only">{t('nav.github')}</span>
            <GithubIcon aria-hidden="true" size={22} />
          </a>

          <LanguageToggle />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
