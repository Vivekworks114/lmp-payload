#!/usr/bin/env tsx
/**
 * Import scraped money-page JSON files into Payload.
 *
 *   pnpm migrate:money-pages -- \
 *     --slug keukenfaqs \
 *     --scraped-dir ../sites/keukenfaqs/src/data/money-pages
 *
 * The scraped JSON shape (one file per page) is the discriminated-union
 * format produced by apps/sites/keukenfaqs/migration/scrape-money-pages.mjs:
 *
 *   { url, slug, title, page_type, top10|product|business|null, ... }
 *
 * Each file is routed by `page_type`:
 *   - top10    -> top10s collection
 *   - product  -> products collection
 *   - business -> businesses collection
 *   - unknown  -> redirects (best-effort) or skipped
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
  scrapedDir: string
  domain?: string
  limit?: number
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
  const slug = out.slug
  const scrapedDir = out['scraped-dir'] ?? out.scraped
  if (!slug || !scrapedDir) {
    console.error('Usage: migrate-money-pages --slug <slug> --scraped-dir <dir> [--domain <d>] [--limit N]')
    process.exit(1)
  }
  return { slug, scrapedDir, domain: out.domain, limit: out.limit ? Number(out.limit) : undefined }
}

interface BaseScrape {
  url?: string
  slug: string
  title?: string
  h1?: string | null
  page_type: 'top10' | 'product' | 'business' | 'unknown'
  meta_description?: string | null
  og_description?: string | null
  published_at?: string | null
  last_updated?: string | null
  raw_html_sample?: string | null
  scrape?: {
    fetched_at?: string
    http_status?: number
    content_hash?: string
    html_bytes?: number
  }
}

interface Top10Scrape extends BaseScrape {
  page_type: 'top10'
  top10: {
    category_singular?: string | null
    category_plural?: string | null
    intro?: string | null
    conclusion?: string | null
    products: Array<{
      rank: number
      name: string
      image_url?: string | null
      description?: string | null
      affiliate_url?: string | null
      affiliate_network?: string | null
    }>
    faq?: Array<{ question: string; answer_html: string }>
  }
}

interface ProductScrape extends BaseScrape {
  page_type: 'product'
  product: {
    category?: string | null
    name?: string | null
    intro?: string | null
    rating?: number | null
    rating_out_of?: number | null
    image_url?: string | null
    affiliate_url?: string | null
    affiliate_network?: string | null
    affiliate_cta?: string | null
    specs?: Array<{ label: string; value: string }>
    description?: string | null
    pros?: string[]
    cons?: string[]
  }
}

interface BusinessScrape extends BaseScrape {
  page_type: 'business'
  business: {
    name?: string | null
    city?: string | null
    address?: string | null
    website_url?: string | null
    google_maps_url?: string | null
    intro?: string | null
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(current, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile() && e.name.endsWith('.json')) out.push(p)
    }
  }
  await walk(dir)
  return out
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
        `[migrate-money-pages] reusing existing tenant matched by domain (slug='${t.slug}'). Pass --slug ${t.slug} next time to skip this lookup.`,
      )
    }
  }

  if (!tenant) {
    if (!args.domain) {
      throw new Error(
        `Tenant '${args.slug}' not found. Pass --domain to auto-create it, or run migrate:wxr first.`,
      )
    }
    console.log(`[migrate-money-pages] creating tenants row '${args.slug}'`)
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

  const files = await listJsonFiles(resolveUserPath(args.scrapedDir))
  console.log(`[migrate-money-pages] tenant=${args.slug}, files=${files.length}`)

  let top10s = 0
  let products = 0
  let businesses = 0
  let skipped = 0

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8')
    let doc: BaseScrape
    try {
      doc = JSON.parse(raw)
    } catch (err) {
      console.warn(`[migrate-money-pages] bad JSON: ${file}`, err)
      skipped++
      continue
    }
    if (!doc.slug) {
      skipped++
      continue
    }

    if (doc.page_type === 'top10') {
      const d = doc as Top10Scrape
      const data = {
        tenant: tenantId,
        title: d.title ?? d.slug,
        slug: d.slug,
        h1: d.h1 ?? undefined,
        categorySingular: d.top10.category_singular ?? undefined,
        categoryPlural: d.top10.category_plural ?? undefined,
        intro: d.top10.intro ?? undefined,
        conclusion: d.top10.conclusion ?? undefined,
        metaDescription: d.meta_description ?? undefined,
        ogDescription: d.og_description ?? undefined,
        publishedAt: d.published_at ?? undefined,
        lastUpdated: d.last_updated ?? undefined,
        products: d.top10.products.map((p) => ({
          rank: p.rank,
          name: p.name,
          imageUrl: p.image_url ?? undefined,
          description: p.description ?? undefined,
          affiliateUrl: p.affiliate_url ?? undefined,
          affiliateNetwork: (p.affiliate_network ?? undefined) as never,
        })),
        faq: (d.top10.faq ?? []).map((f) => ({
          question: f.question,
          answerHtml: f.answer_html,
        })),
      } as never

      await upsert(payload, 'top10s', tenantId, d.slug, data)
      top10s++
    } else if (doc.page_type === 'product') {
      const d = doc as ProductScrape
      const data = {
        tenant: tenantId,
        name: d.product.name ?? d.title ?? d.slug,
        slug: d.slug,
        title: d.title ?? undefined,
        category: d.product.category ?? undefined,
        intro: d.product.intro ?? undefined,
        description: d.product.description ?? undefined,
        rating: d.product.rating ?? undefined,
        ratingOutOf: d.product.rating_out_of ?? undefined,
        imageUrl: d.product.image_url ?? undefined,
        affiliateUrl: d.product.affiliate_url ?? undefined,
        affiliateNetwork: (d.product.affiliate_network ?? undefined) as never,
        affiliateCta: d.product.affiliate_cta ?? undefined,
        specs: (d.product.specs ?? []).map((s) => ({ label: s.label, value: s.value })),
        pros: (d.product.pros ?? []).map((value) => ({ value })),
        cons: (d.product.cons ?? []).map((value) => ({ value })),
        metaDescription: d.meta_description ?? undefined,
        ogDescription: d.og_description ?? undefined,
        publishedAt: d.published_at ?? undefined,
        lastUpdated: d.last_updated ?? undefined,
      } as never

      await upsert(payload, 'products', tenantId, d.slug, data)
      products++
    } else if (doc.page_type === 'business') {
      const d = doc as BusinessScrape
      const data = {
        tenant: tenantId,
        name: d.business.name ?? d.title ?? d.slug,
        slug: d.slug,
        title: d.title ?? undefined,
        city: d.business.city ?? undefined,
        address: d.business.address ?? undefined,
        websiteUrl: d.business.website_url ?? undefined,
        googleMapsUrl: d.business.google_maps_url ?? undefined,
        intro: d.business.intro ?? undefined,
        metaDescription: d.meta_description ?? undefined,
        ogDescription: d.og_description ?? undefined,
        publishedAt: d.published_at ?? undefined,
        lastUpdated: d.last_updated ?? undefined,
      } as never

      await upsert(payload, 'businesses', tenantId, d.slug, data)
      businesses++
    } else {
      skipped++
    }

    if (args.limit && top10s + products + businesses >= args.limit) {
      console.log('[migrate-money-pages] reached --limit')
      break
    }
  }

  console.log(
    `[migrate-money-pages] done. top10s=${top10s} products=${products} businesses=${businesses} skipped=${skipped}`
  )
  process.exit(0)
}

async function upsert(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  tenantId: string | number,
  slug: string,
  data: Record<string, unknown>
): Promise<void> {
  const existing = await payload.find({
    collection: collection as never,
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
  })
  if (existing.docs[0]) {
    await payload.update({
      collection: collection as never,
      id: (existing.docs[0] as { id: string | number }).id,
      data: data as never,
    })
  } else {
    await payload.create({ collection: collection as never, data: data as never })
  }
}

main().catch((err) => {
  const inner = (err as { data?: { errors?: unknown } } | null)?.data?.errors
  if (inner) {
    console.error('[migrate-money-pages] failed:', err)
    console.error('  validation details:', JSON.stringify(inner, null, 2))
  } else {
    console.error('[migrate-money-pages] failed:', err)
  }
  process.exit(1)
})
