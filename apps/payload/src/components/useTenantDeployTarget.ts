'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DeployMode } from '../lib/tenantDeployTarget'

export type TenantDeployTargetState = {
  mode: DeployMode
  label: string
  shortLabel: string
  githubSetupStatus?: string | null
}

export function useTenantDeployTarget(tenantId: string | null | undefined): {
  target: TenantDeployTargetState | null
  loading: boolean
  refresh: () => void
} {
  const [target, setTarget] = useState<TenantDeployTargetState | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!tenantId) {
      setTarget(null)
      return
    }
    setLoading(true)
    void fetch(`/api/tenants/${encodeURIComponent(tenantId)}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (doc: {
          slug?: string
          githubRepo?: string | null
          githubBranch?: string | null
          blogContentPath?: string | null
          githubSetupStatus?: string | null
        } | null) => {
          if (!doc?.slug) {
            setTarget(null)
            return
          }
          const repo = doc.githubRepo?.trim()
          const branch = doc.githubBranch?.trim() || 'main'
          const blogPath = doc.blogContentPath?.trim() || 'src/content/blog'
          if (repo) {
            const full = repo.includes('/') ? repo.replace(/^.*github\.com[/:]([^/]+\/[^/]+).*/i, '$1') : repo
            setTarget({
              mode: 'external',
              label: `${full} @ ${branch} → ${blogPath}`,
              shortLabel: full,
              githubSetupStatus: doc.githubSetupStatus,
            })
          } else {
            setTarget({
              mode: 'monorepo',
              label: `apps/sites/${doc.slug}`,
              shortLabel: `apps/sites/${doc.slug}`,
              githubSetupStatus: doc.githubSetupStatus,
            })
          }
        },
      )
      .catch(() => setTarget(null))
      .finally(() => setLoading(false))
  }, [tenantId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { target, loading, refresh }
}
