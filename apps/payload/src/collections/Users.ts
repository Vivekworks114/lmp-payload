import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'roles'],
    group: 'Platform',
  },
  auth: true,
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => {
      if (isSuperAdmin(req.user)) return true
      return { id: { equals: req.user?.id } }
    },
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => {
      if (isSuperAdmin(req.user)) return true
      return { id: { equals: req.user?.id } }
    },
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['editor'],
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'Tenant Admin', value: 'tenant-admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: {
        update: ({ req }) => isSuperAdmin(req.user),
      },
    },
    // tenants[] is auto-added by @payloadcms/plugin-multi-tenant.
  ],
}
