import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { TenantConfig, ThemeTokens } from '@astropayload/core'

import { PayloadClient, type PayloadClientOptions } from './client'
import { liveBlogPostsWhere } from './blogPublishSchedule'
import { buildWhereSearchParams } from './buildWhereParams'
import { formatBlogMarkdown, type BlogFileExtension, type FormattedFile } from './formatters'

export interface SyncOptions extends PayloadClientOptions {
  /** Root of the tenant Astro app (e.g. apps/sites/keukenfaqs). */
  siteRoot: string
  /** When true, delete existing synced blog content first. Default true. */
  clean?: boolean
  /** Relative path for blog markdown. Default `src/content/blog`. */
  blogContentPath?: string
  /** When false, skip blog sync. Default true. */
  syncBlog?: boolean
}

/**
 * Pull a tenant's blog posts + site identity from Payload and write:
 *   src/content/blog/<slug>.md|.mdx
 *   tenant.config.json
 */
export async function syncTenantContent(opts: SyncOptions): Promise<{ blog: number }> {
  const client = new PayloadClient(opts)
  const siteRoot = path.resolve(opts.siteRoot)
  await mkdir(siteRoot, { recursive: true })

  const tenant = await client.findTenant<RawTenant>()
  const tenantConfig = toTenantConfig(tenant)
  await writeFile(
    path.join(siteRoot, 'tenant.config.json'),
    JSON.stringify(tenantConfig, null, 2) + '\n',
    'utf8',
  )

  let blogCount = 0
  if (opts.syncBlog !== false) {
    const blogRel = opts.blogContentPath?.replace(/^\/+/, '') || 'src/content/blog'
    const dir = path.join(siteRoot, blogRel)
    if (opts.clean !== false) await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })

    const ext: BlogFileExtension =
      (tenant as RawTenant).blogFileExtension === 'mdx' ? 'mdx' : 'md'
    const blogWhere = liveBlogPostsWhere()
    const queryPreview = buildWhereSearchParams({
      ...blogWhere,
      tenant: { equals: '(tenant-id)' },
    }).toString()
    console.log(
      `[payload-sdk sync] blog-posts filter: publishStatus=published, pubDate<=now (excludes draft & scheduled). Query: ${queryPreview}`,
    )
    const docs = await client.findAll<Parameters<typeof formatBlogMarkdown>[0]>('blog-posts', {
      where: blogWhere,
    })
    const fallbackFeaturedImage =
      (tenant as RawTenant).ogImage?.url ??
      (tenant as RawTenant).logo?.url ??
      (tenant as RawTenant).favicon?.url ??
      null
    await Promise.all(
      docs.map((d) =>
        writeFormatted(dir, formatBlogMarkdown(d, ext, { fallbackFeaturedImage })),
      ),
    )
    blogCount = docs.length
  }

  return { blog: blogCount }
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
  socialLinks?: Array<{ platform: string; url: string }> | null
  blogFileExtension?: BlogFileExtension | null
}

function toTenantConfig(t: RawTenant): TenantConfig {
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
    bolPublisherId: null,
    awinId: null,
    amazonTag: null,
    socialLinks: (t.socialLinks ?? []).map((s) => ({
      platform: s.platform as TenantConfig['socialLinks'][number]['platform'],
      url: s.url,
    })),
    navMenus: [],
    syncedAt: new Date().toISOString(),
  }
}
