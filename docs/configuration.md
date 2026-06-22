# Configuration

Run `npm run check:configuration-reference` after editing this reference,
runtime env templates, or related deployment guidance. The configuration
reference contract keeps central App, provider, budget, worker, usage API,
admin auth, alerting, and review-engine controls synchronized.

## Required Runtime Environment

```text
GH_TOKEN
GH_REPO
PR_NUMBER
REVIEW_PROVIDER
```

`GH_REPO` is the target repository in `owner/name` form. `PR_NUMBER` is the
target pull request number.

## GitHub App Webhook

```text
GITHUB_WEBHOOK_SECRET
REVIEWBOT_GITHUB_WEBHOOK_SECRET
REVIEWBOT_WEBHOOK_PATH=/webhooks/github
REVIEWBOT_WEBHOOK_MAX_BODY_BYTES=2097152
PORT=8080
```

`GITHUB_WEBHOOK_SECRET` and `REVIEWBOT_GITHUB_WEBHOOK_SECRET` are aliases. The
server requires one of them before it will accept GitHub webhooks. Production
secrets should be high-entropy and at least 32 characters; preflight warns when
the configured value is shorter.

## GitHub App Installation Auth

```text
REVIEWBOT_GITHUB_APP_ID=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_GITHUB_APP_API_URL=https://api.github.com
REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS=10000
REVIEWBOT_GITHUB_APP_FETCH_RETRIES=2
REVIEWBOT_GITHUB_APP_RETRY_BASE_DELAY_MS=500
REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS=540
REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS=60
```

When the App id and private key are configured, `bin/server.cjs` resolves actor
repository permissions and repository config through GitHub App installation
tokens. The private key may be supplied as a PEM string with escaped newlines or
as base64. GitHub API calls made by this auth bridge use the configured timeout
and bounded retry settings, then fail closed when token or
collaborator-permission reads cannot complete.
`REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS` defaults to 540 seconds and must not
exceed GitHub's 600-second App JWT limit.
Run `npm run check:github-app-auth` after changing GitHub App auth env parsing,
JWT TTL, installation-token refresh buffering, or token profile behavior.

## Webhook Inbox

```text
REVIEWBOT_WEBHOOK_INBOX_ENABLED=false
REVIEWBOT_WEBHOOK_INBOX_FAIL_CLOSED=false
REVIEWBOT_WEBHOOK_INBOX_AWS_REGION=
REVIEWBOT_WEBHOOK_INBOX_DB_NAME=
REVIEWBOT_WEBHOOK_INBOX_DB_RESOURCE_ARN=
REVIEWBOT_WEBHOOK_INBOX_DB_SCHEMA=
REVIEWBOT_WEBHOOK_INBOX_DB_SECRET_ARN=
REVIEWBOT_WEBHOOK_INBOX_RETRY_DELAY_SECONDS=90
REVIEWBOT_WEBHOOK_INBOX_MAX_ATTEMPTS=6
REVIEWBOT_WEBHOOK_INBOX_POLL_INTERVAL_MS=15000
REVIEWBOT_WEBHOOK_INBOX_BATCH_SIZE=2
```

When enabled, the App server records a normalized webhook event before PR
hydration, repository config reads, run-control admission, or worker dispatch.
Transient hydration failures and run-control concurrency denials are marked for
retry and drained in small batches by the server process. The inbox reuses
`REVIEW_USAGE_*` Data API settings when the inbox-specific database variables
are blank. Keep `FAIL_CLOSED=false` for production availability unless the
operator wants webhook delivery to fail whenever the inbox write fails.

## Admission Policy

```text
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_PRIVATE_REPO_MODE=open
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_ALLOWED_PR_AUTHORS=
REVIEWBOT_TRUSTED_USERS=
REVIEWBOT_TRUSTED_TEAMS=
REVIEWBOT_TRUSTED_ORGS=
REVIEWBOT_TRUSTED_PERMISSION=write
REVIEWBOT_DENY_USERS=
```

Public repositories require trusted actors by default. Private repositories are
open by default. `REVIEWBOT_ALLOWED_PR_AUTHORS`, when set, is a comma-separated
PR author allowlist that must match before trusted-actor checks can admit model
work. `REVIEWBOT_DRAFT_PR_MODE=skip` skips automatic draft PR events but still
allows trusted comment commands; use `skip_all`, `auto_only`, or `allow` for the
other draft-review combinations. See [admission-policy.md](admission-policy.md).

## Budget Admission

```text
REVIEWBOT_BUDGET_MODE=enforce
REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD=1
REVIEWBOT_BUDGET_GLOBAL_DAILY_USD=
REVIEWBOT_BUDGET_GLOBAL_WEEKLY_USD=
REVIEWBOT_BUDGET_GLOBAL_MONTHLY_USD=
REVIEWBOT_BUDGET_ORG_DAILY_USD=
REVIEWBOT_BUDGET_REPO_DAILY_USD=
REVIEWBOT_BUDGET_REQUESTOR_DAILY_USD=
REVIEWBOT_BUDGET_PR_DAILY_USD=
REVIEWBOT_BUDGET_PROVIDER_DAILY_USD=
REVIEWBOT_BUDGET_MODEL_DAILY_USD=
REVIEWBOT_BUDGET_REVIEW_KIND_DAILY_USD=
```

Every budget scope supports `_DAILY_USD`, `_WEEKLY_USD`, and `_MONTHLY_USD`.
Central DB policy rows can also be applied with `npm run budget-policies` and
are loaded into admission when `REVIEW_USAGE_ENABLED=true`. See
[budget-admission.md](budget-admission.md) and
[budget-policies.md](budget-policies.md).

## Providers

```text
REVIEW_PROVIDER=anthropic|openai|openrouter
REVIEW_MODEL=
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

OpenRouter has no built-in default. Configure it explicitly.
The advisory GLM swarm path pins its own explicit OpenRouter model,
`z-ai/glm-5.2`, and does not change `REVIEW_DEFAULT_OPENROUTER_MODEL`.
Built-in defaults live in [Model Catalog](model-catalog.md).
Model price rows are maintained separately through
[Model Pricing](model-pricing.md).

Optional price-source freshness settings:

```text
REVIEWBOT_MODEL_PRICE_FILE=
REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS=30
```

When `REVIEWBOT_MODEL_PRICE_FILE` points at an operator-owned price file,
preflight validates that every row has a current `sourceCheckedAt` timestamp.
The default maximum age is 30 days, and future-dated checks are rejected. Keep
real price files outside public commits when they include rollout notes or
provider-account context.

## Review Job Lanes

The central App expands admitted events into review jobs. Each job has one
review kind and one provider/model lane.

```text
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8,openai:gpt-5.5
REVIEWBOT_MAX_JOBS_PER_DELIVERY=12
```

Leave `REVIEWBOT_REVIEW_LANES` empty to create one lane from `REVIEW_PROVIDER`
and `REVIEW_MODEL`, or from the provider default variables above.

The default max-jobs cap is `12`, enough for the four default initial review
kinds across two provider/model lanes, or for a one-lane specialist profile
such as `6529-safe-app` with GLM swarm and responsiveness. Raise it
deliberately for trusted high-volume deployments after budgets and worker
capacity have been reviewed.

Use explicit OpenRouter lanes because OpenRouter model routing affects cost and
provider trust:

```text
REVIEWBOT_REVIEW_LANES=openrouter:anthropic/claude-sonnet-4
```

See [review-jobs.md](review-jobs.md).

## Runtime Control

Runtime control is a central pause layer that runs before budget checks and
worker dispatch. Use it for emergency stops and temporary pauses without
editing target repositories:

```text
REVIEWBOT_ENABLED=true
REVIEWBOT_DISABLED_REASON=
REVIEWBOT_DISABLED_ORGS=
REVIEWBOT_DISABLED_REPOS=
REVIEWBOT_DISABLED_PROVIDERS=
REVIEWBOT_DISABLED_MODELS=
REVIEWBOT_DISABLED_REVIEW_KINDS=
```

Examples:

```text
REVIEWBOT_ENABLED=false
REVIEWBOT_DISABLED_REASON=Paused while rotating provider keys.
REVIEWBOT_DISABLED_REPOS=6529-Collections/example
REVIEWBOT_DISABLED_PROVIDERS=openrouter
REVIEWBOT_DISABLED_MODELS=gpt-5.5
REVIEWBOT_DISABLED_REVIEW_KINDS=wcag,i18n
```

To stop the GLM swarm path specifically, either disable review kind
`glm-swarm` through runtime control or set:

```text
REVIEW_GLM_SWARM_ENABLED=false
```

Event-level org/repo/review-kind pauses happen before admission. Provider,
model, and review-kind job pauses happen after job fanout and before budget
admission, so disabled jobs do not reserve budget, consume run-control slots,
or call providers.

## Run Control

```text
REVIEWBOT_RUN_CONTROL_MODE=off|warn|enforce
REVIEWBOT_RUN_CONTROL_DEDUPE_ENABLED=true
REVIEWBOT_RUN_CONTROL_DEDUPE_TTL_SECONDS=86400
REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_ORG_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false
REVIEWBOT_RUN_CONTROL_LEDGER_CLAIM_TTL_SECONDS=3600
```

Run control claims jobs after budget admission and before worker dispatch. Use
it to dedupe replayed deliveries and cap parallel runs by org, repo, PR,
requestor, provider, model, or review kind. Default mode is `off`; production
should move to `enforce` only after the durable claim table is applied and
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` is configured. See
[run-control.md](run-control.md).

## Repository Configuration

Repository configuration is optional. When enabled, the App reads the first
matching file from the target repository's base ref:

```text
.github/6529bot.yml
.github/6529bot.yaml
.github/6529bot.json
.6529reviewbot.yml
.6529reviewbot.yaml
.6529reviewbot.json
```

Runtime controls:

```text
REVIEWBOT_REPOSITORY_CONFIG_SOURCE=none|github
REVIEWBOT_REPOSITORY_CONFIG_PATHS=.github/6529bot.yml,.github/6529bot.yaml,.github/6529bot.json,.6529reviewbot.yml,.6529reviewbot.yaml,.6529reviewbot.json
REVIEWBOT_REPOSITORY_CONFIG_REQUIRED=false
REVIEWBOT_REPOSITORY_CONFIG_MAX_BYTES=65536
REVIEWBOT_GITHUB_TOKEN=
GITHUB_TOKEN=
```

The default source is `none`, which means the App uses central policy only.
Production GitHub App deployments should set `REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github`
after an installation-token path is wired in. When the source is `none`, the App
does not mint an installation token for repository config loading.
`REVIEWBOT_GITHUB_TOKEN` and `GITHUB_TOKEN` are fallback token sources for
development and non-App integrations. Production central App deployments should
prefer installation tokens minted from `REVIEWBOT_GITHUB_APP_ID` and the App
private key.

Repository config is intentionally not a second source of unlimited authority.
It can disable the bot, narrow review kinds, select from centrally allowed
lanes, lower job fanout, add stricter admission rules, and add tighter budget
caps. It cannot add a model lane that is not already allowed by central
`REVIEWBOT_REVIEW_LANES`, and it cannot raise central budget caps.

For `6529-safe-app`, enable the Safe App specialist lanes in the repository's
base-ref config instead of the global initial set:

```yaml
version: 1
enabled: true

reviewKinds:
  allowed: [general, followup, wcag, i18n, security, deploy-actions, auth-api, db-lambda, media-external, safe-write, release-deploy, privacy-evidence, signer-ux, glm-swarm, responsiveness]
  initial: [general, i18n, security, safe-write, release-deploy, privacy-evidence, signer-ux, responsiveness, glm-swarm]
  followup: [followup]

limits:
  maxJobsPerDelivery: 9
```

That profile assumes one configured provider/model lane for model-backed
reviews. If central `REVIEWBOT_REVIEW_LANES` contains multiple ordinary lanes,
raise or narrow caps deliberately after reviewing budget and worker capacity.

See [repository-config.md](repository-config.md).

## Job Ledger

```text
REVIEWBOT_JOB_LEDGER_AWS_REGION=
REVIEWBOT_JOB_LEDGER_DB_NAME=
REVIEWBOT_JOB_LEDGER_DB_RESOURCE_ARN=
REVIEWBOT_JOB_LEDGER_DB_SCHEMA=
REVIEWBOT_JOB_LEDGER_DB_SECRET_ARN=
REVIEWBOT_JOB_LEDGER_ENABLED=false
REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=false
```

The job ledger records budget and dispatch lifecycle events for review jobs.
It is operational telemetry, not spend accounting. By default it reuses the
usage-ledger Aurora Data API settings. Keep it best-effort during dogfood so a
temporary audit-write failure does not block PR review. See
[job-ledger.md](job-ledger.md).

## Worker Adapters

```text
REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions
REVIEWBOT_WORKER_NODE_BIN=
REVIEWBOT_WORKER_CWD=
REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS=900000
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
REVIEWBOT_WORKER_GITHUB_RESPONSIVENESS_WORKFLOW=responsiveness-review.yml
REVIEWBOT_WORKER_GITHUB_REF=main
REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=auto|api|gh
REVIEWBOT_WORKER_GITHUB_TOKEN=
REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID=
REVIEWBOT_WORKER_GITHUB_APP_ID=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_WORKER_GITHUB_API_URL=https://api.github.com
REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS=10000
REVIEWBOT_WORKER_GITHUB_FETCH_RETRIES=2
REVIEWBOT_WORKER_GITHUB_RETRY_BASE_DELAY_MS=500
REVIEWBOT_WORKER_GH_BIN=gh
REVIEWBOT_WORKER_INCLUDE_OUTPUT=false
REVIEWBOT_RESPONSIVENESS_ESTIMATED_COST_USD=1
REVIEWBOT_RESPONSIVENESS_VISUAL_ESTIMATED_COST_USD=5
REVIEWBOT_RESPONSIVENESS_AI_ENABLED=false
REVIEWBOT_RESPONSIVENESS_AI_MODEL=claude-opus-4-8
REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGES=48
REVIEWBOT_RESPONSIVENESS_AI_MAX_SOURCE_IMAGE_BYTES=40000000
REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_BYTES=8000000
REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_DIMENSION=1600
REVIEWBOT_RESPONSIVENESS_AI_IMAGE_QUALITY=82
REVIEWBOT_RESPONSIVENESS_AI_MAX_OUTPUT_TOKENS=1800
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_ENABLED=false
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_AWS_REGION=
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_AWS_ROLE_ARN=
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_S3_BUCKET=
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_S3_PREFIX=responsiveness
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_VIEWER_BASE_URL=
REVIEWBOT_RESPONSIVENESS_ARTIFACTS_VIEWER_PATH_PREFIX=/artifacts/responsiveness
REVIEW_GLM_SWARM_ENABLED=true
REVIEW_GLM_SWARM_MAX_REVIEWERS=4
REVIEW_GLM_SWARM_MAX_FILES_PER_REVIEWER=12
REVIEW_GLM_SWARM_REVIEWER_MAX_OUTPUT_TOKENS=1200
REVIEW_GLM_SWARM_SYNTHESIS_MAX_OUTPUT_TOKENS=1800
REVIEW_GLM_SWARM_MAX_TOTAL_OUTPUT_TOKENS=7000
REVIEW_GLM_SWARM_MAX_REVIEWER_DIFF_CHARS=60000
REVIEW_GLM_SWARM_MAX_REVIEWER_CONTEXT_CHARS=30000
REVIEW_GLM_SWARM_MAX_SYNTHESIS_INPUT_CHARS=150000
REVIEW_GLM_SWARM_MAX_COST_USD=2
REVIEW_GLM_SWARM_OPENROUTER_CREDENTIAL_TARGET=OPENROUTER_API_KEY
REVIEW_GLM_SWARM_RAW_OUTPUTS_MODE=off|s3
REVIEW_GLM_SWARM_RAW_OUTPUTS_FAIL_CLOSED=false
REVIEW_GLM_SWARM_RAW_OUTPUTS_AWS_REGION=
REVIEW_GLM_SWARM_RAW_OUTPUTS_S3_BUCKET=
REVIEW_GLM_SWARM_RAW_OUTPUTS_S3_PREFIX=glm-swarm
```

`noop` is the safe default. Use `local` for controlled local workers and
`github_actions` to dispatch admitted jobs to a central workflow in this repo.
Production container deployments should set
`REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api` and
`REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID` so the server mints a short-lived
installation token. Use the optional `REVIEWBOT_WORKER_GITHUB_APP_*`
credentials for a dispatch-only GitHub App installed on the central bot
repository, or omit them to reuse the main App credentials after accepting the
broader `Actions: write` permission tradeoff on every repository where that
App is installed. `REVIEWBOT_WORKER_GITHUB_TOKEN` is the explicit bot-owned
token fallback. `auto` uses API dispatch when either token source is present
and falls back to `gh` otherwise. The node binary, working directory, GitHub
API URL, timeout, and `gh` binary overrides are advanced options with sensible
defaults. API dispatch retries transient network, 429, and GitHub 5xx failures
using the configured retry count and base delay; set these only for
non-standard worker environments. Set
`REVIEWBOT_WORKER_INCLUDE_OUTPUT=true` only for controlled diagnostics; worker
stdout/stderr summaries are redacted and tail-limited, but they still belong in
operator-owned logs.
Provider-backed jobs dispatch to `REVIEWBOT_WORKER_GITHUB_WORKFLOW`.
Responsiveness jobs dispatch to
`REVIEWBOT_WORKER_GITHUB_RESPONSIVENESS_WORKFLOW`, record provider `github`,
model `actions-ubuntu-latest`, and use
`REVIEWBOT_RESPONSIVENESS_ESTIMATED_COST_USD` for budget admission and usage
events. When `REVIEWBOT_RESPONSIVENESS_AI_ENABLED=true`, the central server
also reserves `REVIEWBOT_RESPONSIVENESS_VISUAL_ESTIMATED_COST_USD` for the
Opus screenshot pass, and the worker records a second usage row with
review kind `responsiveness_visual`, provider `anthropic`, and the configured
visual model. The comment job keeps full-resolution screenshots in the
artifact store for humans, but resizes local provider copies to
`REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_DIMENSION` and encodes them as JPEG at
`REVIEWBOT_RESPONSIVENESS_AI_IMAGE_QUALITY` before calling Opus. This keeps
many-image requests inside provider dimension limits while preserving links to
the original screenshots. `REVIEWBOT_RESPONSIVENESS_AI_MAX_SOURCE_IMAGE_BYTES`
bounds source PNGs before image processing, while
`REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_BYTES` bounds each resized provider
image. The S3 artifact variables are optional: when
enabled, the comment job uploads screenshots and safe runner JSON to private S3
and links them through the App server viewer path. The viewer route redirects
to short-lived presigned S3 URLs; target repositories still do not receive AWS
credentials.
The GLM swarm path is advisory and fixed to OpenRouter model `z-ai/glm-5.2`.
It fans out internally to risk-selected reviewer prompts, then posts one
comment titled `6529bot GLM Swarm Review`. It is a feedback loop for Codex and
maintainers, not a replacement for existing tests, responsiveness runs, or
existing Opus-backed reviewbot lanes. `REVIEW_GLM_SWARM_ENABLED=false` is a
path-specific kill switch. The GLM-specific reviewer, synthesis, total output,
input, and actual-cost caps are enforced inside the worker in addition to
ordinary job budget admission. Local Windows workers may resolve the
OpenRouter key from Credential Manager target `OPENROUTER_API_KEY` when the
environment variable is absent; the secret is used only in-process and is never
printed or written to raw-output artifacts.

The `stream-contracts` review kind is an ordinary provider-backed job with a
6529Stream-specific smart-contract prompt. Enable it only through repository
config or explicit maintainer commands for `6529-Collections/6529Stream` or an
intentionally equivalent contract repository.

`REVIEW_GLM_SWARM_RAW_OUTPUTS_MODE=s3` stores raw internal reviewer and
synthesis outputs in the configured private S3 bucket for approved operator
infrastructure. `off` is the default. Git LFS and repository commits are not
supported raw-output retention modes.
See [worker-adapters.md](worker-adapters.md).

Partial worker App credential overrides fail preflight. Set both
`REVIEWBOT_WORKER_GITHUB_APP_ID` and either
`REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY` or
`REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64`, or leave all worker App
credential overrides blank to reuse the main App deliberately. Reusing the
main App now produces a preflight warning so the permission expansion is
visible in release evidence.

## Webhook Replay Diagnostics

```bash
npm run webhook:replay -- -- --payload payload.json --assume-empty-budget
```

The replay command reads a saved GitHub webhook JSON payload, signs it locally,
and runs it through the same webhook verification, event normalization,
repository config, admission, budget, and job-fanout path as the App server.
It is dry-run by default and does not dispatch workers or call providers.

The replay safety contract is checked by:

```bash
npm run check:webhook-replay
```

Useful diagnostic flags:

```text
--event pull_request
--delivery replay-123
--actor maintainer
--actor-permission write
--org-member
--repository-config templates/dogfood-repository-config.yml
--assume-empty-budget
--estimated-cost-usd 0.25
--dispatch
```

Use `--dispatch` only from a controlled bot environment after checking the
payload, actor, repository config, and budget assumptions.

## Production Preflight

```bash
npm run preflight
npm run preflight -- -- --json
npm run preflight -- -- --strict
```

The preflight command validates runtime configuration without calling GitHub,
AWS, model providers, or alert endpoints. It reuses the actual settings parsers
for webhook, GitHub App auth, model catalog, review lanes, admission, budget,
run control, repository config, worker adapter, usage/job ledgers, usage API,
admin auth, and alerts.

Warnings describe intentionally disabled or external pieces, such as `noop`
workers or `github_actions` provider secrets that live as central worker
secrets, not App Runner environment variables. `--strict` treats warnings as
failures for release gates.

`npm run check:preflight` runs deterministic no-network fixtures for the
central App server and worker postures. It is included in
`npm run release:check` so parser drift or missing required settings are caught
before maintainers rely on a live environment.

`npm run check:preflight-contract` keeps the preflight check order, strict and
profile behavior, CLI flags, redacted diagnostics, and public docs synchronized.

Public env examples are checked separately with:

```bash
npm run check:env-templates
```

This validates syntax, duplicate keys, blank secret placeholders, and the
conservative dogfood defaults. It does not replace runtime preflight in a
private operator environment.

## Usage API

```text
REVIEWBOT_USAGE_API_PUBLIC_ENABLED=true
REVIEWBOT_USAGE_API_ADMIN_ENABLED=true
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH=/api/admin/usage/events/recent
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH=/api/admin/budget/status
REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH=/api/admin/model-prices/status
REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH=/api/admin/alerts/status
REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH=/api/admin/jobs/recent
REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH=/api/admin/run-claims/recent
REVIEWBOT_USAGE_API_ADMIN_WEBHOOK_INBOX_PATH=/api/admin/webhook-inbox/recent
REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH=/api/admin/status
REVIEWBOT_USAGE_API_CACHE_ENABLED=true
REVIEWBOT_USAGE_API_CACHE_TTL_MS=15000
REVIEWBOT_USAGE_API_CACHE_MAX_ENTRIES=100
REVIEWBOT_USAGE_API_DEFAULT_DAYS=30
REVIEWBOT_USAGE_API_MAX_DAYS=365
REVIEWBOT_USAGE_API_MAX_ITEMS=50
REVIEWBOT_USAGE_API_MAX_EVENTS=5000
REVIEWBOT_USAGE_API_PUBLIC_REPOS=
REVIEWBOT_USAGE_API_PUBLIC_ORGS=
REVIEWBOT_USAGE_API_BASE_URL=
REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS=10000
REVIEWBOT_USAGE_API_ADMIN_ACTOR=6529.io
REVIEWBOT_USAGE_API_ADMIN_ROLES=reviewbot-admin
```

Admin endpoints still fail closed unless the server injects an admin
authorizer. Production should use the existing 6529.io auth system. See
[usage-api.md](usage-api.md).

`REVIEWBOT_USAGE_API_MAX_ITEMS` caps grouped usage summary rows and recent
job-event, run-claim, and webhook-inbox rows returned by admin endpoints. For
raw admin usage-event reads it sets the default page size when it is lower than
`REVIEWBOT_USAGE_API_MAX_EVENTS`.

The App server caches successful usage API `GET` responses after authorization.
`REVIEWBOT_USAGE_API_CACHE_TTL_MS` keeps the cache short-lived for dashboards,
and `REVIEWBOT_USAGE_API_CACHE_MAX_ENTRIES` bounds each App Runner instance's
in-memory cache.

`REVIEWBOT_USAGE_API_MAX_EVENTS` caps raw usage-event reads, including the
admin recent usage-events endpoint and summary loaders. Keep both limits low
enough that the admin page cannot accidentally turn diagnostics into an
unbounded table scan.

`REVIEWBOT_USAGE_API_PUBLIC_REPOS` and `REVIEWBOT_USAGE_API_PUBLIC_ORGS`
control which repo names may appear on public summaries. Any repo that does not
match those allowlists is collapsed into the public `private` bucket.

`REVIEWBOT_USAGE_API_BASE_URL` and `REVIEWBOT_USAGE_API_ADMIN_*` are for
trusted server-side clients such as the private 6529.io admin page. Do not
expose the matching HMAC secret to browser JavaScript. See
[6529.io Admin Integration](6529-io-admin-integration.md).

The public-safe 6529.io frontend env-name template lives at
`templates/6529-io-reviewbot-env.example` and is checked by
`npm run check:6529-io-env`.

## Admin Auth Bridge

```text
REVIEWBOT_ADMIN_AUTH_MODE=disabled|shared_secret|hmac
REVIEWBOT_ADMIN_AUTH_SHARED_SECRET=
REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=
REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin
REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300
```

`disabled` is the fail-closed default. `hmac` lets the existing `6529.io` auth
system sign short-lived admin assertions for bot-owned private API endpoints.
HMAC actor values cannot contain control characters. Configured required roles
and incoming role names must be 1-80 characters using only letters, digits,
underscore, dot, colon, or hyphen.
See [admin-auth-bridge.md](admin-auth-bridge.md).

## Alerting And Scheduled Operator Checks

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns|ses
REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED=false
REVIEWBOT_ALERTS_WEBHOOK_URL=
REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SNS_TOPIC_ARN=
REVIEWBOT_ALERTS_SNS_REGION=
REVIEWBOT_ALERTS_SNS_SUBJECT="6529bot spend alert"
REVIEWBOT_ALERTS_SNS_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SES_FROM=
REVIEWBOT_ALERTS_SES_TO=
REVIEWBOT_ALERTS_SES_REGION=
REVIEWBOT_ALERTS_SES_SUBJECT="6529bot operator alert"
REVIEWBOT_ALERTS_SES_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80
REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT=100
REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS=24
REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS=7
REVIEWBOT_ALERTS_SPIKE_MULTIPLIER=3
REVIEWBOT_ALERTS_SPIKE_MIN_USD=25
REVIEWBOT_ALERTS_SPIKE_DIMENSIONS=global,repo,requestor,provider,model,review_kind
REVIEWBOT_ALERTS_SPIKE_ALERT_ON_NEW_SPEND=true
REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=false
REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS=6
REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD=1
REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2
REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD=1
REVIEWBOT_ALERTS_JOB_MAX_ALERTS=25
REVIEWBOT_ALERTS_LOOKBACK_DAYS=35
REVIEWBOT_ALERTS_MAX_EVENTS=5000
```

Scheduled operator checks read the usage/job ledgers, evaluate budget
utilization, spend spikes, failed jobs, and stale run-control claims, and send
alerts through stdout, a webhook, SNS, or SES email. See
[alerting.md](alerting.md).

## Cost And Context Controls

```text
REVIEW_MAX_OUTPUT_TOKENS=4000
REVIEW_MAX_CHANGED_FILES=300
REVIEW_MAX_CHANGED_LINES=30000
REVIEW_LARGE_PR_CHANGED_LINES=3500
REVIEW_MAX_DIFF_CHARS=250000
REVIEW_MAX_CONTEXT_CHARS=100000
REVIEW_MAX_INPUT_CHARS=350000
REVIEW_MAX_PRIOR_COMMENTS_CHARS=50000
REVIEW_CONTEXT_LINES=60
REVIEW_DRAFT_PR_MODE=skip
REVIEW_OVERSIZE_BEHAVIOR=skip
REVIEW_POST_SKIP_COMMENT=true
REVIEW_POST_FAILURE_COMMENT=true
REVIEW_PROVIDER_TIMEOUT_MS=120000
REVIEW_TEMPERATURE=0
```

The engine enforces hard maximums above these configurable values. Repository
variables cannot make requests unbounded.

`REVIEW_DRAFT_PR_MODE` controls the worker's final source check for draft PRs.
The central `review-job.yml` sets it to `allow` because webhook admission has
already decided whether draft work is allowed. Standalone workflows default to
`skip`.

`REVIEW_MAX_CHANGED_LINES` remains a skip gate when
`REVIEW_OVERSIZE_BEHAVIOR=skip`. `REVIEW_LARGE_PR_CHANGED_LINES` is a softer
prompt threshold: above it, 6529bot tells the model that large-PR mode is active
and warns when diff, prior-comment, or changed-file context was truncated.
When GitHub's PR diff API refuses a very large patch, the central worker tries
a local `git diff` fallback using immutable base and head SHAs from the job
payload. If diff hydration still fails before a provider call,
`REVIEW_POST_FAILURE_COMMENT=true` posts a bounded operational-failure comment
on the PR so maintainers can see why the command or automatic review did not
produce a model-backed comment.

For Anthropic Claude Opus 4.8 and 4.7, the bot omits `temperature` because
those Messages API models reject non-default sampling parameters. Other
Anthropic models keep using `REVIEW_TEMPERATURE`.

## OpenAI Options

```text
REVIEW_OPENAI_REASONING=auto|always|never
REVIEW_OPENAI_VERBOSITY=auto|always|never
REVIEW_REASONING_EFFORT=low
REVIEW_VERBOSITY=low
```

In `auto`, the bot sends model-specific fields only for model families it
knows support them.

## Trusted Metadata Authors

```text
REVIEW_TRUSTED_MARKER_AUTHORS=6529bot[bot],github-actions[bot]
```

Only comments by these authors can contribute hidden 6529bot metadata to
follow-up state. Other comments are still included for dedupe, but their hidden
metadata is ignored.

## Usage Ledger

```text
REVIEW_USAGE_ENABLED=true
REVIEW_USAGE_AWS_REGION=us-east-1
REVIEW_USAGE_AWS_ROLE_ARN=arn:aws:iam::...
REVIEW_USAGE_DB_RESOURCE_ARN=arn:aws:rds:...
REVIEW_USAGE_DB_SECRET_ARN=arn:aws:secretsmanager:...
REVIEW_USAGE_DB_NAME=reviewbot
REVIEW_USAGE_DB_SCHEMA=reviewbot
REVIEW_USAGE_FAIL_CLOSED=false
REVIEWBOT_DATA_API_CLIENT=auto
AWS_CLI_BIN=
```

When `REVIEW_USAGE_FAIL_CLOSED=false`, a failed ledger write logs a warning but
does not fail the PR review.

`REVIEWBOT_DATA_API_CLIENT` supports `auto`, `aws-cli`, or `node`. `auto` uses
the AWS CLI when it is present and falls back to the built-in signed HTTPS
client when the binary is unavailable, such as in the production App Runner
image. `AWS_CLI_BIN` is optional. Set it only when the runtime needs a specific
AWS CLI binary path.
