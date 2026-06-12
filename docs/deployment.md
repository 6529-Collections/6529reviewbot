# Production Deployment

This runbook describes the intended production shape for `6529bot`: a central
GitHub App server plus controlled worker execution from the bot repository or
another 6529-owned runtime.

## GitHub App Registration

Create a GitHub App named `6529bot`.

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
```

Start with `noop` worker mode for the first webhook pass. Switch to
`github_actions` or a controlled `local` worker after webhook verification,
repository config loading, admission, budget, and usage paths are clean.
Keep run control `off` until the durable claim table is applied. Then set
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` and move to `enforce` with
conservative repo, PR, and requestor concurrency caps.

Run a no-network configuration preflight before starting the server:

```bash
npm run preflight
```

## Central GitHub Actions Worker

Install `templates/review-job-workflow.yml` as
`.github/workflows/review-job.yml` in this repository when using the
`github_actions` worker adapter.

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
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

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

The App server dispatches each admitted job with the target installation id.
The worker mints a short-lived GitHub App installation token inside the central
workflow and uses it for target checkout, PR reads, and comment writes. Target
repositories do not receive bot provider keys, AWS credentials, or long-lived
GitHub tokens.

For fork PRs, the starter workflow checks out the submitted head repository
without a token. This supports public forks and fails closed for private forks
unless an operator adds an explicitly approved fork access path.

The server-side dispatcher still needs a credential that can dispatch workflows
in `6529-Collections/6529reviewbot`. Keep that credential scoped to this
repository and separate from target repository access.

## 6529.io Wiring

Public dashboard routes should call:

```text
GET /api/public/usage/summary?days=30
```

Private admin routes should call:

```text
GET /api/admin/usage/summary?days=30
GET /api/admin/budget/policies
GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
```

Admin requests should be signed by server-side `6529.io` infrastructure using
the HMAC bridge in [admin-auth-bridge.md](admin-auth-bridge.md). The browser
must never receive bot admin signing secrets, provider keys, AWS credentials,
or GitHub App private keys.

## Verification Checklist

- `GET /healthz` succeeds.
- `npm run preflight` passes, or every warning is understood.
- Invalid webhook signatures fail.
- GitHub App `ping` is acknowledged.
- Pull request and issue-comment events are normalized.
- A saved pull request delivery can be replayed with `npm run webhook:replay`
  in dry-run mode.
- `npm run ledger:schema` prints the expected ledger schema, and
  `npm run ledger:schema -- -- --apply` has been run in the target database.
- Repository config loads from the base ref.
- Public repo untrusted actors are denied before budget or queue work.
- `REVIEW_USAGE_ENABLED=true` is configured before budget caps are enforced
  against ledger spend.
- Run-control claims dedupe replayed deliveries before queue work.
- `REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` has been tested before
  `REVIEWBOT_RUN_CONTROL_MODE=enforce`.
- `noop` mode returns jobs without dispatching workers.
- Job ledger rows record budget decisions and dispatch outcomes when enabled.
- `github_actions` mode passes `installation_id` and `run_key` into the
  workflow.
- Workers mark run-control claims `running`, then `completed` or `failed`.
- Worker mints a short-lived installation token without logging it.
- Target checkout uses the installation token.
- Model usage is recorded in the isolated usage ledger.
- Public and admin usage API responses match the 6529.io visibility contract.
- Alerts run from the central bot environment.

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
