import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { useAuthStatus } from '#/lib/useAuthStatus'

const usersApi = api as typeof api & {
  users: {
    ensure: never
  }
}

export function UserBootstrap() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const ensureUser = useMutation(usersApi.users.ensure)
  const didRun = useRef(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !me || didRun.current) return

    didRun.current = true
    void ensureUser({}).catch(() => {
      // Best-effort repair. Broken bootstrap state should not crash public browsing.
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
