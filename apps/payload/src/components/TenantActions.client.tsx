'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

/**
 * Renders two action buttons at the top of the Tenant edit form:
 *
 *   1. "Scaffold tenant code" — POSTs to /api/tenants/:id/scaffold which
 *       dispatches the tenant-scaffold.yml GitHub workflow. CI creates
 *       apps/sites/<slug>/ and opens a PR for review.
 *
 *   2. "Deploy now" — POSTs to /api/tenants/:id/deploy which dispatches
 *       tenant-deploy.yml. CI syncs content from this Payload, builds the
 *       tenant's Astro app, and ships it to Cloudflare Workers.
 *
 * Both actions are no-ops until the tenant has been saved (we need an id).
 * Both require a super-admin user (enforced server-side in the endpoint).
 */

type ApiResult = {
  ok: boolean
  message: string
  runsUrl?: string | null
}

type Action = 'scaffold' | 'deploy'

export function TenantActions(): React.ReactElement {
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState<Action | null>(null)
  const [result, setResult] = useState<(ApiResult & { kind: Action }) | null>(null)

  const tenantId = typeof id === 'string' || typeof id === 'number' ? String(id) : null

  async function run(action: Action) {
    if (!tenantId) return
    setBusy(action)
    setResult(null)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as Partial<ApiResult>
      setResult({
        kind: action,
        ok: Boolean(body.ok),
        message:
          typeof body.message === 'string'
            ? body.message
            : res.ok
              ? 'Done.'
              : `Request failed: ${res.status} ${res.statusText}`,
        runsUrl: body.runsUrl ?? null,
      })
    } catch (err) {
      setResult({
        kind: action,
        ok: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusy(null)
    }
  }

  const disabled = !tenantId

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150, #e5e7eb)',
        borderRadius: 6,
        padding: '16px 20px',
        margin: '16px 0 24px',
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Tenant actions</div>
      <div style={{ fontSize: 13, color: 'var(--theme-elevation-500, #6b7280)', marginBottom: 12 }}>
        {disabled
          ? 'Save the tenant first to enable these actions.'
          : 'These buttons trigger CI workflows on GitHub. The scaffold action opens a PR you review and merge; the deploy action builds and ships immediately.'}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('scaffold')}
          style={buttonStyle(disabled || busy !== null)}
        >
          {busy === 'scaffold' ? 'Dispatching…' : 'Scaffold tenant code'}
        </button>

        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => run('deploy')}
          style={{
            ...buttonStyle(disabled || busy !== null),
            background: 'var(--theme-success-500, #16a34a)',
            color: '#fff',
            borderColor: 'transparent',
          }}
        >
          {busy === 'deploy' ? 'Dispatching…' : 'Deploy now'}
        </button>
      </div>

      {result ? (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 4,
            background: result.ok
              ? 'var(--theme-success-50, #dcfce7)'
              : 'var(--theme-error-50, #fee2e2)',
            color: result.ok
              ? 'var(--theme-success-900, #14532d)'
              : 'var(--theme-error-900, #7f1d1d)',
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {result.kind === 'scaffold' ? 'Scaffold' : 'Deploy'}: {result.ok ? 'dispatched' : 'failed'}
          </div>
          <div>{result.message}</div>
          {result.runsUrl ? (
            <div style={{ marginTop: 6 }}>
              <a href={result.runsUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                View workflow runs on GitHub →
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default TenantActions

function buttonStyle(isDisabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-200, #d1d5db)',
    background: 'var(--theme-elevation-0, #ffffff)',
    color: 'var(--theme-text, #111827)',
    fontSize: 14,
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
  }
}
