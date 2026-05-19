import fs from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'

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

export interface ImportBlogFromRepoOptions {
  tenantSlug: string
  siteRoot: string
  blogPath?: string
  limit?: number
}

export interface ImportBlogFromRepoResult {
  created: number
  updated: number
  fileCount: number
  blogDir: string
}

export function resolveSitePath(siteRoot: string): string {
  if (path.isAbsolute(siteRoot)) return siteRoot
  const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
  return path.resolve(base, siteRoot)
}

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

export async function countTenantBlogPosts(
  payload: Payload,
  tenantId: string | number,
): Promise<number> {
  const result = await payload.find({
    collection: 'blog-posts',
    where: { tenant: { equals: tenantId } },
    limit: 1,
  })
  return result.totalDocs
}

export async function importBlogFromRepo(
  payload: Payload,
  options: ImportBlogFromRepoOptions,
): Promise<ImportBlogFromRepoResult> {
  const blogPath = options.blogPath?.replace(/^\/+/, '') || 'src/content/blog'
  const blogDir = path.join(resolveSitePath(options.siteRoot), blogPath)

  const tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: options.tenantSlug } },
      limit: 1,
    })
  ).docs[0]
  if (!tenant) {
    throw new Error(`Tenant "${options.tenantSlug}" not found.`)
  }
  const tenantId = tenant.id

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

    const baseData = {
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
    } as never

    const existing = await payload.find({
      collection: 'blog-posts',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
    })

    if (existing.docs[0]) {
      await payload.update({ collection: 'blog-posts', id: existing.docs[0].id, data: baseData })
      updated++
    } else {
      await payload.create({ collection: 'blog-posts', data: baseData })
      created++
    }
  }

  if (created > 0 || updated > 0) {
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: { blogImportedFromRepoAt: new Date().toISOString() } as never,
      overrideAccess: true,
    })
  }

  return { created, updated, fileCount: files.length, blogDir }
}

export async function autoImportBlogIfEmpty(
  payload: Payload,
  options: ImportBlogFromRepoOptions,
): Promise<{ skipped: boolean; reason?: string; result?: ImportBlogFromRepoResult }> {
  const tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: options.tenantSlug } },
      limit: 1,
    })
  ).docs[0]
  if (!tenant) {
    throw new Error(`Tenant "${options.tenantSlug}" not found.`)
  }

  const existing = await countTenantBlogPosts(payload, tenant.id)
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

  const result = await importBlogFromRepo(payload, options)
  return { skipped: false, result }
}
