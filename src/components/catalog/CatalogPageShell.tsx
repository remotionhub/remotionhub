import type { ReactNode } from 'react'

export type CatalogPageShellProps = {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export default function CatalogPageShell({
  eyebrow,
  title,
  description,
  children,
}: CatalogPageShellProps) {
  return (
    <main className="catalog-page">
      <header className="catalog-hero">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="catalog-divider" />
      {children}
    </main>
  )
}
