#!/usr/bin/env tsx
/**
 * CI helper: import repo markdown into Payload via REST API (no DATABASE_URI).
 * Requires PAYLOAD_URL and PAYLOAD_API_KEY (CI service user).
 *
 *   pnpm auto-import-blog-if-empty -- --slug keukenfaqs --site /path/to/repo
 */
import { resolveSitePath } from '../src/lib/importBlogFromRepo'
import { autoImportBlogIfEmptyViaApi } from '../src/lib/importBlogFromRepoViaApi'

function parseArgs() {
  const argv = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    }
  }
  const slug = out.slug
  const site = out.site
  if (!slug || !site) {
    console.error(
      'Usage: auto-import-blog-if-empty --slug <slug> --site <repo-root> [--blog-path src/content/blog]',
    )
    process.exit(1)
  }
  return {
    slug,
    site,
    blogPath: out['blog-path'] || 'src/content/blog',
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const url = process.env.PAYLOAD_URL?.replace(/\/+$/, '')
  const apiKey = process.env.PAYLOAD_API_KEY
  if (!url || !apiKey) {
    console.error('[auto-import-blog] PAYLOAD_URL and PAYLOAD_API_KEY are required (no database access from CI).')
    process.exit(1)
  }

  console.log(`[auto-import-blog] slug=${args.slug} site=${resolveSitePath(args.site)} payload=${url}`)

  const outcome = await autoImportBlogIfEmptyViaApi({
    url,
    apiKey,
    tenantSlug: args.slug,
    siteRoot: args.site,
    blogPath: args.blogPath,
  })

  if (outcome.skipped) {
    console.log(`[auto-import-blog] skipped: ${outcome.reason}`)
    return
  }

  const r = outcome.result!
  console.log(
    `[auto-import-blog] imported: ${r.created} created, ${r.updated} updated (${r.fileCount} files from ${r.blogDir})`,
  )
}

void main()
