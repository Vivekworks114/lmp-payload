import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { encryptSecret } from '../lib/credentialEncryption'

export const GithubCredentials: CollectionConfig = {
  slug: 'github-credentials',
  labels: { singular: 'GitHub credential', plural: 'GitHub credentials' },
  admin: {
    useAsTitle: 'label',
    group: 'Platform',
    description:
      'Encrypted GitHub PATs for external client repositories. Tenants without a credential use platform tokens (EXTERNAL_REPO_GITHUB_TOKEN / GITHUB_TOKEN).',
    hidden: ({ user }) => !isSuperAdmin(user),
    defaultColumns: ['label', 'githubOwner', 'tokenLast4', 'lastValidatedAt'],
  },
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const row = data as Record<string, unknown>
        const token = typeof row.token === 'string' ? row.token.trim() : ''
        if (token) {
          row.tokenEncrypted = encryptSecret(token)
          row.tokenLast4 = token.length >= 4 ? token.slice(-4) : token
        }
        return row
      },
    ],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "zbseollp production" — shown when linking a tenant.',
      },
    },
    {
      name: 'githubOwner',
      type: 'text',
      admin: {
        description: 'Optional GitHub user or org (for your notes).',
      },
    },
    {
      name: 'token',
      type: 'text',
      virtual: true,
      admin: {
        description:
          'Personal access token (write-only, not stored). Leave blank when editing to keep the existing token.',
      },
    },
    {
      name: 'tokenLast4',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Last four characters of the stored token.',
      },
    },
    {
      name: 'tokenEncrypted',
      type: 'text',
      access: {
        read: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Scopes, expiry, rotation notes.' },
    },
    {
      name: 'lastValidatedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'lastValidationError',
      type: 'text',
      admin: { readOnly: true },
    },
  ],
}
