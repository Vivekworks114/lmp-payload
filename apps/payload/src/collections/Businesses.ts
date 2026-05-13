import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'
import { seoFields, slugField } from './_shared'

/** Retailer / store directory entry (the `business` variant). */
export const Businesses: CollectionConfig = {
  slug: 'businesses',
  labels: { singular: 'Business', plural: 'Businesses' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'slug', 'updatedAt'],
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
    { name: 'name', type: 'text', required: true },
    { name: 'title', type: 'text' },
    slugField(),
    { name: 'city', type: 'text', index: true },
    { name: 'address', type: 'text' },
    { name: 'websiteUrl', type: 'text' },
    { name: 'googleMapsUrl', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'ogDescription', type: 'textarea' },
    { name: 'publishedAt', type: 'text' },
    { name: 'lastUpdated', type: 'text' },
    seoFields(),
  ],
}
