/**
 * Dispatch a GitHub Actions workflow via the REST API.
 *
 * Used by the Tenants collection's custom endpoints (scaffold + deploy) so
 * editors can trigger CI from the Payload admin instead of the terminal.
 *
 * Env vars (read at call time):
 *   GITHUB_TOKEN  - PAT or fine-grained token with `actions:write` on the repo.
 *   GITHUB_OWNER  - e.g. "yourorg"
 *   GITHUB_REPO   - e.g. "astropayload"
 *   GITHUB_BRANCH - optional, defaults to "main".
 */

export interface DispatchOptions {
  workflow: string
  inputs: Record<string, string>
  ref?: string
}

export interface DispatchResult {
  ok: boolean
  status: number
  error?: string
  runId?: number
  runUrl?: string
}

export interface WorkflowRunSummary {
  id: number
  html_url: string
  status: string | null
  conclusion: string | null
  created_at: string
}

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'astropayload-admin',
} as const

function repoBase(): { token: string; owner: string; repo: string } | null {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!token || !owner || !repo) return null
  return { token, owner, repo }
}

export async function dispatchWorkflow(opts: DispatchOptions): Promise<DispatchResult> {
  const base = repoBase()
  const ref = opts.ref ?? process.env.GITHUB_BRANCH ?? 'main'

  if (!base) {
    return {
      ok: false,
      status: 500,
      error:
        'GitHub dispatch is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in apps/payload/.env.',
    }
  }

  const url = `https://api.github.com/repos/${base.owner}/${base.repo}/actions/workflows/${opts.workflow}/dispatches`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${base.token}`,
        ...GITHUB_HEADERS,
      },
      body: JSON.stringify({ ref, inputs: opts.inputs }),
    })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Could not reach GitHub: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return {
      ok: false,
      status: res.status,
      error: `GitHub returned ${res.status}: ${text || res.statusText}`,
    }
  }

  const run = await waitForLatestWorkflowRun(opts.workflow, { ref, dispatchedAfterMs: Date.now() - 5000 })
  return {
    ok: true,
    status: 204,
    runId: run?.id,
    runUrl: run?.html_url,
  }
}

/**
 * After workflow_dispatch returns 204, poll until a matching run appears.
 */
export async function waitForLatestWorkflowRun(
  workflow: string,
  options?: {
    ref?: string
    maxAttempts?: number
    delayMs?: number
    /** Only accept runs created after this timestamp (ms). */
    dispatchedAfterMs?: number
  },
): Promise<WorkflowRunSummary | null> {
  const base = repoBase()
  if (!base) return null

  const ref = options?.ref ?? process.env.GITHUB_BRANCH ?? 'main'
  const maxAttempts = options?.maxAttempts ?? 12
  const delayMs = options?.delayMs ?? 1500
  const cutoff = options?.dispatchedAfterMs ?? Date.now() - 60_000

  const listUrl = `https://api.github.com/repos/${base.owner}/${base.repo}/actions/workflows/${workflow}/runs?per_page=10&branch=${encodeURIComponent(ref)}&event=workflow_dispatch`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
    }

    try {
      const res = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${base.token}`,
          ...GITHUB_HEADERS,
        },
      })
      if (!res.ok) continue

      const data = (await res.json()) as { workflow_runs?: WorkflowRunSummary[] }
      const runs = data.workflow_runs ?? []
      const match = runs.find((run) => {
        const created = Date.parse(run.created_at)
        return Number.isFinite(created) && created >= cutoff - 5000
      })
      if (match) return match
    } catch {
      // retry
    }
  }

  return null
}

/**
 * Link to the workflow runs list (fallback when poll times out).
 */
export function workflowRunsUrl(workflow: string): string | null {
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!owner || !repo) return null
  return `https://github.com/${owner}/${repo}/actions/workflows/${workflow}`
}
