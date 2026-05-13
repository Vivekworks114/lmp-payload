#!/usr/bin/env tsx
/**
 * Import dropped/legacy URLs into the redirects collection so they 301 to a
 * sensible target (e.g. `/keukenzaken/` for stub business listings) on the
 * new site.
 *
 *   pnpm tsx scripts/migrate-redirects.ts \
 *     --slug keukenfaqs \
 *     --tsv ../sites/keukenfaqs/migration/dropped-urls.txt \
 *     --target /keukenzaken/
 *
 * TSV file format: `<full-url>\t<title>`. Only the path portion of the URL
 * is used; the title is preserved as the redirect note.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../src/payload.config'

/**
 * Resolve a CLI path arg relative to where the user invoked the script.
 * Prefers INIT_CWD, then PWD, then process.cwd(). pnpm chdirs into the
 * package directory before running, so a plain path.resolve() would break
 * relative paths from the repo root.
 */
function resolveUserPath(p: string): string {
  if (path.isAbsolute(p)) return p
  const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
  return path.resolve(base, p)
}

interface Args {
  slug: string
  tsv: string
  target: string
  domain?: string
}

function parseArgs(): Args {
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
    } else {
      out[key] = 'true'
    }
  }
  if (!out.slug || !out.tsv || !out.target) {
    console.error('Usage: migrate-redirects --slug <slug> --tsv <file> --target <path> [--domain <d>]')
    process.exit(1)
  }
  return { slug: out.slug, tsv: out.tsv, target: out.target, domain: out.domain }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const payload = await getPayload({ config })

  let tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: args.slug } },
      limit: 1,
    })
  ).docs[0]

  if (!tenant && args.domain) {
    tenant = (
      await payload.find({
        collection: 'tenants',
        where: { domain: { equals: args.domain } },
        limit: 1,
      })
    ).docs[0]
    if (tenant) {
      const t = tenant as { slug?: string }
      console.log(
        `[migrate-redirects] reusing existing tenant matched by domain (slug='${t.slug}'). Pass --slug ${t.slug} next time to skip this lookup.`,
      )
    }
  }

  if (!tenant) {
    if (!args.domain) {
      throw new Error(
        `Tenant '${args.slug}' not found. Pass --domain to auto-create it, or run migrate:wxr first.`,
      )
    }
    console.log(`[migrate-redirects] creating tenants row '${args.slug}'`)
    tenant = await payload.create({
      collection: 'tenants',
      data: {
        slug: args.slug,
        name: args.slug,
        domain: args.domain,
        locale: 'nl-NL',
        siteTitle: args.slug,
        siteDescription: `Imported tenant ${args.slug}. Update this in the admin.`,
      } as never,
    })
  }
  const tenantId = tenant.id as string | number

  const text = await fs.readFile(resolveUserPath(args.tsv), 'utf8')
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  let created = 0
  for (const line of lines) {
    const [url, title] = line.split('\t')
    if (!url) continue
    let from: string
    try {
      from = new URL(url).pathname
    } catch {
      continue
    }

    const data = {
      tenant: tenantId,
      from,
      to: args.target,
      status: '301',
      note: title?.trim() || undefined,
    } as never

    const existing = await payload.find({
      collection: 'redirects',
      where: { and: [{ tenant: { equals: tenantId } }, { from: { equals: from } }] },
      limit: 1,
    })
    if (existing.docs[0]) {
      await payload.update({ collection: 'redirects', id: existing.docs[0].id, data })
    } else {
      await payload.create({ collection: 'redirects', data })
    }
    created++
  }

  console.log(`[migrate-redirects] processed ${created} rows`)
  process.exit(0)
}

main().catch((err) => {
  const inner = (err as { data?: { errors?: unknown } } | null)?.data?.errors
  if (inner) {
    console.error('[migrate-redirects] failed:', err)
    console.error('  validation details:', JSON.stringify(inner, null, 2))
  } else {
    console.error('[migrate-redirects] failed:', err)
  }
  process.exit(1)
})
