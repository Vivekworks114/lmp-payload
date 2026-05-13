import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { optionalFlag, requireFlag, type ParsedArgs } from '../args'

/**
 * `tenant-cli migrate --slug <slug> --domain <domain> [--wxr <path>] [--scraped <dir>]`
 *
 * Thin wrapper around the apps/payload migration scripts so a single command
 * can onboard a WordPress site:
 *   1. Ensures a tenants row exists in Payload.
 *   2. Runs migrate-wxr.ts to import posts, pages, attachments.
 *   3. Runs migrate-money-pages.ts to import scraped top10/product/business
 *      JSON.
 *   4. Optionally runs the sync command to materialise the new content into
 *      apps/sites/<slug>/.
 */
export async function runMigrate(args: ParsedArgs): Promise<void> {
  const slug = requireFlag(args, 'slug')
  const domain = requireFlag(args, 'domain')
  const wxr = optionalFlag(args, 'wxr')
  const scraped = optionalFlag(args, 'scraped')
  const cwd = process.cwd()
  const payloadRoot = path.resolve(path.join(cwd, 'apps/payload'))
  const env = { ...process.env, TENANT_SLUG: slug, TENANT_DOMAIN: domain }

  if (wxr) {
    const wxrPath = path.resolve(wxr)
    console.log(`[tenant-cli migrate] WXR -> Payload (${wxrPath})`)
    const result = spawnSync(
      'pnpm',
      ['run', 'migrate:wxr', '--', '--wxr', wxrPath, '--slug', slug, '--domain', domain],
      { cwd: payloadRoot, env, stdio: 'inherit' }
    )
    if (result.status !== 0) throw new Error('migrate:wxr failed')
  }

  if (scraped) {
    const scrapedPath = path.resolve(scraped)
    console.log(`[tenant-cli migrate] scraped money pages -> Payload (${scrapedPath})`)
    const result = spawnSync(
      'pnpm',
      ['run', 'migrate:money-pages', '--', '--scraped-dir', scrapedPath, '--slug', slug],
      { cwd: payloadRoot, env, stdio: 'inherit' }
    )
    if (result.status !== 0) throw new Error('migrate:money-pages failed')
  }

  console.log('[tenant-cli migrate] complete. Now run:')
  console.log(`  pnpm tenant-cli sync --slug ${slug}`)
}
