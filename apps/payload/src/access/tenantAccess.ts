import type { Access } from 'payload'

import { isSuperAdmin } from './isSuperAdmin'

/**
 * Authenticated users can read. The multi-tenant plugin layers an additional
 * `where: { tenant: { in: user.tenants } }` filter on top, so a regular
 * editor will still only see their tenants' rows.
 */
export const authenticatedRead: Access = ({ req }) => Boolean(req.user)

export const superAdminOnly: Access = ({ req }) => isSuperAdmin(req.user)

/** Read = public (frontends fetch with API key); writes = authenticated. */
export const publicRead: Access = () => true
