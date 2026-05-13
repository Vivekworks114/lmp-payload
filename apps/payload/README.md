# @astropayload/payload

Single Payload v3 CMS that powers every tenant site.

## Stack

- **Payload v3** on Next.js 15 (App Router)
- **Postgres** via `@payloadcms/db-postgres` (Neon recommended for prod)
- **Cloudflare R2** via `@payloadcms/storage-s3` (with `tenants/<slug>/` prefix per upload)
- **Lexical** rich text editor
- **`@payloadcms/plugin-multi-tenant`** scoping every content collection by tenant

## Setup

```sh
cp .env.example .env
# fill in DATABASE_URI, PAYLOAD_SECRET, R2_* values

pnpm install
pnpm dev                       # http://localhost:3000/admin
pnpm payload generate:types    # regenerate src/payload-types.ts
```

The first time you boot, Payload's `push: true` (dev only) will create all tables. In production, use `payload migrate:create` + `payload migrate` instead.

## Collections

| Slug          | Scope     | Purpose                                                                  |
| ------------- | --------- | ------------------------------------------------------------------------ |
| `tenants`     | global    | One row per site. Domain, theme tokens, analytics, affiliate config.     |
| `users`       | global    | Admin users. Role-gated and tenant-scoped via plugin.                    |
| `blog-posts`  | tenant    | Editorial articles. Matches keukenfaqs `blog` Zod schema.                |
| `pages`       | tenant    | Static pages.                                                            |
| `top10s`      | tenant    | "Top 10 beste X" affiliate roundups.                                     |
| `products`    | tenant    | Single-product reviews.                                                  |
| `businesses`  | tenant    | Retailer/store directory entries.                                        |
| `media`       | tenant    | Uploads (R2 backed, tenant-prefixed).                                    |
| `redirects`   | tenant    | URL redirects (preserved migration link equity).                         |
| `nav-menus`   | tenant    | Header/footer/mobile navigation.                                         |

## Webhooks → tenant rebuilds

Every tenant-scoped collection has `afterChange` and `afterDelete` hooks that POST to `WEBHOOK_URL` with `{ tenantSlug, collection, id, operation }`. The webhook receiver (a Cloudflare Worker) dispatches the matching GitHub Actions workflow to rebuild and re-deploy only that tenant. See [.github/workflows/tenant-deploy.yml](../../.github/workflows/tenant-deploy.yml).

## Multi-tenant plugin

`@payloadcms/plugin-multi-tenant` auto-injects a `tenant` relationship into every collection listed in `payload.config.ts`, layers a `where[tenant][in]` filter into all queries, and adds a tenant switcher to the admin UI. See: https://payloadcms.com/docs/plugins/multi-tenant.

## WordPress import

```sh
pnpm migrate:wxr -- --wxr ./export.xml --slug keukenfaqs --domain keukenfaqs.nl
pnpm migrate:money-pages -- --slug keukenfaqs --scraped-dir ../../keukenfaqs-main/migration/scraped/money-pages
```

These scripts use Payload's Local API, so they require `DATABASE_URI` and run inside the same Node process as Payload.
