import type { Field, CollectionBeforeChangeHook } from 'payload'

/** SEO metadata fields shared across content collections. */
export const seoFields = (): Field => ({
  name: 'seo',
  type: 'group',
  admin: {
    description: 'Per-page SEO overrides. Falls back to the tenant defaults when blank.',
  },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'ogImage', type: 'upload', relationTo: 'media' },
    { name: 'robots', type: 'text', admin: { description: 'e.g. noindex,follow' } },
    {
      name: 'canonicalUrl',
      type: 'text',
      admin: { description: 'Override canonical URL if different from this site.' },
    },
  ],
})

/** Slug field with index for fast (tenant, slug) lookups. */
export const slugField = (description?: string): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: { description: description ?? 'URL slug. Lowercase, hyphens only.' },
})

/**
 * Notify the webhook receiver after a content row is created or updated so
 * the right tenant gets a rebuild. The hook is best-effort: errors are
 * logged but never block the save.
 */
export const notifyWebhook: CollectionBeforeChangeHook = async () => {
  // Real implementation lives in `src/hooks/notifyWebhook.ts` and is wired up
  // by each collection's `hooks.afterChange`. This export is kept here only
  // to centralise the import path.
  return
}
