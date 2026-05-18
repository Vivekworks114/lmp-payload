#!/usr/bin/env tsx
/**
 * One-time import: markdown blog posts from a connected Astro repo → Payload.
 *
 *   pnpm import:blog-from-repo -- --slug keukenfaqs --site ../client-repo --blog-path src/content/blog
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../src/payload.config'
import { markdownToLexicalState } from '../src/lib/markdownToLexical'

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

interface Args {
  slug: string
  site: string
  blogPath: string
  limit?: number
}

function resolveUserPath(p: string): string {
  if (path.isAbsolute(p)) return p
  const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
  return path.resolve(base, p)
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
    }
  }
  const slug = out.slug
  const site = out.site
  if (!slug || !site) {
    console.error('Usage: import-blog-from-repo --slug <slug> --site <repo-root> [--blog-path src/content/blog] [--limit N]')
    process.exit(1)
  }
  return {
    slug,
    site,
    blogPath: out['blog-path'] || 'src/content/blog',
    limit: out.limit ? Number(out.limit) : undefined,
  }
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

async function main(): Promise<void> {
  const args = parseArgs()
  const blogDir = path.join(resolveUserPath(args.site), args.blogPath.replace(/^\/+/, ''))
  console.log(`[import-blog] slug=${args.slug} dir=${blogDir}`)

  const payload = await getPayload({ config })
  const tenant = (
    await payload.find({
      collection: 'tenants',
      where: { slug: { equals: args.slug } },
      limit: 1,
    })
  ).docs[0]
  if (!tenant) {
    console.error(`Tenant "${args.slug}" not found.`)
    process.exit(1)
  }
  const tenantId = tenant.id

  let entries: string[]
  try {
    entries = await fs.readdir(blogDir)
  } catch {
    console.error(`Blog directory not found: ${blogDir}`)
    process.exit(1)
  }

  const files = entries.filter((f) => f.endsWith('.md')).slice(0, args.limit ?? entries.length)
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

  console.log(`[import-blog] done: ${created} created, ${updated} updated (${files.length} files)`)
}

void main()
