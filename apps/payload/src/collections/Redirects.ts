import type { CollectionConfig } from 'payload'

import { authenticatedRead, publicRead } from '../access/tenantAccess'
import { afterChangeNotify, afterDeleteNotify } from '../hooks/notifyWebhook'

/**
 * URL redirects, scoped per tenant. Covers the 27 dropped URLs from the
 * keukenfaqs migration audit and anything else we want to preserve link
 * equity for as we migrate WordPress sites.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: { singular: 'Redirect', plural: 'Redirects' },
  admin: {
    useAsTitle: 'from',
    defaultColumns: ['from', 'to', 'status'],
    group: 'SEO',
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
    {
      name: 'from',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Source path, e.g. /old-page/' },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: { description: 'Destination path or full URL.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: '301',
      options: [
        { label: '301 — Permanent', value: '301' },
        { label: '302 — Temporary', value: '302' },
        { label: '307 — Temporary (preserve method)', value: '307' },
        { label: '308 — Permanent (preserve method)', value: '308' },
      ],
    },
    {
      name: 'note',
      type: 'text',
      admin: { description: 'Optional. Why this redirect exists.' },
    },
  ],
}
