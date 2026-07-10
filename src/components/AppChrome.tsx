import { useRouterState } from '@tanstack/react-router'
import type { PropsWithChildren } from 'react'
import Footer from './Footer'
import Header from './Header'

export default function AppChrome({ children }: PropsWithChildren) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isStudio = pathname === '/studio' || pathname.startsWith('/studio/')

  return (
    <>
      <Header />
      {children}
      {isStudio ? null : <Footer />}
    </>
  )
}
