import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { publicRead } from '../access/tenantAccess'
import { deployEndpoint, scaffoldEndpoint } from '../endpoints/tenantActions'

/**
 * A tenant = one website. Owns its domain, theme tokens, analytics IDs,
 * affiliate config, and SEO defaults. Every other collection's rows belong
 * to exactly one tenant (enforced by @payloadcms/plugin-multi-tenant).
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'domain', 'locale'],
    group: 'Platform',
  },
  access: {
    read: publicRead,
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  endpoints: [scaffoldEndpoint, deployEndpoint],
  fields: [
    {
      name: 'actions',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/TenantActions.client#TenantActions',
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? value.trim().toLowerCase() : value,
        ],
      },
      validate: ((value: unknown) => {
        if (typeof value !== 'string' || value.length === 0) return 'Slug is required.'
        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return 'Slug must be lowercase letters, digits, and hyphens only, starting with a letter. e.g. keukenfaqs, my-second-site.'
        }
        return true
      }) as never,
      admin: {
        description:
          'Used as the tenant identifier in URLs, builds, and Wrangler project names. Lowercase letters, digits, and hyphens only — auto-normalized on save.',
      },
    },
    {
      name: 'domain',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Primary domain, e.g. keukenfaqs.nl (no protocol).',
      },
    },
    {
      name: 'locale',
      type: 'select',
      required: true,
      defaultValue: 'nl-NL',
      options: [
        { label: 'Dutch (Netherlands)', value: 'nl-NL' },
        { label: 'English (United Kingdom)', value: 'en-GB' },
        { label: 'English (United States)', value: 'en-US' },
        { label: 'German (Germany)', value: 'de-DE' },
        { label: 'French (France)', value: 'fr-FR' },
        { label: 'Spanish (Spain)', value: 'es-ES' },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Branding',
          fields: [
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'favicon',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Default Open Graph image (1200×630).' },
            },
            {
              name: 'themeTokens',
              type: 'group',
              admin: { description: 'Emitted as CSS variables in the tenant site.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'primary', type: 'text', defaultValue: '#1d3557' },
                    { name: 'primaryDark', type: 'text', defaultValue: '#0d1b2a' },
                    { name: 'accent', type: 'text', defaultValue: '#e76f51' },
                    { name: 'background', type: 'text', defaultValue: '#ffffff' },
                    { name: 'text', type: 'text', defaultValue: '#0f172a' },
                    { name: 'muted', type: 'text', defaultValue: '#6b7280' },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'fontHeading',
                      type: 'text',
                      defaultValue: 'Inter',
                    },
                    {
                      name: 'fontBody',
                      type: 'text',
                      defaultValue: 'Inter',
                    },
                    {
                      name: 'radius',
                      type: 'text',
                      defaultValue: '0.5rem',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { name: 'siteTitle', type: 'text', required: true },
            { name: 'siteDescription', type: 'textarea', required: true },
            { name: 'titleSuffix', type: 'text' },
            {
              name: 'robots',
              type: 'select',
              options: ['index,follow', 'noindex,follow', 'noindex,nofollow'],
              defaultValue: 'index,follow',
            },
          ],
        },
        {
          label: 'Analytics',
          fields: [
            { name: 'ga4Id', type: 'text', admin: { description: 'e.g. G-43H5NMZVHK' } },
            { name: 'gtmId', type: 'text' },
            { name: 'plausibleDomain', type: 'text' },
          ],
        },
        {
          label: 'Affiliate',
          fields: [
            {
              name: 'bolPublisherId',
              type: 'text',
              admin: { description: 'Bol.com Partner Programma publisher ID (s=...).' },
            },
            { name: 'awinId', type: 'text' },
            { name: 'amazonTag', type: 'text' },
          ],
        },
        {
          label: 'Social',
          fields: [
            {
              name: 'socialLinks',
              type: 'array',
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  required: true,
                  options: ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'pinterest', 'linkedin'],
                },
                { name: 'url', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Deploy',
          fields: [
            {
              name: 'cloudflareProject',
              type: 'text',
              admin: { description: 'Wrangler project name (defaults to slug).' },
            },
            {
              name: 'githubWorkflow',
              type: 'text',
              defaultValue: 'tenant-deploy.yml',
              admin: { description: 'GitHub Actions workflow file used to rebuild this tenant.' },
            },
            {
              name: 'webhookEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: 'When unchecked, content changes do NOT trigger a rebuild.' },
            },
          ],
        },
      ],
    },
  ],
}
