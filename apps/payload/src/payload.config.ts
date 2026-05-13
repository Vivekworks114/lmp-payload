import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { BlogPosts } from './collections/BlogPosts'
import { Pages } from './collections/Pages'
import { Top10s } from './collections/Top10s'
import { Products } from './collections/Products'
import { Businesses } from './collections/Businesses'
import { Media } from './collections/Media'
import { Redirects } from './collections/Redirects'
import { NavMenus } from './collections/NavMenus'
import { isSuperAdmin } from './access/isSuperAdmin'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ' — astropayload',
    },
  },

  collections: [
    Tenants,
    Users,
    BlogPosts,
    Pages,
    Top10s,
    Products,
    Businesses,
    Media,
    Redirects,
    NavMenus,
  ],

  editor: lexicalEditor({}),

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    push: process.env.NODE_ENV !== 'production',
  }),

  // Filesystem fallback for local dev; R2 is wired below via the s3Storage plugin.
  sharp,

  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL,

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  plugins: [
    // Scope every content collection to a tenant. The plugin auto-injects a
    // `tenant` relationship and filters API queries so editors only see their
    // tenant's data. Super admins (role includes 'super-admin') see all.
    multiTenantPlugin({
      collections: {
        'blog-posts': {},
        pages: {},
        top10s: {},
        products: {},
        businesses: {},
        media: {},
        redirects: {},
        'nav-menus': {},
      },
      tenantField: {
        name: 'tenant',
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
    }),

    // R2 storage is only attached when all required env vars are set, so local
    // dev can run without Cloudflare credentials (media falls back to disk).
    ...(process.env.R2_BUCKET &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
      ? [
          s3Storage({
            collections: {
              media: {
                prefix: 'tenants',
              },
            },
            bucket: process.env.R2_BUCKET,
            config: {
              endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
              region: 'auto',
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
              },
            },
          }),
        ]
      : []),
  ],
})
