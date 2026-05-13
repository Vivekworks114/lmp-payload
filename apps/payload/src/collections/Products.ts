import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'
import { seoFields, slugField } from './_shared'

/** Single-product review page (the `product` variant in the keukenfaqs schema). */
export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Product Review', plural: 'Product Reviews' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'category', 'rating', 'updatedAt'],
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
    { name: 'category', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'description', type: 'textarea' },
    { name: 'rating', type: 'number' },
    { name: 'ratingOutOf', type: 'number', defaultValue: 10 },
    { name: 'imageUrl', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'affiliateUrl', type: 'text' },
    {
      name: 'affiliateNetwork',
      type: 'select',
      options: ['bol', 'awin', 'amazon', 'other'],
    },
    { name: 'affiliateCta', type: 'text', defaultValue: 'Goedkoopste deal hier' },
    {
      name: 'specs',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
      ],
    },
    {
      name: 'pros',
      type: 'array',
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'cons',
      type: 'array',
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    { name: 'metaDescription', type: 'textarea' },
    { name: 'ogDescription', type: 'textarea' },
    { name: 'publishedAt', type: 'text' },
    { name: 'lastUpdated', type: 'text' },
    seoFields(),
  ],
}
