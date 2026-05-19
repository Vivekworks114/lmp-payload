import { lexicalToMarkdown } from '../lexical'

/**
 * Mirrors keukenfaqs-main src/content.config.ts `blog` Zod schema:
 *   title, description, pubDate, updatedDate?, heroImage?, categories?, tags?, author?
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
  categories?: Array<{ value: string }> | null
  tags?: Array<{ value: string }> | null
  content: unknown
  extra?: Record<string, unknown> | null
}

export interface FormattedFile {
  filename: string
  body: string
}

export function formatBlogMarkdown(doc: BlogDoc): FormattedFile {
  const frontmatter: Record<string, unknown> = {
    title: doc.title,
    description: doc.description,
    pubDate: doc.pubDate,
  }
  if (doc.updatedDate) frontmatter.updatedDate = doc.updatedDate
  if (doc.author) frontmatter.author = doc.author
  // Astro content schema uses image() — only local asset paths work. Skip remote URLs
  // (R2/CDN); posts still render without a hero image.
  if (doc.heroImage && typeof doc.heroImage === 'object' && doc.heroImage.url) {
    const url = doc.heroImage.url
    if (!/^https?:\/\//i.test(url)) {
      frontmatter.heroImage = url
    }
  }
  if (doc.categories?.length) {
    frontmatter.categories = doc.categories.map((c) => c.value).filter(Boolean)
  }
  if (doc.tags?.length) {
    frontmatter.tags = doc.tags.map((t) => t.value).filter(Boolean)
  }
  if (doc.extra && typeof doc.extra === 'object') {
    for (const [k, v] of Object.entries(doc.extra)) {
      if (v !== undefined && v !== null && !(k in frontmatter)) {
        frontmatter[k] = v
      }
    }
  }

  const yaml = toYaml(frontmatter)
  const md = lexicalToMarkdown(doc.content)
  return {
    filename: `${doc.slug}.md`,
    body: `---\n${yaml}---\n\n${md}`,
  }
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
