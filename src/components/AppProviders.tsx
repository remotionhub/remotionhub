import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { Toaster } from '#/components/ui/sonner'
import { convexReactClient } from '#/lib/convex'
import { I18nProvider } from './I18nProvider'
import { UserBootstrap } from './UserBootstrap'

export default function AppProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexAuthProvider client={convexReactClient}>
      <I18nProvider>
        <UserBootstrap />
        {children}
        <Toaster />
      </I18nProvider>
    </ConvexAuthProvider>
  )
}
