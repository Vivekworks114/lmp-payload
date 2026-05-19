import fs from 'node:fs/promises'
import path from 'node:path'

import { PayloadClient } from '@astropayload/payload-sdk'

import {
  blogPostDataFromFile,
  countBlogContentFilenames,
  listBlogContentFilenames,
  slugFromBlogFilename,
} from './blogContentFiles'
import {
  type ImportBlogFromRepoOptions,
  type ImportBlogFromRepoResult,
  resolveSitePath,
} from './importBlogFromRepo'

export interface ImportBlogViaApiOptions extends ImportBlogFromRepoOptions {
  url: string
  apiKey: string
}

/**
 * Import repo markdown/MDX into Payload over HTTPS (no direct Postgres).
 */
export async function importBlogFromRepoViaApi(
  options: ImportBlogViaApiOptions,
): Promise<ImportBlogFromRepoResult> {
  const client = new PayloadClient({
    url: options.url,
    apiKey: options.apiKey,
    tenantSlug: options.tenantSlug,
  })

  const tenantId = await client.resolveTenantId()
  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)

  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    throw new Error(`Blog directory not found: ${blogDir}`)
  }

  const files = listBlogContentFilenames(entries, options.limit)
  let created = 0
  let updated = 0

  for (const file of files) {
    const slug = slugFromBlogFilename(file)!
    const raw = await fs.readFile(path.join(blogDir, file), 'utf8')
    const baseData = blogPostDataFromFile(raw, slug, tenantId)

    const existing = await client.findOne<{ id: string }>('blog-posts', {
      slug: { equals: slug },
    })

    if (existing?.id) {
      await client.update('blog-posts', existing.id, baseData)
      updated++
    } else {
      await client.create('blog-posts', baseData)
      created++
    }
  }

  if (created > 0 || updated > 0) {
    await client.update('tenants', tenantId, {
      blogImportedFromRepoAt: new Date().toISOString(),
    })
  }

  return { created, updated, fileCount: files.length, blogDir }
}

export async function autoImportBlogIfEmptyViaApi(
  options: ImportBlogViaApiOptions,
): Promise<{ skipped: boolean; reason?: string; result?: ImportBlogFromRepoResult }> {
  const client = new PayloadClient({
    url: options.url,
    apiKey: options.apiKey,
    tenantSlug: options.tenantSlug,
  })

  const existing = await client.count('blog-posts')
  if (existing > 0) {
    return { skipped: true, reason: `${existing} post(s) already in Payload` }
  }

  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)
  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    return { skipped: true, reason: `no blog folder at ${blogDir}` }
  }

  const fileCount = countBlogContentFilenames(entries)
  if (fileCount === 0) {
    return { skipped: true, reason: `no .md or .mdx files in ${blogDir}` }
  }

  const result = await importBlogFromRepoViaApi(options)
  return { skipped: false, result }
}
