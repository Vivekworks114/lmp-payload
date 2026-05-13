#!/usr/bin/env tsx
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { syncTenantContent } from '@astropayload/payload-sdk'

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.env.TENANT ?? 'keukenfaqs'
const url = process.env.PAYLOAD_URL
const apiKey = process.env.PAYLOAD_API_KEY

if (!url) {
  console.error('[sync:content] PAYLOAD_URL env var is required.')
  process.exit(1)
}

console.log(`[sync:content] tenant=${slug} payload=${url}`)
syncTenantContent({ url, apiKey, tenantSlug: slug, siteRoot, clean: true })
  .then((counts) => {
    console.log('[sync:content] complete:', counts)
  })
  .catch((err) => {
    console.error('[sync:content] failed:', err)
    process.exit(1)
  })
