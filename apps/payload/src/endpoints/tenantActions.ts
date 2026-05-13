import type { Endpoint, PayloadRequest } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { dispatchWorkflow, workflowRunsUrl } from '../lib/githubDispatch'

/**
 * Two REST endpoints attached to the `tenants` collection:
 *
 *   POST /api/tenants/:id/scaffold
 *     Dispatches .github/workflows/tenant-scaffold.yml — generates
 *     apps/sites/<slug>/ and opens a PR for review.
 *
 *   POST /api/tenants/:id/deploy
 *     Dispatches .github/workflows/tenant-deploy.yml — pulls latest content,
 *     builds, and deploys this tenant's Cloudflare Worker.
 *
 * Both require a super-admin user. They are invoked from the custom admin
 * buttons in TenantActions.client.tsx.
 */

type JsonResponse = {
  ok: boolean
  message: string
  runsUrl?: string | null
}

function json(body: JsonResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function loadTenant(req: PayloadRequest, id: string) {
  return req.payload.findByID({ collection: 'tenants', id }) as Promise<{
    id: string | number
    slug?: string
    name?: string
    domain?: string
    githubWorkflow?: string
  } | null>
}

function extractId(req: PayloadRequest): string | null {
  // Payload v3 exposes route params under `routeParams`.
  const params = (req as unknown as { routeParams?: Record<string, unknown> }).routeParams
  const id = params?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

export const scaffoldEndpoint: Endpoint = {
  path: '/:id/scaffold',
  method: 'post',
  handler: async (req) => {
    if (!isSuperAdmin(req.user)) {
      return json({ ok: false, message: 'Only super-admins can scaffold tenants.' }, 403)
    }
    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)
    if (!tenant.slug || !tenant.domain || !tenant.name) {
      return json(
        { ok: false, message: 'Tenant is missing slug, domain, or name. Save the tenant first.' },
        400,
      )
    }

    const result = await dispatchWorkflow({
      workflow: 'tenant-scaffold.yml',
      inputs: {
        tenant_slug: tenant.slug,
        tenant_domain: tenant.domain,
        tenant_name: tenant.name,
      },
    })
    const runsUrl = workflowRunsUrl('tenant-scaffold.yml')
    if (!result.ok) {
      return json({ ok: false, message: result.error ?? 'GitHub dispatch failed.', runsUrl }, result.status)
    }
    return json({
      ok: true,
      message: `Scaffold dispatched for "${tenant.slug}". A pull request will appear on GitHub within ~30 seconds. Merge it to bring the new tenant online.`,
      runsUrl,
    })
  },
}

export const deployEndpoint: Endpoint = {
  path: '/:id/deploy',
  method: 'post',
  handler: async (req) => {
    if (!isSuperAdmin(req.user)) {
      return json({ ok: false, message: 'Only super-admins can deploy tenants.' }, 403)
    }
    const id = extractId(req)
    if (!id) return json({ ok: false, message: 'Missing tenant id.' }, 400)

    const tenant = await loadTenant(req, id)
    if (!tenant) return json({ ok: false, message: 'Tenant not found.' }, 404)
    if (!tenant.slug) {
      return json({ ok: false, message: 'Tenant has no slug. Save the tenant first.' }, 400)
    }

    const workflow = tenant.githubWorkflow || 'tenant-deploy.yml'
    const result = await dispatchWorkflow({
      workflow,
      inputs: {
        tenant_slug: tenant.slug,
        reason: 'manual deploy from admin',
      },
    })
    const runsUrl = workflowRunsUrl(workflow)
    if (!result.ok) {
      return json({ ok: false, message: result.error ?? 'GitHub dispatch failed.', runsUrl }, result.status)
    }
    return json({
      ok: true,
      message: `Deploy dispatched for "${tenant.slug}". The Worker will be updated in ~2 minutes.`,
      runsUrl,
    })
  },
}
