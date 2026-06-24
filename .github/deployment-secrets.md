# Cloudflare deployment setup

The production deployment workflow runs after every push to `main`. It validates the
project before running `wrangler deploy`, so a failing type-check or test suite cannot
replace the live Worker.

Before the first deployment, add these repository secrets in GitHub under
**Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID that owns the Worker. |
| `CLOUDFLARE_API_TOKEN` | A scoped API token with permission to edit Cloudflare Workers in that account. |

Create the API token in Cloudflare's **Manage Account → Account API Tokens** area. Use
the **Edit Cloudflare Workers** permission and restrict the token to the production
account. Do not store the token in this repository or in `wrangler.jsonc`.

The workflow deploys the Worker named `accord-strategy`, as configured in
`wrangler.jsonc`. The GitHub Actions run log contains the resulting Worker URL and
deployment version.
