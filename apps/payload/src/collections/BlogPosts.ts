import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'
import { seoFields, slugField } from './_shared'

/**
 * Mirrors keukenfaqs-main src/content.config.ts `blog` schema so the sync
 * pipeline emits identical Markdown frontmatter.
 */
export const BlogPosts: CollectionConfig = {
  slug: 'blog-posts',
  labels: { singular: 'Blog Post', plural: 'Blog Posts' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'pubDate', 'updatedAt'],
    group: 'Content',
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
    { name: 'description', type: 'textarea', required: true },
    { name: 'pubDate', type: 'date', required: true },
    { name: 'updatedDate', type: 'date' },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'author', type: 'text' },
    {
      name: 'categories',
      type: 'array',
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'tags',
      type: 'array',
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    seoFields(),
  ],
}
