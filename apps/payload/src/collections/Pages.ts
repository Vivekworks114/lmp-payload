import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'
import { seoFields, slugField } from './_shared'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
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
    { name: 'description', type: 'textarea' },
    { name: 'pubDate', type: 'date' },
    { name: 'updatedDate', type: 'date' },
    { name: 'content', type: 'richText' },
    seoFields(),
  ],
}
