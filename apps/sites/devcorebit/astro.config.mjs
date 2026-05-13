// @ts-check
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import cloudflare from '@astrojs/cloudflare'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Read tenant identity from the JSON file that `pnpm sync:content` writes.
 * Falls back to safe placeholders for first-time dev before sync has run,
 * so `astro dev` always boots.
 */
function readTenantConfig() {
  const p = path.join(__dirname, 'tenant.config.json')
  if (!existsSync(p)) {
    return { url: 'https://localhost', domain: 'localhost' }
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}

const tenant = readTenantConfig()

export default defineConfig({
  site: tenant.url,
  // Hybrid: default to prerendered static pages, opt-in to SSR per route via
  // `export const prerender = false` (see src/pages/api/contact.ts). The
  // Cloudflare adapter handles both at the same deploy.
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
  }),
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Skip watching the 2,600+ money-page JSONs and other large generated
        // trees. They're only rewritten by `pnpm sync:content`, and Astro's
        // content layer invalidates its own cache when that happens.
        // Watching them spawns one FD per file (chokidar+kqueue on macOS)
        // which trips EMFILE at the default `ulimit -n 256`.
        ignored: [
          '**/.git/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/.astro/**',
          '**/.wrangler/**',
          // Generated content — re-synced from Payload, not hand-edited.
          '**/src/data/money-pages/**',
        ],
      },
    },
  },
})
