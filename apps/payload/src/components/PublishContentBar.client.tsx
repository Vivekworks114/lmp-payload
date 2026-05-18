'use client'

import { useAuth } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

import { DeployTargetBadge } from './DeployTargetBadge.client'
import { useTenantDeployTarget } from './useTenantDeployTarget'

const TENANT_COOKIE = 'payload-tenant'

type PublishResult = {
  ok: boolean
  message: string
  runUrl?: string | null
  deployMode?: 'monorepo' | 'external'
  deployTarget?: string
}

function readTenantIdFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TENANT_COOKIE}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

/**
 * Shown on content list/edit views. Editors save posts freely; this button
 * pushes all saved CMS content to the live static site (one CI run).
 */
export function PublishContentBar(): React.ReactElement | null {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string | undefined>()
  const [tenantLabel, setTenantLabel] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  const { target, loading, refresh } = useTenantDeployTarget(tenantId)

  const refreshTenant = useCallback(() => {
    const id = readTenantIdFromCookie()
    setTenantId(id)
    if (!id) {
      setTenantLabel(undefined)
      return
    }
    void fetch(`/api/tenants/${encodeURIComponent(id)}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: { name?: string; slug?: string } | null) => {
        if (doc?.name) setTenantLabel(doc.name)
        else if (doc?.slug) setTenantLabel(doc.slug)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshTenant()
    const interval = window.setInterval(refreshTenant, 2000)
    return () => window.clearInterval(interval)
  }, [refreshTenant])

  if (!user) return null

  async function publish() {
    if (!tenantId) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as Partial<PublishResult>
      setResult({
        ok: Boolean(body.ok),
        message:
          typeof body.message === 'string'
            ? body.message
            : res.ok
              ? 'Publish started.'
              : `Publish failed: ${res.status} ${res.statusText}`,
        runUrl: body.runUrl ?? null,
        deployMode: body.deployMode,
        deployTarget: body.deployTarget,
      })
      if (body.ok) refresh()
    } catch (err) {
      setResult({
        ok: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusy(false)
    }
  }

  const displayMode = result?.deployMode ?? target?.mode
  const displayTarget = result?.deployTarget ?? target?.label

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 6,
        border: '1px solid var(--theme-elevation-150, #e5e7eb)',
        background: 'var(--theme-elevation-50, #f9fafb)',
      }}
    >
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Live site</div>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500, #6b7280)', marginTop: 2 }}>
          {tenantId
            ? `Saving updates the CMS only. Publish when ready${tenantLabel ? ` (${tenantLabel})` : ''}.`
            : 'Select a site in the tenant switcher above, then publish your saved changes.'}
        </div>
        {tenantId && !loading && target ? (
          <div style={{ marginTop: 8 }}>
            <DeployTargetBadge mode={target.mode} label={target.shortLabel} compact />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!tenantId || busy}
        onClick={() => void publish()}
        style={{
          padding: '10px 18px',
          borderRadius: 4,
          border: 'none',
          background: tenantId && !busy ? 'var(--theme-success-500, #16a34a)' : '#9ca3af',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: !tenantId || busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Publishing…' : 'Publish content to live site'}
      </button>

      {result ? (
        <div
          style={{
            flex: '1 1 100%',
            fontSize: 13,
            padding: '8px 10px',
            borderRadius: 4,
            background: result.ok
              ? 'var(--theme-success-50, #dcfce7)'
              : 'var(--theme-error-50, #fee2e2)',
            color: result.ok
              ? 'var(--theme-success-900, #14532d)'
              : 'var(--theme-error-900, #7f1d1d)',
          }}
        >
          {result.ok && displayMode && displayTarget ? (
            <div style={{ marginBottom: 6 }}>
              <DeployTargetBadge mode={displayMode} label={displayTarget} compact />
            </div>
          ) : null}
          {result.message}
          {result.runUrl ? (
            <>
              {' '}
              <a href={result.runUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                Track build →
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default PublishContentBar
