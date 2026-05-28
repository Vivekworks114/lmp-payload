/**
 * URL- and filesystem-safe blog slug for markdown filenames and frontmatter.
 */
export function sanitizeBlogSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[?:#]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
