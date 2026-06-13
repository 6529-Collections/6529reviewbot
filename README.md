# 6529reviewbot

Provider-neutral AI pull request review bot for 6529 repositories.

`6529reviewbot` runs focused PR reviews, posts concise GitHub comments as
`6529bot`, and records token and cost telemetry to an isolated AWS usage
ledger. The bot is designed to be used across multiple repositories while
keeping provider keys, AWS access, and bot code out of target repo pull
requests.

## What It Does

- Reviews pull requests with Anthropic, OpenAI, or OpenRouter models.
- Supports five review modes:
  - general PR review
  - follow-up commit review
  - WCAG 2.2 AA accessibility analysis
  - i18n analysis
  - crypto/security analysis
- Posts one top-level PR comment per review run.
- Uses hidden metadata so follow-up reviews can find prior bot reviews without
  depending on visible comment text.
- Tracks provider/model/token/cost usage in a separate AWS Aurora PostgreSQL
  Serverless v2 database.
- Expands each admitted trigger into explicit review jobs so the same review
  kind can run through multiple provider/model lanes when configured.
- Supports base-ref repository configuration for per-repo review kinds, lane
  selection, admission tightening, and budget caps.
- Dispatches admitted jobs through explicit worker adapters for local workers
  or central GitHub Actions workflows.
- Fails closed instead of posting a generic review when a live provider returns
  empty visible output.
- Redacts common token, alert-webhook, AWS access-key id, and private-key
  shapes from worker, dispatch, ledger, alert, preflight, and repository-config
  diagnostics before they enter public or operator summaries.
- Records review-job budget and dispatch lifecycle events in a separate
  operator job ledger when enabled.
- Adds run-control claims for duplicate-job and concurrency protection before
  worker dispatch.
- Exposes a read-side usage API contract for public transparency and
  6529.io-authenticated admin dashboards.
- Verifies private admin API calls through a server-side `6529.io` auth bridge
  instead of a separate login system.
- Runs scheduled operator alerts for budget utilization, unusual spend spikes,
  failed jobs, and stale run-control claims.
- Uses GitHub Actions OIDC for AWS access, not long-lived AWS credentials.

## Repository Status

This repository is public and MIT licensed. It is pre-v1 infrastructure: the
core review engine, GitHub App skeleton, admission and budget policy, worker
adapters, usage APIs, admin auth bridge, and scheduled operator alerts are
present, but production deployment, dogfooding, and release tags are still
pending.

For the current release gates, see
[docs/release-readiness.md](docs/release-readiness.md).
For the first pre-v1 tag boundary, see
[docs/v0-release-plan.md](docs/v0-release-plan.md).

## Project Layout

```text
bin/                         Thin runtime and review-mode entrypoints
src/                         Review engine, App, policy, ledger, and alert code
docs/                        Architecture, configuration, operations docs
templates/                   Caller workflow and config examples
.github/                     Community files, issue templates, CI/security
Dockerfile                   Central App server runtime image
AGENTS.md                    Instructions for coding agents working here
```

## Documentation Map

- [Architecture](docs/architecture.md): system boundaries and trust model.
- [Installation](docs/install.md): central App setup and target repo onboarding.
- [Configuration](docs/configuration.md): central runtime settings.
- [GitHub App](docs/github-app.md): permissions, events, and webhook setup.
- [GitHub App Registration](docs/github-app-registration.md): operator packet
  for App creation, credential custody, verification, and rotation.
- [Model Catalog](docs/model-catalog.md): provider defaults and update path.
- [Model Pricing](docs/model-pricing.md): operator-maintained price rows.
- [Budget Policies](docs/budget-policies.md): operator-maintained central caps.
- [Provider Setup](docs/provider-setup.md): Anthropic, OpenAI, and OpenRouter
  operator setup.
- [AWS IAM Templates](infra/aws/README.md): OIDC and Data API policy examples.
- [Repository Config](docs/repository-config.md): target repo policy file.
- [Comment Commands](docs/comment-commands.md): PR comment trigger contract.
- [Review Jobs](docs/review-jobs.md): fanout and provider/model lanes.
- [Review Comment Format](docs/review-comment-format.md): visible comment,
  hidden metadata, and budget-skip format.
- [Reusable Workflow](docs/reusable-workflow.md): compatibility path and
  caller-secret boundary.
- [Run Control](docs/run-control.md): dedupe and concurrency claims.
- [Support](docs/support.md): support bundle and issue triage.
- [Job Ledger](docs/job-ledger.md): durable job lifecycle audit events.
- [Usage API](docs/usage-api.md): public and admin reporting contracts.
- [Deployment](docs/deployment.md): production App, worker, and 6529.io wiring.
- [Container Deployment](docs/container-deployment.md): runtime image,
  secret injection, and container verification.
- [Production Cutover](docs/production-cutover.md): go/no-go checklist and
  private status overlay for moving to live dogfood traffic.
- [Worker Capacity](docs/worker-capacity.md): scaling, backpressure, and
  worker evidence.
- [Dogfood Runbook](docs/dogfood.md): safe phased rollout.
- [Dogfood Target Packet](docs/dogfood-target.md): target-repo config PR
  checklist and conservative posture validation.
- [Dogfood Readiness](docs/dogfood-readiness.md): public-safe dogfood input
  validation before first traffic.
- [Dogfood Status](docs/dogfood-status.md): private status overlay for
  command-only and limited initial-review dogfood evidence.
- [Incident Response](docs/incident-response.md): containment and recovery runbooks.
- [Security Review Status](docs/security-review-status.md): private status
  overlay for manual security review evidence.
- [Release Readiness](docs/release-readiness.md): current gates and gaps.
- [v0 Release Plan](docs/v0-release-plan.md): first tag criteria.
- [Release Candidate Bundle](docs/release-candidate.md): public-safe
  release-readiness summary command.
- [Release Operations Map](docs/release-operations-map.md): command and
  evidence-boundary index for release operators.
- [Operator Workspace](docs/operator-workspace.md): private release evidence
  skeleton bootstrap.
- [Operator Evidence Template](docs/operator-evidence-template.md): redacted
  release/deployment proof format.

## Quick Start

Install dependencies:

```bash
npm install
```

Run local checks:

```bash
npm run check
npm run check:docs
npm run check:public-artifacts
npm test
npm run check:workflow-actions
```

Run the full release gate:

```bash
npm run release:check
```

Validate central runtime configuration without network calls:

```bash
npm run preflight
```

Review the pre-v1 release boundary before tagging:

```bash
cat docs/v0-release-plan.md
```

Render the v0 release gate checklist:

```bash
npm run v0:gates
npm run v0:gates -- -- --init-status <operator-status-file>
npm run v0:gates -- -- --status-file config/v0-release-status.example.json
npm run v0:gates -- -- --status-file <operator-status-file> --summary
npm run v0:gates -- -- --status-file <operator-status-file> --require-ready
```

The final `--require-ready` check also verifies that the status file lists
every current gate, so stale private evidence files fail loudly after the
canonical gate list changes.

Validate a structured operator evidence file and render a redacted public
summary:

```bash
npm run operator:evidence -- -- --file config/production-evidence.example.json
npm run operator:evidence -- -- --file <private-evidence-file> --summary
npm run operator:evidence -- -- --file <private-evidence-file> --require-ready
```

Build a public-safe release candidate bundle from release gates, operator
evidence, git metadata, and no-network preflight:

```bash
npm run release:candidate
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file>
npm run release:candidate -- -- --operator-workspace <private-workspace-dir>
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file>
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file>
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file>
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready
```

Render the release operations map when deciding what to run next:

```bash
npm run release:operations
npm run release:operations -- -- --phase release-candidate
npm run check:release-operations
```

Create a private operator workspace with all release status/evidence
skeletons:

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir>
npm run operator:workspace -- -- --dir <private-workspace-dir> --check
```

Track production cutover readiness from the public checklist plus private
operator status:

```bash
npm run production:cutover
npm run production:cutover -- -- --init-status <operator-cutover-status-file>
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready
```

Print a prompt for a target PR without calling a model:

```bash
GH_REPO=6529-Collections/6529seize-frontend \
PR_NUMBER=123 \
REVIEW_PROVIDER=anthropic \
REVIEW_PRINT_PROMPT=true \
node bin/general-pr-review.cjs
```

Dry-run a generated comment without calling a model:

```bash
GH_REPO=6529-Collections/6529seize-frontend \
PR_NUMBER=123 \
REVIEW_DRY_RUN=true \
node bin/security-analysis.cjs
```

The bot expects `gh` and `git` to be available when gathering PR context.

Validate a target repository config before opening its PR:

```bash
npm run validate:repo-config -- templates/dogfood-repository-config.yml
```

Validate dogfood inputs before first traffic:

```bash
npm run dogfood:target
npm run dogfood:target -- -- --mode limited-initial --require-ready
npm run dogfood:readiness
npm run dogfood:readiness -- -- --preflight
npm run dogfood:readiness -- -- --strict-preflight --require-ready
npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready
```

Use `npm --silent run` when copying dogfood readiness output from commands that
include private workspace paths; normal `npm run` can echo the command line
before the redacted report.

Track private dogfood execution evidence:

```bash
npm run dogfood:status -- -- --init-status <operator-dogfood-status-file>
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --require-ready
```

Track private security review evidence:

```bash
npm run security:review -- -- --init-status <operator-security-status-file>
npm run security:review -- -- --status-file <operator-security-status-file> --summary
npm run security:review -- -- --status-file <operator-security-status-file> --require-ready
```

Validate the GitHub App manifest template:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet
```

Render a production-hosted manifest without generating any secrets:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com
```

Convert GitHub's one-hour manifest code from a private operator environment:

```bash
npm run github-app:convert -- -- --code <code> --output <private-json-path>
```

Mint a short-lived installation token from a configured private operator
environment:

```bash
npm run github-app:token -- -- --profile main --installation-id <installation-id>
npm run github-app:token -- -- --profile worker-dispatch --installation-id <dispatch-installation-id>
```

Print the Aurora ledger schema without touching AWS:

```bash
npm run ledger:schema
```

Preview model pricing SQL without touching AWS:

```bash
npm run model-prices -- -- --file config/model-prices.example.json
```

Applying price rows rejects zero-rate placeholders by default:

```bash
npm run model-prices -- -- --file <reviewed-price-file.json> --apply
```

The apply path also rejects stale or future-dated `sourceCheckedAt` evidence by
default. Recheck provider pricing or record an explicit release acceptance
before using `--allow-stale-source`.

The admin usage API exposes active price-row posture for private dashboards at
`GET /api/admin/model-prices/status`.

Preview central budget policy SQL without touching AWS:

```bash
npm run budget-policies -- -- --file config/budget-policies.example.json
npm run budget-policies -- -- --file config/budget-policies.dogfood.example.json
```

Validate the dashboard/admin API contract:

```bash
npm run validate:api-contract
```

Validate the public-safe 6529.io dashboard env template:

```bash
npm run check:6529-io-env
```

Validate all public env templates:

```bash
npm run check:env-templates
```

Generate a sanitized support bundle:

```bash
npm run support:bundle
```

Collect a private admin API posture snapshot:

```bash
npm run admin:snapshot -- -- --base-url https://reviewbot.example.com
```

Replay a saved GitHub webhook payload without dispatching workers:

```bash
npm run webhook:replay -- -- \
  --payload payload.json \
  --actor-permission write \
  --repository-config templates/dogfood-repository-config.yml \
  --assume-empty-budget
```

## Runtime Configuration

Minimum required environment:

```text
GH_TOKEN                      GitHub token that can read PRs and post comments
GH_REPO                       target repository, owner/name
PR_NUMBER                     target pull request number
REVIEW_PROVIDER               anthropic, openai, or openrouter
```

Provider keys:

```text
ANTHROPIC_API_KEY
OPENAI_API_KEY
OPENROUTER_API_KEY
```

Provider defaults:

```text
REVIEWBOT_MODEL_CATALOG_PATH=config/model-catalog.json
REVIEW_DEFAULT_ANTHROPIC_MODEL=claude-opus-4-8
REVIEW_DEFAULT_OPENAI_MODEL=gpt-5.5
REVIEW_DEFAULT_OPENROUTER_MODEL=
```

Central App job fanout:

```text
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8,openai:gpt-5.5
REVIEWBOT_MAX_JOBS_PER_DELIVERY=50
```

Runtime control:

```text
REVIEWBOT_ENABLED=true
REVIEWBOT_DISABLED_ORGS=
REVIEWBOT_DISABLED_REPOS=
REVIEWBOT_DISABLED_PROVIDERS=
REVIEWBOT_DISABLED_MODELS=
REVIEWBOT_DISABLED_REVIEW_KINDS=
```

Worker adapter:

```text
REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
```

Run control:

```text
REVIEWBOT_RUN_CONTROL_MODE=off|warn|enforce
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=
```

Webhook replay diagnostics:

```bash
npm run webhook:replay -- -- --payload payload.json --assume-empty-budget
```

GitHub App installation auth:

```text
REVIEWBOT_GITHUB_APP_ID=
REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS=10000
REVIEWBOT_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=
```

Usage API:

```text
REVIEWBOT_USAGE_API_PUBLIC_ENABLED=true
REVIEWBOT_USAGE_API_ADMIN_ENABLED=true
REVIEWBOT_USAGE_API_DEFAULT_DAYS=30
REVIEWBOT_USAGE_API_MAX_DAYS=365
REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH=/api/admin/usage/events/recent
REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH=/api/admin/budget/status
REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH=/api/admin/alerts/status
REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH=/api/admin/jobs/recent
REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH=/api/admin/run-claims/recent
REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH=/api/admin/status
REVIEWBOT_USAGE_API_PUBLIC_ORGS=6529-Collections
```

Repository config:

```text
REVIEWBOT_REPOSITORY_CONFIG_SOURCE=none|github
REVIEWBOT_REPOSITORY_CONFIG_REQUIRED=false
```

When enabled, the App reads `.github/6529bot.yml` or another supported config
file from the target repository's base ref. Repo config can narrow central
policy, but it cannot add unapproved model lanes or raise central budget caps.

Admin auth bridge:

```text
REVIEWBOT_ADMIN_AUTH_MODE=disabled|shared_secret|hmac
REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin
```

Scheduled operator alerts:

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns
REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80
REVIEWBOT_ALERTS_SPIKE_MULTIPLIER=3
REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=false
REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD=1
REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2
```

Job lifecycle audit:

```text
REVIEWBOT_JOB_LEDGER_ENABLED=false
REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=false
```

OpenRouter intentionally has no built-in default model. Set
`REVIEW_MODEL` or `REVIEW_DEFAULT_OPENROUTER_MODEL` explicitly so routing and
cost are predictable.

Built-in defaults are defined in
[config/model-catalog.json](config/model-catalog.json). See
[docs/model-catalog.md](docs/model-catalog.md) for the update process.

## Usage Ledger

The AWS usage ledger is optional but recommended. When enabled, the bot writes
one usage event per review run.

```text
REVIEW_USAGE_ENABLED=true
REVIEW_USAGE_AWS_REGION=us-east-1
REVIEW_USAGE_DB_RESOURCE_ARN=arn:aws:rds:...
REVIEW_USAGE_DB_SECRET_ARN=arn:aws:secretsmanager:...
REVIEW_USAGE_DB_NAME=reviewbot
REVIEW_USAGE_DB_SCHEMA=reviewbot
```

For GitHub Actions, configure AWS access with OIDC and the role stored in:

```text
REVIEW_USAGE_AWS_ROLE_ARN=arn:aws:iam::...:role/...
```

See [docs/aws-usage-ledger.md](docs/aws-usage-ledger.md).
Use [docs/job-ledger.md](docs/job-ledger.md) when enabling durable budget and
dispatch audit events.
Use [docs/budget-policies.md](docs/budget-policies.md) to dry-run and apply
central budget caps that are enforced before worker dispatch or provider calls.

From a configured operator environment, apply the schema explicitly with:

```bash
npm run ledger:schema -- -- --apply
```

## Security Model

The bot treats PR diffs, source files, comments, and metadata as untrusted
input. In particular:

- hidden bot metadata is trusted only from configured bot accounts;
- target PR code is read as text and is not executed;
- source context refuses absolute paths, parent traversal, `.git` paths, and
  symlinks;
- provider errors are sanitized before logging;
- empty provider responses fail closed instead of becoming no-finding comments;
- worker, dispatch, ledger, alert, preflight, and repository-config diagnostics
  redact common token, alert-webhook, AWS access-key id, and private-key shapes
  before they are returned;
- provider requests have explicit timeout and token/context caps;
- AWS access uses OIDC and least-privilege Data API permissions.

See [SECURITY.md](SECURITY.md) and [docs/security-model.md](docs/security-model.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Production deployment](docs/deployment.md)
- [Container deployment](docs/container-deployment.md)
- [Dogfood runbook](docs/dogfood.md)
- [Dogfood readiness](docs/dogfood-readiness.md)
- [Dogfood status](docs/dogfood-status.md)
- [GitHub App](docs/github-app.md)
- [GitHub App registration](docs/github-app-registration.md)
- [Model pricing](docs/model-pricing.md)
- [Budget policies](docs/budget-policies.md)
- [Provider setup](docs/provider-setup.md)
- [Repository config](docs/repository-config.md)
- [Review jobs](docs/review-jobs.md)
- [Review comment format](docs/review-comment-format.md)
- [Reusable workflow](docs/reusable-workflow.md)
- [Run control](docs/run-control.md)
- [Support](docs/support.md)
- [Security review status](docs/security-review-status.md)
- [Worker adapters](docs/worker-adapters.md)
- [Worker capacity](docs/worker-capacity.md)
- [Job ledger](docs/job-ledger.md)
- [Usage API](docs/usage-api.md)
- [Admin auth bridge](docs/admin-auth-bridge.md)
- [6529.io admin integration](docs/6529-io-admin-integration.md)
- [Alerting and scheduled operator checks](docs/alerting.md)
- [Admission policy](docs/admission-policy.md)
- [Budget admission](docs/budget-admission.md)
- [Review workflows](docs/review-workflows.md)
- [Roadmap](docs/roadmap.md)
- [AWS usage ledger](docs/aws-usage-ledger.md)
- [AWS IAM templates](infra/aws/README.md)
- [Operations runbook](docs/operations.md)
- [Incident response](docs/incident-response.md)
- [Release process](docs/release.md)
- [Release readiness](docs/release-readiness.md)
- [Release operations map](docs/release-operations-map.md)
- [Operator workspace](docs/operator-workspace.md)
- [Operator evidence template](docs/operator-evidence-template.md)
- [Security review checklist](docs/security-review-checklist.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project uses the MIT license and
expects signed-off commits when that is required by the target 6529 repository.

## License

MIT. See [LICENSE](LICENSE).
