/**
 * Shared helpers for blog content files (.md and .mdx) in Astro repos.
 */

import { resolveBlogSlug, sanitizeBlogSlug, sanitizeMarkdownForAstro } from '@astropayload/payload-sdk/formatters'

import { markdownToLexicalState } from './markdownToLexical'

export type BlogFileExtension = 'md' | 'mdx'

export const BLOG_FILE_EXTENSIONS: readonly BlogFileExtension[] = ['md', 'mdx']

const KNOWN_KEYS = new Set([
  'title',
  'description',
  'excerpt',
  'pubDate',
  'updatedDate',
  'author',
  'heroImage',
  'categories',
  'tags',
  'slug',
  'date',
])

export function normalizeBlogFileExtension(value?: string | null): BlogFileExtension {
  return value === 'mdx' ? 'mdx' : 'md'
}

export function isBlogContentFilename(filename: string): boolean {
  return BLOG_FILE_EXTENSIONS.some((ext) => filename.endsWith(`.${ext}`))
}

export function slugFromBlogFilename(filename: string): string | null {
  for (const ext of BLOG_FILE_EXTENSIONS) {
    if (filename.endsWith(`.${ext}`)) return filename.slice(0, -(ext.length + 1))
  }
  return null
}

/** One file per slug; prefer `.mdx` when both exist. */
export function listBlogContentFilenames(entries: string[], limit?: number): string[] {
  const bySlug = new Map<string, string>()
  for (const file of entries) {
    if (!isBlogContentFilename(file)) continue
    const slug = slugFromBlogFilename(file)
    if (!slug) continue
    const prev = bySlug.get(slug)
    if (!prev || file.endsWith('.mdx')) bySlug.set(slug, file)
  }
  const files = [...bySlug.values()].sort()
  if (limit === undefined) return files
  return files.slice(0, limit)
}

export function countBlogContentFilenames(entries: string[]): number {
  return listBlogContentFilenames(entries).length
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

function nonEmptyString(value: unknown): string | undefined {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Plain-text excerpt for imports when frontmatter omits description. */
function excerptFromBody(body: string, maxLen = 500): string | undefined {
  const text = body
    .replace(/^#+\s+.*$/gm, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1).trim()}…`
}

function resolveImportDescription(
  known: Record<string, unknown>,
  extra: Record<string, unknown>,
  body: string,
  title: string,
): string {
  const candidates = [
    known.description,
    known.excerpt,
    extra.excerpt,
    extra.summary,
    extra.metaDescription,
    excerptFromBody(body),
    title,
  ]
  for (const candidate of candidates) {
    const value = nonEmptyString(candidate)
    if (value) return value.slice(0, 500)
  }
  return title.slice(0, 500) || 'Blog post'
}

export function blogPostDataFromFile(
  raw: string,
  slug: string,
  tenantId: string | number,
): Record<string, unknown> {
  const { data, body: rawBody } = parseFrontmatter(raw)
  const { known, extra } = splitKnown(data)
  const title = nonEmptyString(known.title) ?? slug
  const description = resolveImportDescription(known, extra, rawBody, title)
  const body = sanitizeMarkdownForAstro(rawBody, { title })
  const pubDate = known.pubDate
    ? new Date(String(known.pubDate)).toISOString()
    : new Date().toISOString()

  const categories = Array.isArray(known.categories)
    ? (known.categories as string[]).map((value) => ({ value }))
    : []
  const tags = Array.isArray(known.tags) ? (known.tags as string[]).map((value) => ({ value })) : []

  const fileSlug = sanitizeBlogSlug(slug)
  const postSlug = known.slug
    ? sanitizeBlogSlug(String(known.slug))
    : fileSlug

  return {
    tenant: tenantId,
    title,
    slug: postSlug,
    description,
    pubDate,
    updatedDate: known.updatedDate ? new Date(String(known.updatedDate)).toISOString() : undefined,
    author: known.author ? String(known.author) : undefined,
    categories,
    tags,
    extra: Object.keys(extra).length ? extra : undefined,
    content: markdownToLexicalState(body),
  }
}
