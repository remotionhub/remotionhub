import type { ReactNode } from 'react'

export type CatalogPageShellProps = {
  title: string
  children: ReactNode
}

export default function CatalogPageShell({
  title,
  children,
}: CatalogPageShellProps) {
  return (
    <main className="catalog-page">
      <header className="catalog-hero">
        <h1>{title}</h1>
      </header>
      <div className="catalog-divider" />
      {children}
    </main>
  )
}
