import fs from 'node:fs/promises'
import path from 'node:path'

import { PayloadClient } from '@astropayload/payload-sdk'

import {
  type ImportBlogFromRepoOptions,
  type ImportBlogFromRepoResult,
  resolveSitePath,
} from './importBlogFromRepo'
import { markdownToLexicalState } from './markdownToLexical'

const KNOWN_KEYS = new Set([
  'title',
  'description',
  'pubDate',
  'updatedDate',
  'author',
  'heroImage',
  'categories',
  'tags',
])

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match?.[1] || match[2] === undefined) return { data: {}, body: raw.trim() }
  const data: Record<string, unknown> = {}
  const block = match[1]
  const body = match[2].trim()
  let currentList: string | null = null

  for (const line of block.split('\n')) {
    const listItem = line.match(/^\s+-\s+(.+)$/)
    if (listItem?.[1] && currentList) {
      const arr = (data[currentList] as string[]) ?? []
      arr.push(listItem[1].replace(/^["']|["']$/g, ''))
      data[currentList] = arr
      continue
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (!kv?.[1]) continue
    const key = kv[1]
    const value = kv[2] ?? ''
    if (value === '') {
      currentList = key
      data[key] = []
      continue
    }
    currentList = null
    data[key] = value.replace(/^["']|["']$/g, '')
  }
  return { data, body }
}

function splitKnown(data: Record<string, unknown>) {
  const known: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (KNOWN_KEYS.has(k)) known[k] = v
    else extra[k] = v
  }
  return { known, extra }
}

export interface ImportBlogViaApiOptions extends ImportBlogFromRepoOptions {
  url: string
  apiKey: string
}

/**
 * Import repo markdown into Payload over HTTPS (no direct Postgres).
 * Used from GitHub Actions with PAYLOAD_URL + PAYLOAD_API_KEY only.
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

  const files = entries.filter((f) => f.endsWith('.md')).slice(0, options.limit ?? entries.length)
  let created = 0
  let updated = 0

  for (const file of files) {
    const raw = await fs.readFile(path.join(blogDir, file), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    const { known, extra } = splitKnown(data)
    const slug = file.replace(/\.md$/, '')
    const title = String(known.title ?? slug)
    const description = String(known.description ?? title).slice(0, 500)
    const pubDate = known.pubDate
      ? new Date(String(known.pubDate)).toISOString()
      : new Date().toISOString()

    const categories = Array.isArray(known.categories)
      ? (known.categories as string[]).map((value) => ({ value }))
      : []
    const tags = Array.isArray(known.tags) ? (known.tags as string[]).map((value) => ({ value })) : []

    const baseData: Record<string, unknown> = {
      tenant: tenantId,
      title,
      slug,
      description,
      pubDate,
      updatedDate: known.updatedDate ? new Date(String(known.updatedDate)).toISOString() : undefined,
      author: known.author ? String(known.author) : undefined,
      categories,
      tags,
      extra: Object.keys(extra).length ? extra : undefined,
      content: markdownToLexicalState(body),
    }

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

  const mdCount = entries.filter((f) => f.endsWith('.md')).length
  if (mdCount === 0) {
    return { skipped: true, reason: `no .md files in ${blogDir}` }
  }

  const result = await importBlogFromRepoViaApi(options)
  return { skipped: false, result }
}
