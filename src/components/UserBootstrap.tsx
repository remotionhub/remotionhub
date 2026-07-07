import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { useAuthStatus } from '#/lib/useAuthStatus'

export function UserBootstrap() {
  const { isAuthenticated, isLoading, me } = useAuthStatus()
  const ensureUser = useMutation(api.users.ensure)
  const didRun = useRef(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated || !me || didRun.current) return
    didRun.current = true
    void ensureUser({}).catch(() => {
      didRun.current = false
    })
  }, [ensureUser, isAuthenticated, isLoading, me])

  return null
}
