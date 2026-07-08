export function initialGrantKey(userId: string) {
  return `initial-grant-v1:${userId}`
}

export function consumeKey(jobId: string) {
  return `consume:${jobId}`
}

export function refundKey(jobId: string) {
  return `refund:${jobId}`
}
