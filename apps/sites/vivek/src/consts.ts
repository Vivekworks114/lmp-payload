// Tenant identity. Sourced from tenant.config.json (synced from Payload at
// build time) — everything that varies per tenant flows through here.

import type { TenantConfig } from '@astropayload/core'
import tenantConfig from '../tenant.config.json'

export const TENANT = tenantConfig as TenantConfig

export const SITE_TITLE = TENANT.siteTitle
export const SITE_DESCRIPTION = TENANT.siteDescription
export const SITE_URL = TENANT.url
export const SITE_LOCALE = TENANT.locale
