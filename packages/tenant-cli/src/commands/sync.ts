import path from 'node:path'

import { syncTenantContent } from '@astropayload/payload-sdk'

import { boolFlag, optionalFlag, requireFlag, type ParsedArgs } from '../args'

/**
 * `tenant-cli sync --slug <slug> [--site <path>] [--url <payload-url>]`
 *
 * Pulls the named tenant's content from Payload and writes it into
 * apps/sites/<slug>/. Reads PAYLOAD_URL and PAYLOAD_API_KEY from env unless
 * overridden via flags.
 */
export async function runSync(args: ParsedArgs): Promise<void> {
  const slug = optionalFlag(args, 'slug') ?? process.env.TENANT
  if (!slug) {
    throw new Error('--slug or TENANT env var is required')
  }
  const url = optionalFlag(args, 'url') ?? process.env.PAYLOAD_URL
  if (!url) throw new Error('--url or PAYLOAD_URL env var is required')
  const apiKey = optionalFlag(args, 'api-key') ?? process.env.PAYLOAD_API_KEY

  const siteRoot = path.resolve(
    optionalFlag(args, 'site') ?? path.join(process.cwd(), 'apps/sites', slug)
  )

  const clean = !boolFlag(args, 'no-clean')

  console.log(`[tenant-cli sync] tenant=${slug}, payload=${url}, site=${siteRoot}`)
  const counts = await syncTenantContent({
    url,
    apiKey,
    tenantSlug: slug,
    siteRoot,
    clean,
  })
  console.log('[tenant-cli sync] done:', counts)
}
