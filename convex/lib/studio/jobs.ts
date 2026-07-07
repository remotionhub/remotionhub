import { ACTIVE_JOB_STATUSES, STUDIO_PROGRESS_BY_STATUS } from './constants'

export function defaultProgressForStatus(
  status: keyof typeof STUDIO_PROGRESS_BY_STATUS,
) {
  return STUDIO_PROGRESS_BY_STATUS[status]
}

export function isActiveStatus(status: string) {
  return ACTIVE_JOB_STATUSES.includes(status as never)
}

export function canRefundCancellation(args: {
  status: string
  modelStartedAt?: number
}) {
  if (args.status === 'queued') return true
  if (args.status === 'planning' && !args.modelStartedAt) return true
  return false
}
