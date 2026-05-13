import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { NavMenu, TenantConfig, ThemeTokens } from '@astropayload/core'

import { PayloadClient, type PayloadClientOptions } from './client'
import {
  formatBlogMarkdown,
  formatBusinessJson,
  formatPageMarkdown,
  formatProductJson,
  formatTop10Json,
  type FormattedFile,
} from './formatters'

export interface SyncOptions extends PayloadClientOptions {
  /** Root of the tenant Astro app (e.g. apps/sites/keukenfaqs). */
  siteRoot: string
  /** When true, delete existing synced content first. Default true. */
  clean?: boolean
  /** Optionally restrict to a subset of collections. Default: all. */
  collections?: Array<'blog' | 'pages' | 'top10' | 'product' | 'business' | 'redirects' | 'nav'>
}

/**
 * Pull a single tenant's slice of Payload data and write it into the local
 * filesystem in the exact shape today's keukenfaqs-main `astro:content`
 * collections expect:
 *
 *   src/content/blog/<slug>.md
 *   src/content/pages/<slug>.md
 *   src/data/money-pages/top10/<slug>.json
 *   src/data/money-pages/product/<slug>.json
 *   src/data/money-pages/business/<slug>.json
 *   tenant.config.json
 *   public/_redirects     (Cloudflare-style)
 */
export async function syncTenantContent(opts: SyncOptions): Promise<{
  blog: number
  pages: number
  top10: number
  product: number
  business: number
  redirects: number
}> {
  const client = new PayloadClient(opts)
  const wanted = new Set(opts.collections ?? ['blog', 'pages', 'top10', 'product', 'business', 'redirects', 'nav'])

  const siteRoot = path.resolve(opts.siteRoot)
  await mkdir(siteRoot, { recursive: true })

  // 1. Tenant config (theme tokens, GA4 id, nav menus, ...)
  const tenant = await client.findTenant<RawTenant>()
  const navMenus = wanted.has('nav') ? await fetchNavMenus(client) : []
  const tenantConfig = toTenantConfig(tenant, navMenus)
  await writeFile(
    path.join(siteRoot, 'tenant.config.json'),
    JSON.stringify(tenantConfig, null, 2) + '\n',
    'utf8'
  )

  // 2. Content collections
  const counts = { blog: 0, pages: 0, top10: 0, product: 0, business: 0, redirects: 0 }

  if (wanted.has('blog')) {
    const dir = path.join(siteRoot, 'src/content/blog')
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const docs = await client.findAll<Parameters<typeof formatBlogMarkdown>[0]>('blog-posts')
    await Promise.all(docs.map((d) => writeFormatted(dir, formatBlogMarkdown(d))))
    counts.blog = docs.length
  }

  if (wanted.has('pages')) {
    const dir = path.join(siteRoot, 'src/content/pages')
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const docs = await client.findAll<Parameters<typeof formatPageMarkdown>[0]>('pages')
    await Promise.all(docs.map((d) => writeFormatted(dir, formatPageMarkdown(d))))
    counts.pages = docs.length
  }

  if (wanted.has('top10')) {
    const dir = path.join(siteRoot, 'src/data/money-pages/top10')
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const docs = await client.findAll<Parameters<typeof formatTop10Json>[0]>('top10s')
    await Promise.all(docs.map((d) => writeFormatted(dir, formatTop10Json(d, tenant.domain))))
    counts.top10 = docs.length
  }

  if (wanted.has('product')) {
    const dir = path.join(siteRoot, 'src/data/money-pages/product')
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const docs = await client.findAll<Parameters<typeof formatProductJson>[0]>('products')
    await Promise.all(docs.map((d) => writeFormatted(dir, formatProductJson(d, tenant.domain))))
    counts.product = docs.length
  }

  if (wanted.has('business')) {
    const dir = path.join(siteRoot, 'src/data/money-pages/business')
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const docs = await client.findAll<Parameters<typeof formatBusinessJson>[0]>('businesses')
    await Promise.all(docs.map((d) => writeFormatted(dir, formatBusinessJson(d, tenant.domain))))
    counts.business = docs.length
  }

  if (wanted.has('redirects')) {
    const redirects = await client.findAll<{
      from: string
      to: string
      status: string
    }>('redirects')
    const lines = redirects.map((r) => `${r.from} ${r.to} ${r.status}`).join('\n')
    const publicDir = path.join(siteRoot, 'public')
    await mkdir(publicDir, { recursive: true })
    await writeFile(path.join(publicDir, '_redirects'), lines + '\n', 'utf8')
    counts.redirects = redirects.length
  }

  return counts
}

async function fetchNavMenus(client: PayloadClient): Promise<NavMenu[]> {
  type Raw = {
    name: string
    location: NavMenu['location']
    items?: Array<{ label: string; href: string; rel?: string; children?: Array<{ label: string; href: string; rel?: string }> }>
  }
  const docs = await client.findAll<Raw>('nav-menus', { limit: 10 })
  return docs.map((d) => ({
    name: d.name,
    location: d.location,
    items: (d.items ?? []).map((i) => ({
      label: i.label,
      href: i.href,
      rel: i.rel,
      children: i.children?.map((c) => ({ label: c.label, href: c.href, rel: c.rel })),
    })),
  }))
}

async function writeFormatted(dir: string, f: FormattedFile): Promise<void> {
  await writeFile(path.join(dir, f.filename), f.body, 'utf8')
}

interface RawTenant {
  id: string
  slug: string
  name: string
  domain: string
  locale: string
  siteTitle: string
  siteDescription: string
  titleSuffix?: string | null
  robots?: string | null
  logo?: { url?: string } | null
  favicon?: { url?: string } | null
  ogImage?: { url?: string } | null
  themeTokens?: ThemeTokens | null
  ga4Id?: string | null
  gtmId?: string | null
  plausibleDomain?: string | null
  bolPublisherId?: string | null
  awinId?: string | null
  amazonTag?: string | null
  socialLinks?: Array<{ platform: string; url: string }> | null
}

function toTenantConfig(t: RawTenant, navMenus: NavMenu[]): TenantConfig {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    domain: t.domain,
    url: `https://${t.domain}`,
    locale: t.locale,
    logo: t.logo?.url ?? null,
    favicon: t.favicon?.url ?? null,
    ogImage: t.ogImage?.url ?? null,
    themeTokens: t.themeTokens ?? {},
    siteTitle: t.siteTitle,
    siteDescription: t.siteDescription,
    titleSuffix: t.titleSuffix ?? null,
    robots: t.robots ?? null,
    ga4Id: t.ga4Id ?? null,
    gtmId: t.gtmId ?? null,
    plausibleDomain: t.plausibleDomain ?? null,
    bolPublisherId: t.bolPublisherId ?? null,
    awinId: t.awinId ?? null,
    amazonTag: t.amazonTag ?? null,
    socialLinks: (t.socialLinks ?? []).map((s) => ({
      platform: s.platform as TenantConfig['socialLinks'][number]['platform'],
      url: s.url,
    })),
    navMenus,
    syncedAt: new Date().toISOString(),
  }
}
