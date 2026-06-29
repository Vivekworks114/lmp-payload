# Jenkins CI for astropayload

Move all tenant pipelines off GitHub Actions onto your Jenkins VPS. Payload admin chooses the backend under **Globals → Platform settings → CI provider**.

## Architecture

```
Payload admin (Publish / Deploy / Import)
    → dispatchCiJob() → Jenkins buildWithParameters
    → jenkins/scripts/*.sh (same steps as GitHub Actions)
    → report-deploy → Payload tenant status
```

Scheduled publish runs on **Jenkins cron** (not on the Payload VPS):

```
Jenkins: scheduled-publish (hourly)
    → POST /api/scheduled-publish/run on Payload CMS
    → promotes due posts → triggers tenant-deploy per tenant
```

## 1. Payload server `.env`

```env
CI_PROVIDER=jenkins

JENKINS_URL=https://jenkins.yourdomain.com
JENKINS_USER=your-api-user
JENKINS_API_TOKEN=your-api-token

# Optional job name overrides (defaults match job key)
JENKINS_JOB_DEPLOY=tenant-deploy
JENKINS_JOB_IMPORT=tenant-import-blog
JENKINS_JOB_SETUP=tenant-repo-setup
JENKINS_JOB_SCAFFOLD=tenant-scaffold

# Platform repo checkout (Jenkins agents)
GITHUB_OWNER=yourorg
GITHUB_REPO=astropayload
PLATFORM_GIT_BRANCH=jenkins
```

Also set existing vars: `DEPLOY_REPORT_TOKEN`, `PAYLOAD_URL`, `EXTERNAL_REPO_GITHUB_TOKEN`, etc.

## 2. Admin UI

1. Log in as super-admin
2. **Globals → Platform settings**
3. Set **CI provider** → **Jenkins**
4. Save

(Or rely on `CI_PROVIDER=jenkins` in `.env`.)

## 3. Create Jenkins jobs

Create **Pipeline** jobs pointing at this repo (branch `jenkins`):

| Job name | Jenkinsfile |
|----------|-------------|
| `tenant-deploy` | `jenkins/Jenkinsfile.tenant-deploy` |
| `tenant-import-blog` | `jenkins/Jenkinsfile.tenant-import-blog` |
| `tenant-scaffold` | `jenkins/Jenkinsfile.tenant-scaffold` |
| `tenant-repo-setup` | `jenkins/Jenkinsfile.tenant-repo-setup` |
| `scheduled-publish` | `jenkins/Jenkinsfile.scheduled-publish` |

Enable **This project is parameterized** (Jenkins reads parameters from the Jenkinsfile).

For `scheduled-publish`, the Jenkinsfile includes `cron('0 * * * *')` — enable **Build periodically** or use Pipeline triggers.

## 4. Jenkins credentials (IDs must match Jenkinsfiles)

| Credential ID | Type | Value |
|---------------|------|--------|
| `astropayload-payload-url` | Secret text | `https://payload.10beste.com` |
| `astropayload-deploy-report-token` | Secret text | Same as Payload `DEPLOY_REPORT_TOKEN` |
| `astropayload-payload-api-key` | Secret text | Super-admin API key (optional) |
| `astropayload-external-repo-github-token` | Secret text | Fallback PAT for client repos |
| `astropayload-platform-github-token` | Secret text | Read access to astropayload repo |
| `astropayload-cloudflare-api-token` | Secret text | Wrangler deploy |
| `astropayload-cloudflare-account-id` | Secret text | Cloudflare account |

## 5. Jenkins agent requirements

- Node.js 22 + corepack/pnpm 9
- git
- Network access to GitHub + Payload CMS + Cloudflare

## 6. Client repo tokens

Unchanged from GitHub Actions:

1. Tenant **GitHub credential** in Payload (per tenant)
2. Else `EXTERNAL_REPO_GITHUB_TOKEN`
3. Jenkins calls `GET /api/ci/github-token?tenant=...` via `jenkins/scripts/resolve-client-github-token.sh`

## 7. Disable GitHub Actions (optional)

After Jenkins is verified, disable or remove `.github/workflows/*.yml` triggers on the branch you deploy from.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Jenkins is not configured` | Set `JENKINS_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN` on Payload VPS |
| 403 on client checkout | Link tenant GitHub credential or set `EXTERNAL_REPO_GITHUB_TOKEN` |
| Job not found | Match `JENKINS_JOB_*` env to Jenkins job names |
| Crumb / CSRF errors | `jenkinsDispatch.ts` sends Jenkins crumb automatically |
