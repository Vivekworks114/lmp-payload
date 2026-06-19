import { lexicalToMarkdown } from '../lexical'

import { resolveBlogSlug, sanitizeBlogSlug } from './sanitizeBlogSlug'
import { sanitizeMarkdownForAstro } from './sanitizeMarkdownForAstro'

/**
 * Frontmatter for Astro blog collections. Supports:
 *   - keukenfaqs-style: pubDate, title, description
 *   - WP / external repos: slug, date (required on some sites)
 */

interface BlogDoc {
  id: string
  title: string
  slug: string
  description: string
  pubDate: string
  updatedDate?: string | null
  author?: string | null
  heroImage?: { url?: string; alt?: string; filename?: string } | string | null
  featuredImage?: { url?: string; alt?: string; filename?: string } | string | null
  categories?: Array<{ value: string }> | null
  tags?: Array<{ value: string }> | null
  content: unknown
  extra?: Record<string, unknown> | null
}

export interface FormattedFile {
  filename: string
  body: string
}

export type BlogFileExtension = 'md' | 'mdx'

/** Frontmatter keys owned by Payload — never overridden by `extra` on export. */
const RESERVED_FRONTMATTER_KEYS = new Set([
  'title',
  'description',
  'pubDate',
  'updatedDate',
  'author',
  'heroImage',
  'featuredImage',
  'categories',
  'tags',
  'slug',
  'date',
])

export function formatBlogMarkdown(
  doc: BlogDoc,
  extension: BlogFileExtension = 'md',
): FormattedFile {
  const pubDate = normalizeFrontmatterDate(doc.pubDate)
  const frontmatter: Record<string, unknown> = {
    title: doc.title,
    description: doc.description,
    pubDate,
  }
  if (doc.updatedDate) frontmatter.updatedDate = normalizeFrontmatterDate(doc.updatedDate)
  if (doc.author) frontmatter.author = doc.author
  const hero =
    imageFrontmatterFromMedia(doc.heroImage) ?? extraStringField(doc.extra, 'heroImage')
  const featured =
    imageFrontmatterFromMedia(doc.featuredImage) ??
    extraStringField(doc.extra, 'featuredImage') ??
    hero
  if (hero) frontmatter.heroImage = hero
  if (featured) frontmatter.featuredImage = featured
  if (doc.categories?.length) {
    frontmatter.categories = doc.categories.map((c) => c.value).filter(Boolean)
  }
  if (doc.tags?.length) {
    frontmatter.tags = doc.tags.map((t) => t.value).filter(Boolean)
  }
  if (doc.extra && typeof doc.extra === 'object') {
    for (const [k, v] of Object.entries(doc.extra)) {
      if (v === undefined || v === null || RESERVED_FRONTMATTER_KEYS.has(k)) continue
      frontmatter[k] = v
    }
  }

  const slug = resolveBlogSlug(doc.slug, doc.title, doc.id)
  frontmatter.slug = slug
  if (frontmatter.date == null || frontmatter.date === '') {
    frontmatter.date = pubDate ?? normalizeFrontmatterDate(doc.pubDate)
  }

  const yaml = toYaml(frontmatter)
  const md = sanitizeMarkdownForAstro(lexicalToMarkdown(doc.content), { title: doc.title })
  return {
    filename: `${slug}.${extension}`,
    body: `---\n${yaml}---\n\n${md}`,
  }
}

/**
 * Image path or URL for markdown frontmatter from Payload media or extra JSON.
 * R2/CDN URLs (https://…) are included — most Astro themes use string frontmatter.
 */
function imageFrontmatterFromMedia(
  image?: { url?: string } | string | null,
): string | undefined {
  if (image == null) return undefined
  if (typeof image === 'string') {
    const trimmed = image.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (typeof image === 'object' && image.url) {
    const url = image.url.trim()
    return url.length > 0 ? url : undefined
  }
  return undefined
}

/** Return a non-empty string value from doc.extra[key], or undefined. */
function extraStringField(
  extra: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!extra) return undefined
  const v = extra[key]
  return typeof v === 'string' && v ? v : undefined
}

function normalizeFrontmatterDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

function toYaml(obj: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const v of value) lines.push(`  - ${quote(String(v))}`)
    } else if (value instanceof Date) {
      lines.push(`${key}: ${value.toISOString()}`)
    } else {
      lines.push(`${key}: ${quote(String(value))}`)
    }
  }
  return lines.join('\n') + '\n'
}

function quote(s: string): string {
  if (/^[\w\d:./@-]+$/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
