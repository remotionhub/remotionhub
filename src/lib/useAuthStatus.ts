import { useConvexAuth, useQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

type BootstrapUsersApi = {
  users: {
    me: FunctionReference<'query', 'public', Record<string, never>, Doc<'users'> | null>
    ensure: FunctionReference<
      'mutation',
      'public',
      Record<string, never>,
      { publisherId: Id<'publishers'> }
    >
  }
}

export const bootstrapUsersApi = api as typeof api & BootstrapUsersApi

export function useAuthStatus() {
  const auth = useConvexAuth()
  const shouldLoadUser = auth.isAuthenticated
  const userResult = useQuery(bootstrapUsersApi.users.me, shouldLoadUser ? {} : 'skip')
  const isUserLoading = shouldLoadUser && userResult === undefined
  const me = shouldLoadUser ? userResult : auth.isLoading ? undefined : null

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading || isUserLoading,
    me,
  }
}
