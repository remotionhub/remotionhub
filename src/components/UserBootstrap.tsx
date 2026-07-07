import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { useAuthStatus } from '#/lib/useAuthStatus'

export function UserBootstrap() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const ensureUser = useMutation(api.users.ensure)
  const lastBootstrappedSession = useRef<string | null>(null)

  useEffect(() => {
    if (isLoading || !isAuthenticated || me === undefined) {
      lastBootstrappedSession.current = null
      return
    }

    const sessionKey = me?._id ?? 'authenticated-without-user'
    if (lastBootstrappedSession.current === sessionKey) return

    lastBootstrappedSession.current = sessionKey
    void ensureUser({}).catch(() => {
      if (lastBootstrappedSession.current === sessionKey) {
        lastBootstrappedSession.current = null
      }
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
