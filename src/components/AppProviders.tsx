import { ConvexProvider } from 'convex/react'
import { Toaster } from '#/components/ui/sonner'
import { convexReactClient } from '#/lib/convex'
import { I18nProvider } from './I18nProvider'

export default function AppProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProvider client={convexReactClient}>
      <I18nProvider>
        {children}
        <Toaster />
      </I18nProvider>
    </ConvexProvider>
  )
}
