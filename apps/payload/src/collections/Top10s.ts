import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'
import { seoFields, slugField } from './_shared'

/**
 * "Top 10 beste X" affiliate roundup pages. Matches the `top10` discriminated
 * union variant in keukenfaqs-main src/content.config.ts.
 */
export const Top10s: CollectionConfig = {
  slug: 'top10s',
  labels: { singular: 'Top 10 Roundup', plural: 'Top 10 Roundups' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'categorySingular', 'updatedAt'],
    group: 'Money Pages',
  },
  access: {
    read: publicRead,
    create: authenticatedRead,
    update: authenticatedRead,
    delete: authenticatedRead,
  },
  hooks: {
    afterChange: [afterChangeNotify],
    afterDelete: [afterDeleteNotify],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    { name: 'h1', type: 'text' },
    { name: 'categorySingular', type: 'text' },
    { name: 'categoryPlural', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'conclusion', type: 'textarea' },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'ogDescription', type: 'textarea' },
    { name: 'publishedAt', type: 'text', admin: { description: 'Human-readable, e.g. "2 jan. 2026".' } },
    { name: 'lastUpdated', type: 'text' },
    {
      name: 'products',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Product', plural: 'Products' },
      fields: [
        { name: 'rank', type: 'number', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'imageUrl', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'affiliateUrl', type: 'text' },
        {
          name: 'affiliateNetwork',
          type: 'select',
          options: ['bol', 'awin', 'amazon', 'other'],
        },
      ],
    },
    {
      name: 'faq',
      type: 'array',
      labels: { singular: 'FAQ item', plural: 'FAQ' },
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answerHtml', type: 'textarea', required: true },
      ],
    },
    seoFields(),
  ],
}
