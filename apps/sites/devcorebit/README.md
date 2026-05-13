# @astropayload/site-keukenfaqs

The first tenant: [keukenfaqs.nl](https://keukenfaqs.nl). Astro 6 (hybrid output, mostly static + an SSR `/api/contact` route) deployed to Cloudflare Workers via Wrangler.

## How a tenant site works

```
TENANT=keukenfaqs pnpm sync:content   # pulls just this tenant's data from Payload
pnpm dev                               # http://localhost:4321
pnpm build && pnpm deploy              # astro build + wrangler deploy
```

`sync:content` writes:

- `tenant.config.json` — identity, theme tokens, GA4 ID, social links, nav menus
- `src/content/blog/*.md` — editorial posts (consumed by the `blog` Zod collection in `src/content.config.ts`)
- `src/content/pages/*.md` — static pages
- `src/data/money-pages/{top10,product,business}/*.json` — affiliate roundup data
- `public/_redirects` — Cloudflare redirect rules from the `redirects` Payload collection

Layouts and `[...slug].astro` consume these via the unchanged `astro:content` API.

## What's tenant-specific code vs CMS-driven data

Code (lives only in this folder):
- Page layouts: `BlogPostLayout`, `TopTenLayout`, `ProductLayout`, `BusinessLayout`, …
- Components: `SiteHeader`, `SiteFooter`, money-page widgets
- Styles: Tailwind v4 + Inter font; navy/coral palette declared in `src/styles/global.css`
- Routing: `src/pages/**` (including the `/api/contact` SSR endpoint)

CMS-driven (sourced from Payload via `tenant.config.json` + content collections):
- Site name, description, locale, canonical URL
- Logo, favicon, OG image
- Theme tokens (CSS vars exposed via `<style>` in `BaseLayout.astro`)
- GA4 / GTM / Plausible IDs
- Affiliate publisher IDs (Bol.com, AWIN, Amazon)
- Social links
- Nav menus (header / footer / mobile)
- All editorial + money-page content

## Migration history

See [AUDIT.md](./AUDIT.md) for the WordPress→Astro audit (47 posts, 22 pages, 2,632 ZBMP money pages → 2,605 migratable across `top10` / `product` / `business`).

The original `migration/import-wxr.mjs` and `migration/scrape-money-pages.mjs` wrote to the local filesystem. The reworked versions (now in `apps/payload/scripts/`) write to Payload's Local API.
