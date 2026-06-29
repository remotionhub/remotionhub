import { Link } from '@tanstack/react-router'
import { useI18n } from './I18nProvider'

export default function Footer() {
  const year = new Date().getFullYear()
  const { t } = useI18n()

  return (
    <footer className="mt-20 border-t border-[var(--line)] px-4 pb-12 pt-8 text-muted-foreground">
      <div className="page-wrap flex flex-col justify-between gap-4 text-sm sm:flex-row">
        <p className="m-0">&copy; {year} RemotionHub.</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/remotion" className="hover:text-foreground">
            {t('nav.remotion')}
          </Link>
          <Link to="/hyperframes" className="hover:text-foreground">
            {t('nav.hyperframes')}
          </Link>
          <a
            href="https://github.com/remotionhub/remotionhub"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            {t('footer.github')}
          </a>
        </nav>
      </div>
    </footer>
  )
}
