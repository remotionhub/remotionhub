import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { bootstrapUsersApi, useAuthStatus } from '#/lib/useAuthStatus'

export function UserBootstrap() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const ensureUser = useMutation(bootstrapUsersApi.users.ensure)
  const lastEnsuredUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      lastEnsuredUserId.current = null
      return
    }

    if (isLoading || !me || lastEnsuredUserId.current === me._id) return

    lastEnsuredUserId.current = me._id
    void ensureUser({}).catch(() => {
      if (lastEnsuredUserId.current === me._id) {
        lastEnsuredUserId.current = null
      }
      // Best-effort repair. Broken bootstrap state should not crash public browsing.
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
