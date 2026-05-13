import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { optionalFlag, type ParsedArgs } from '../args'

/**
 * `tenant-cli deploy --slug <slug>`
 *
 * Runs `pnpm sync:content && pnpm build && pnpm deploy` inside
 * apps/sites/<slug>/. Used both manually and from the GitHub Actions
 * webhook receiver.
 */
export async function runDeploy(args: ParsedArgs): Promise<void> {
  const slug = optionalFlag(args, 'slug') ?? process.env.TENANT
  if (!slug) throw new Error('--slug or TENANT env var is required')

  const siteRoot = path.resolve(path.join(process.cwd(), 'apps/sites', slug))
  const env = { ...process.env, TENANT: slug }

  for (const cmd of ['sync:content', 'build', 'deploy']) {
    console.log(`[tenant-cli deploy] -> pnpm ${cmd} (${siteRoot})`)
    const result = spawnSync('pnpm', ['run', cmd], { cwd: siteRoot, env, stdio: 'inherit' })
    if (result.status !== 0) {
      throw new Error(`pnpm ${cmd} exited with code ${result.status}`)
    }
  }
}
