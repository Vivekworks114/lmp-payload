/**
 * Dispatch a GitHub Actions workflow via the REST API.
 *
 * Used by the Tenants collection's custom endpoints (scaffold + deploy) so
 * editors can trigger CI from the Payload admin instead of the terminal.
 *
 * Env vars (read at call time):
 *   GITHUB_TOKEN  - PAT or fine-grained token with `actions:write` on the repo.
 *                   For the scaffold workflow it also needs `contents:write`
 *                   and `pull_requests:write`.
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
}

export async function dispatchWorkflow(opts: DispatchOptions): Promise<DispatchResult> {
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const ref = opts.ref ?? process.env.GITHUB_BRANCH ?? 'main'

  if (!token || !owner || !repo) {
    return {
      ok: false,
      status: 500,
      error:
        'GitHub dispatch is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in apps/payload/.env.',
    }
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${opts.workflow}/dispatches`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'astropayload-admin',
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

  return { ok: true, status: 204 }
}

/**
 * Human-friendly URL where a user can watch the dispatched workflow run.
 * GitHub's dispatch endpoint returns 204 with no body, so we can't get the
 * exact run ID; we link to the workflow's runs page instead.
 */
export function workflowRunsUrl(workflow: string): string | null {
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!owner || !repo) return null
  return `https://github.com/${owner}/${repo}/actions/workflows/${workflow}`
}
