import { ConvexHttpClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL is required.')
}

export const convexReactClient = new ConvexReactClient(convexUrl)

export function createConvexHttpClient() {
  return new ConvexHttpClient(convexUrl)
}
