# @astropayload/webhook

Tiny Cloudflare Worker that receives content-change webhooks from Payload and dispatches the GitHub Actions `tenant-deploy.yml` workflow for the affected tenant.

## Flow

```
Payload afterChange/afterDelete
    -> POST https://webhook.example.com/  { tenantSlug, collection, id, operation }
        -> GitHub workflow_dispatch  { tenant_slug: ... }
            -> .github/workflows/tenant-deploy.yml
                -> pnpm sync:content && pnpm build && pnpm deploy   (only the affected tenant)
```

GitHub Actions handles deduplication via the `concurrency` group, so a burst of saves on one tenant collapses into one deploy.

## Setup

```sh
pnpm wrangler secret put WEBHOOK_TOKEN      # same value as Payload's WEBHOOK_TOKEN
pnpm wrangler secret put GITHUB_TOKEN       # fine-grained PAT, actions:write
pnpm wrangler secret put GITHUB_OWNER       # yourorg
pnpm wrangler secret put GITHUB_REPO        # astropayload
pnpm deploy
```

Then point Payload's `WEBHOOK_URL` env var at the deployed Worker URL.
