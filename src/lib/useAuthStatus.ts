import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'

export function useAuthStatus() {
  const auth = useConvexAuth()
  const shouldLoadUser = auth.isAuthenticated
  const userResult = useQuery(api.users.me, shouldLoadUser ? {} : 'skip') as
    | Doc<'users'>
    | null
    | undefined
  const isUserLoading = shouldLoadUser && userResult === undefined
  const me = shouldLoadUser ? userResult : auth.isLoading ? undefined : null

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading || isUserLoading,
    me,
  }
}
