import { Link } from '@tanstack/react-router'
import HeaderAuth from './HeaderAuth'
import { useI18n } from './I18nProvider'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="site-nav page-wrap">
        <div className="site-nav-primary">
          <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
            <Link
              to="/"
              className="inline-flex items-center gap-2 whitespace-nowrap text-[var(--sea-ink)] no-underline"
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-[var(--brand-mark-bg)] text-[10px] font-bold text-[var(--brand-mark-fg)]">
                RH
              </span>
              RemotionHub
            </Link>
          </h2>

          <div className="site-nav-links">
            <Link
              to="/"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              {t('nav.catalog')}
            </Link>
            <Link
              to="/studio"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              {t('nav.studio')}
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
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </nav>
    </header>
  )
}
