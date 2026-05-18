import type { PayloadRequest } from 'payload'

import { dispatchWorkflow, workflowRunsUrl } from './githubDispatch'
import { parseGithubRepo, resolveDeployMode } from './parseGithubRepo'
import { getTenantDeployTargetInfo, type DeployMode } from './tenantDeployTarget'
import { tenantHasModule } from './tenantModules'

export interface DispatchTenantDeployResult {
  ok: boolean
  status: number
  message: string
  runsUrl?: string | null
  runUrl?: string | null
  error?: string
  deployMode?: DeployMode
  deployTarget?: string
}

export interface TenantDeployTarget {
  id: string | number
  slug?: string
  githubWorkflow?: string | null
  githubRepo?: string | null
  githubBranch?: string | null
  blogContentPath?: string | null
  enabledModules?: string[] | null
}

export async function dispatchTenantDeploy(
  req: PayloadRequest,
  tenant: TenantDeployTarget,
  reason: string,
): Promise<DispatchTenantDeployResult> {
  if (!tenant.slug) {
    return { ok: false, status: 400, message: 'Tenant has no slug.', error: 'missing slug' }
  }

  if (!tenantHasModule(tenant.enabledModules, 'blog')) {
    return {
      ok: false,
      status: 400,
      message: 'Blog module is not enabled for this tenant. Enable it under the GitHub tab.',
    }
  }

  const deployMode = resolveDeployMode(tenant)
  const parsed = tenant.githubRepo ? parseGithubRepo(tenant.githubRepo) : null

  if (deployMode === 'external' && !parsed) {
    return {
      ok: false,
      status: 400,
      message: 'Invalid GitHub repository. Use owner/repo or a github.com URL.',
    }
  }

  if (deployMode === 'monorepo') {
    const path = await import('node:path')
    const fs = await import('node:fs/promises')
    const monorepoPath = path.resolve(process.cwd(), '..', 'sites', tenant.slug)
    try {
      await fs.access(monorepoPath)
    } catch {
      return {
        ok: false,
        status: 400,
        message: `No monorepo site at ${monorepoPath}. Connect a GitHub repository or run Scaffold tenant code.`,
      }
    }
  }

  const workflow = tenant.githubWorkflow || 'tenant-deploy.yml'
  const result = await dispatchWorkflow({
    workflow,
    inputs: {
      tenant_slug: tenant.slug,
      reason,
      deploy_mode: deployMode,
      github_repo: parsed?.full ?? '',
      github_branch: tenant.githubBranch?.trim() || 'main',
      blog_content_path: tenant.blogContentPath?.trim() || 'src/content/blog',
    },
  })

  const runsUrl = result.runUrl ?? workflowRunsUrl(workflow)

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.error ?? 'GitHub dispatch failed.',
      runsUrl,
      runUrl: result.runUrl,
      error: result.error,
    }
  }

  await req.payload.update({
    collection: 'tenants',
    id: tenant.id,
    data: {
      lastDeployStatus: 'dispatched',
      lastDeployRunUrl: result.runUrl ?? undefined,
      lastDeployError: null,
      lastPublishedAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
  })

  const targetInfo = getTenantDeployTargetInfo(tenant)
  const targetLabel = targetInfo?.label ?? tenant.slug

  return {
    ok: true,
    status: 200,
    message: `Publish started for "${tenant.slug}" (${targetLabel}). The live site updates when CI finishes (~2 minutes).`,
    runsUrl,
    runUrl: result.runUrl,
    deployMode,
    deployTarget: targetLabel,
  }
}
