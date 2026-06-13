# Production Deployment

This runbook describes the intended production shape for `6529bot`: a central
GitHub App server plus controlled worker execution from the bot repository or
another 6529-owned runtime.

For an ordered first-install path, start with
[install.md](install.md), then return here for production details.
For containerized deployment, use
[container-deployment.md](container-deployment.md) with this runbook.

For release or dogfood evidence, use
[operator-evidence-template.md](operator-evidence-template.md). Keep
unredacted account ids, ARNs, secrets, private repository names, webhook
payloads, and provider responses in the private operator runbook.
Use [production-cutover.md](production-cutover.md) as the ordered go/no-go
checklist before enabling live dogfood traffic.

## GitHub App Registration

Create a GitHub App named `6529bot`.

Use `templates/github-app-manifest.example.json` as the reviewed starting
manifest. Replace `<bot-host>` with the production App server hostname before
registration. The generated App id, client secret, webhook secret, and private
key are live credentials and must be stored only in the bot runtime secret
store, not committed back to the public repository.

Render and validate the manifest before registration:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet
```

If using the GitHub App manifest flow, generate an operator-owned registration
form with `--form --owner <org> --state <unguessable-state>`. Complete the
GitHub manifest conversion in the operator environment and move the returned
credentials directly into the bot secret store.

Use the conversion CLI from a private operator environment:

```bash
npm run github-app:convert -- -- --code <code> --output <private-json-path>
```

The production server should return safe operator guidance at:

```text
GET /github-app/manifest-complete
GET /github-app/setup
GET /github-app/callback
```

These endpoints are for browser handoff during App registration/install. They
do not start review work, exchange manifest codes, or expose generated
credentials.

Use [github-app-registration.md](github-app-registration.md) as the complete
registration packet for operator roles, settings verification,
post-registration acceptance checks, credential rotation, and rollback.

Recommended settings:

```text
Webhook active: yes
Webhook URL: https://<bot-host>/webhooks/github
Webhook secret: generated secret stored only in the bot runtime
Installation: selected repositories during dogfood
```

Repository permissions:

```text
Contents: read
Issues: write
Metadata: read
Pull requests: read
```

Organization permissions:

```text
Members: read
```

Events:

```text
Issue comment
Pull request
```

`Members: read` is used only for the best-effort organization membership
signal. Repository collaborator permission remains the primary trusted-actor
signal.

## Central Server Environment

Configure the server with GitHub App credentials and conservative policy:

```text
REVIEWBOT_GITHUB_WEBHOOK_SECRET=
REVIEWBOT_GITHUB_APP_ID=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_GITHUB_APP_API_URL=https://api.github.com
REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_BUDGET_MODE=enforce
REVIEWBOT_RUN_CONTROL_MODE=off
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false
REVIEWBOT_JOB_LEDGER_ENABLED=true
REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=false
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api
REVIEWBOT_WORKER_GITHUB_TOKEN=
REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID=
```

Start with `noop` worker mode for the first webhook pass. Switch to
`github_actions` or a controlled `local` worker after webhook verification,
repository config loading, admission, budget, and usage paths are clean.
Use [worker-capacity.md](worker-capacity.md) before enabling live worker
traffic beyond command-only dogfood.
Keep run control `off` until the durable claim table is applied. Then set
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` and move to `enforce` with
conservative repo, PR, and requestor concurrency caps.

Run a no-network configuration preflight before starting the server:

```bash
npm run preflight
```

The repository-owned `Dockerfile` can run the central App server in a
container image. Build and deploy it only from a reviewed commit, inject
GitHub App, provider, AWS, alert, and admin-auth secrets at runtime, and keep
the image digest and vulnerability scan in the private operator evidence
record. See [container-deployment.md](container-deployment.md).

Use [AWS IAM Templates](../infra/aws/README.md) as the starting point for
GitHub Actions OIDC trust and least-privilege Data API/SNS/SES policies.
Replace all placeholders, scope trust to the bot repository or protected
environment, and record the reviewed policy ARNs in the operator runbook.

## Central GitHub Actions Worker

This repository includes `.github/workflows/review-job.yml` for the
`github_actions` worker adapter. Keep `templates/review-job-workflow.yml`
aligned with the installed workflow when changing worker behavior.

Required repository secrets for the worker:

```text
REVIEWBOT_GITHUB_APP_ID
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64
ANTHROPIC_API_KEY
OPENAI_API_KEY
OPENROUTER_API_KEY
```

Required repository variables for usage writes:

```text
REVIEW_USAGE_AWS_ROLE_ARN
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

`REVIEW_USAGE_AWS_ROLE_ARN` is assumed through GitHub Actions OIDC by the
central worker and alert templates. The role should be scoped to the bot
repository or protected environment and to the reviewed Aurora/SNS/SES
resources.

Required repository variables when durable run-control claims should be closed
by the worker:

```text
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true
REVIEWBOT_RUN_CONTROL_LEDGER_AWS_REGION
REVIEWBOT_RUN_CONTROL_LEDGER_DB_RESOURCE_ARN
REVIEWBOT_RUN_CONTROL_LEDGER_DB_SECRET_ARN
REVIEWBOT_RUN_CONTROL_LEDGER_DB_NAME
REVIEWBOT_RUN_CONTROL_LEDGER_DB_SCHEMA
```

If those run-control variables are blank, the worker falls back to the usage
ledger settings for the same database and schema.

Before enabling live writes, apply the ledger schema from a configured
operator environment:

```bash
npm run ledger:schema -- -- --apply
```

Before enabling live provider work, apply reviewed central budget policies or
document that the release is temporarily relying on environment/repository
caps:

```bash
npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>
npm run budget-policies -- -- --file <reviewed-budget-policy-file.json> --apply
```

The App server dispatches each admitted job with the target installation id.
The worker mints a short-lived GitHub App installation token inside the central
workflow and uses it for target checkout, PR reads, and comment writes. Target
repositories do not receive bot provider keys, AWS credentials, or long-lived
GitHub tokens.

For fork PRs, the starter workflow checks out the submitted head repository
without a token. This supports public forks and fails closed for private forks
unless an operator adds an explicitly approved fork access path.

The server-side dispatcher still needs a credential that can dispatch workflows
in `6529-Collections/6529reviewbot`. Prefer
`REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api` with
`REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID` for the GitHub App installation on
the central bot repository. The server then mints a short-lived installation
token. The preferred setup uses a separate dispatch-only GitHub App configured
through `REVIEWBOT_WORKER_GITHUB_APP_*`, installed only on the central bot
repository with `Actions: write`. If those worker-specific credentials are
blank, the server reuses the main App credentials and operators must accept
`Actions: write` on every repository where that App is installed.
`REVIEWBOT_WORKER_GITHUB_TOKEN` remains an explicit bot-owned fallback. Keep
dispatch credentials scoped to this repository and separate from target
repository access. The `gh` CLI dispatch mode remains a compatibility fallback
for operator environments that intentionally manage GitHub CLI authentication.
Preflight rejects partial worker App credential overrides and warns when the
main App is reused for dispatch; treat a strict-preflight failure or warning as
release evidence to resolve or explicitly accept before production traffic.

## 6529.io Wiring

Use the public-safe frontend env template as the starting point:

```bash
npm run check:6529-io-env
```

The template lives at `templates/6529-io-reviewbot-env.example`. Copy the env
names into the private 6529.io deployment configuration and replace only the
deployment-owned values there.

Public dashboard routes should call:

```text
GET /api/public/usage/summary?days=30
```

Private admin routes should call:

```text
GET /api/admin/usage/summary?days=30
GET /api/admin/usage/events/recent?days=7&limit=50
GET /api/admin/budget/policies
GET /api/admin/budget/status
GET /api/admin/model-prices/status
GET /api/admin/alerts/status
GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50
GET /api/admin/status?profile=server
```

Admin requests should be signed by server-side `6529.io` infrastructure using
the HMAC bridge in [admin-auth-bridge.md](admin-auth-bridge.md). The browser
must never receive bot admin signing secrets, provider keys, AWS credentials,
or GitHub App private keys.

## Verification Checklist

- `npm run production:cutover -- -- --init-status <operator-cutover-status-file>`
  has bootstrapped the private cutover status file for the current checklist.
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary`
  has been reviewed before live dogfood traffic.
- `GET /healthz` succeeds.
- `npm run preflight` passes, or every warning is understood.
- [GitHub App Registration Packet](github-app-registration.md) acceptance
  checks are complete or explicitly deferred in release evidence.
- AWS OIDC trust and identity policies were reviewed from
  `infra/aws/*.example.json` or equivalent least-privilege templates.
- `npm run check:workflow-actions` passes after editing central worker or alert
  workflows.
- Invalid webhook signatures fail.
- GitHub App `ping` is acknowledged.
- Pull request and issue-comment events are normalized.
- A saved pull request delivery can be replayed with `npm run webhook:replay`
  in dry-run mode.
- `npm run ledger:schema` prints the expected ledger schema, and
  `npm run ledger:schema -- -- --apply` has been run in the target database.
  Re-applying the schema should succeed even when managed daily aggregate view
  definitions changed between releases.
- `npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>` prints
  the expected budget policy SQL, and reviewed rows are applied or explicitly
  deferred.
- Repository config loads from the base ref.
- Public repo untrusted actors are denied before budget or queue work.
- `npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready`
  passes before first live dogfood traffic.
- `npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready`
  passes as the final release, promotion, cutover, and workspace cross-check.
- `REVIEW_USAGE_ENABLED=true` is configured before budget caps are enforced
  against ledger spend.
- Enabled `reviewbot.ai_review_budget_policies` rows deny over-budget jobs
  before worker dispatch.
- Run-control claims dedupe replayed deliveries before queue work.
- `REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` has been tested before
  `REVIEWBOT_RUN_CONTROL_MODE=enforce`.
- `noop` mode returns jobs without dispatching workers.
- Worker capacity and backpressure settings match
  [worker-capacity.md](worker-capacity.md), or release notes explicitly defer
  live scaling beyond command-only dogfood.
- Job ledger rows record budget decisions and dispatch outcomes when enabled.
- `github_actions` mode passes `installation_id` and `run_key` into the
  workflow.
- Workers mark run-control claims `running`, then `completed` or `failed`.
- Worker mints a short-lived installation token without logging it.
- Target checkout uses the installation token.
- Model usage is recorded in the isolated usage ledger.
- Public and admin usage API responses match the 6529.io visibility contract.
- Operator alerts run from the central bot environment, including spend,
  failed-job, and stale-claim checks when enabled.
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready`
  passes before broad community traffic unless release notes explicitly call
  the release dogfood-only and name any deferrals.

## Rollback

- Set central `REVIEWBOT_WORKER_ADAPTER=noop`.
- Set central `REVIEWBOT_PUBLIC_REPO_MODE=off`.
- Disable the target repo config with `enabled: false`.
- Remove the GitHub App installation from the target repo.
- Disable provider keys in the bot secret store.

## References

- [GitHub App REST permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)
- [Get repository permissions for a user](https://docs.github.com/rest/collaborators/collaborators)
- [Organization members API](https://docs.github.com/en/rest/orgs/members)
