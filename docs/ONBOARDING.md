# Onboarding a new tenant

Three flavours, depending on where the content is coming from.

## 0. Prerequisites (one-time)

```sh
pnpm install
cp apps/payload/.env.example apps/payload/.env
# fill in: DATABASE_URI, PAYLOAD_SECRET, R2_*
pnpm --filter @astropayload/payload dev
# in another tab, create your super-admin user at http://localhost:3000/admin
# generate an API key for that user (Users -> your row -> "Enable API Key")
export PAYLOAD_URL=http://localhost:3000
export PAYLOAD_API_KEY=<your-api-key>
```

## A. Brand-new tenant (no existing site)

```sh
# 1. Scaffold the tenant app + Payload row in one go.
pnpm tenant-cli create --slug new-site --domain new-site.com --name "New Site"

# 2. Add content in the Payload admin (or via API).

# 3. Sync content into the tenant app and run it.
TENANT=new-site pnpm --filter @astropayload/site-new-site sync:content
TENANT=new-site pnpm --filter @astropayload/site-new-site dev
```

## B. Migrate from WordPress (WXR + scraped money pages)

The migration scripts use Payload's Local API, so the Payload dev server does **not** need to be running. They connect to the same Postgres in `apps/payload/.env`.

```sh
# 1. Scaffold the tenant code folder. migrate:wxr will create the Payload row.
pnpm tenant-cli create --slug new-site --domain new-site.com

# 2. Import WordPress posts + pages. Creates the `tenants` row if missing.
pnpm --filter @astropayload/payload run migrate:wxr \
  --wxr /path/to/wordpress-export.xml \
  --slug new-site \
  --domain new-site.com
# Tip: append `--limit 3` first for a dry run.

# 3. Import scraped money pages (one JSON per page).
pnpm --filter @astropayload/payload run migrate:money-pages \
  --slug new-site \
  --scraped-dir /path/to/scraped/money-pages

# 4. Optional: redirect-preserve dropped URLs to a sensible target.
pnpm --filter @astropayload/payload run migrate:redirects \
  --slug new-site \
  --tsv /path/to/dropped-urls.txt \
  --target /keukenzaken/

# 5. Pull everything into the tenant app and run.
TENANT=new-site pnpm --filter @astropayload/site-new-site sync:content
TENANT=new-site pnpm --filter @astropayload/site-new-site dev
```

### Direct flag reference for the migration scripts

| Script                 | Required flags                                 | Optional |
| ---------------------- | ---------------------------------------------- | -------- |
| `migrate:wxr`          | `--wxr <path>` `--slug <slug>` `--domain <d>`  | `--limit N` |
| `migrate:money-pages`  | `--slug <slug>` `--scraped-dir <dir>`          | `--limit N` |
| `migrate:redirects`    | `--slug <slug>` `--tsv <file>` `--target <p>`  |          |

## C. Deploy a tenant to production

```sh
# Locally:
TENANT=new-site pnpm tenant-cli deploy

# In CI (preferred): the Payload -> webhook -> GitHub Actions chain handles
# this automatically on every content change. See:
#   apps/webhook/        (the Cloudflare Worker receiver)
#   .github/workflows/tenant-deploy.yml
```

## Anatomy of a tenant deploy

```
Payload change saved
  -> afterChange hook (apps/payload/src/hooks/notifyWebhook.ts)
    -> POST $WEBHOOK_URL with { tenantSlug, collection, id, operation }
      -> Cloudflare Worker (apps/webhook) verifies token + dispatches
        -> GitHub Actions tenant-deploy.yml with input { tenant_slug }
          -> pnpm --filter @astropayload/site-<slug> sync:content
          -> pnpm --filter @astropayload/site-<slug> build
          -> pnpm --filter @astropayload/site-<slug> deploy   (wrangler)
            -> https://<domain> updated
```

GitHub Actions' `concurrency: tenant-deploy-${slug}` collapses a burst of saves into one deploy per tenant.

## Tenant CLI reference

```
pnpm tenant-cli create   --slug X --domain D [--name "Display"] [--template path]
pnpm tenant-cli sync     --slug X [--site path] [--url payload-url] [--api-key key]
pnpm tenant-cli migrate  --slug X --domain D [--wxr file.xml] [--scraped dir]
pnpm tenant-cli deploy   --slug X
```

Environment fallbacks:

| Flag         | Env var           |
| ------------ | ----------------- |
| `--slug`     | `TENANT`          |
| `--url`      | `PAYLOAD_URL`     |
| `--api-key`  | `PAYLOAD_API_KEY` |

## File map produced by `sync:content`

```
apps/sites/<slug>/
  tenant.config.json                        # tenant identity (name, domain, theme, GA4, ...)
  public/_redirects                         # Cloudflare-format redirect rules
  src/content/blog/<slug>.md                # blog-posts collection
  src/content/pages/<slug>.md               # pages collection
  src/data/money-pages/top10/<slug>.json    # top10s collection
  src/data/money-pages/product/<slug>.json  # products collection
  src/data/money-pages/business/<slug>.json # businesses collection
```

These shapes match `apps/sites/keukenfaqs/src/content.config.ts` verbatim — no schema changes needed on the Astro side.
