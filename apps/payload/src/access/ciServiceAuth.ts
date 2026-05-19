import type { PayloadRequest } from 'payload'

import { isSuperAdmin } from './isSuperAdmin'

/**
 * GitHub Actions and other CI may authenticate with a super-admin API key or
 * `x-deploy-report-token` (DEPLOY_REPORT_TOKEN on the CMS server).
 */
export function isCiServiceAuthorized(req: PayloadRequest): boolean {
  if (isSuperAdmin(req.user)) return true

  const expected = process.env.DEPLOY_REPORT_TOKEN?.trim()
  if (!expected) return false

  const header = req.headers?.get?.('x-deploy-report-token')?.trim() ?? null
  return Boolean(header && header === expected)
}
