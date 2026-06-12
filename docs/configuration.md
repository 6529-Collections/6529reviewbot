# Configuration

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
REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS=540
REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS=60
```

When the App id and private key are configured, `bin/server.cjs` resolves actor
repository permissions and repository config through GitHub App installation
tokens. The private key may be supplied as a PEM string with escaped newlines or
as base64. GitHub API calls made by this auth bridge use the configured timeout
and fail closed when token or collaborator-permission reads cannot complete.

## Admission Policy

```text
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_PRIVATE_REPO_MODE=open
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_TRUSTED_USERS=
REVIEWBOT_TRUSTED_TEAMS=
REVIEWBOT_TRUSTED_ORGS=
REVIEWBOT_TRUSTED_PERMISSION=write
REVIEWBOT_DENY_USERS=
```

Public repositories require trusted actors by default. Private repositories are
open by default. See [admission-policy.md](admission-policy.md).

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
Built-in defaults live in [Model Catalog](model-catalog.md).
Model price rows are maintained separately through
[Model Pricing](model-pricing.md).

## Review Job Lanes

The central App expands admitted events into review jobs. Each job has one
review kind and one provider/model lane.

```text
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8,openai:gpt-5.5
REVIEWBOT_MAX_JOBS_PER_DELIVERY=50
```

Leave `REVIEWBOT_REVIEW_LANES` empty to create one lane from `REVIEW_PROVIDER`
and `REVIEW_MODEL`, or from the provider default variables above.

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
REVIEWBOT_WORKER_GITHUB_REF=main
REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=auto|api|gh
REVIEWBOT_WORKER_GITHUB_TOKEN=
REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID=
REVIEWBOT_WORKER_GITHUB_APP_ID=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_WORKER_GITHUB_API_URL=https://api.github.com
REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS=10000
REVIEWBOT_WORKER_GH_BIN=gh
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
defaults; set them only for non-standard worker environments.
See [worker-adapters.md](worker-adapters.md).

## Webhook Replay Diagnostics

```bash
npm run webhook:replay -- -- --payload payload.json --assume-empty-budget
```

The replay command reads a saved GitHub webhook JSON payload, signs it locally,
and runs it through the same webhook verification, event normalization,
repository config, admission, budget, and job-fanout path as the App server.
It is dry-run by default and does not dispatch workers or call providers.

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
workers or `github_actions` provider secrets that live in the central worker
environment. `--strict` treats warnings as failures for release gates.

`npm run check:preflight` runs deterministic no-network fixtures for the
central App server and worker postures. It is included in
`npm run release:check` so parser drift or missing required settings are caught
before maintainers rely on a live environment.

## Usage API

```text
REVIEWBOT_USAGE_API_PUBLIC_ENABLED=true
REVIEWBOT_USAGE_API_ADMIN_ENABLED=true
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH=/api/admin/jobs/recent
REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH=/api/admin/status
REVIEWBOT_USAGE_API_DEFAULT_DAYS=30
REVIEWBOT_USAGE_API_MAX_DAYS=365
REVIEWBOT_USAGE_API_MAX_ITEMS=50
REVIEWBOT_USAGE_API_MAX_EVENTS=5000
REVIEWBOT_USAGE_API_PUBLIC_REPOS=
REVIEWBOT_USAGE_API_PUBLIC_ORGS=
```

Admin endpoints still fail closed unless the server injects an admin
authorizer. Production should use the existing 6529.io auth system. See
[usage-api.md](usage-api.md).

`REVIEWBOT_USAGE_API_MAX_ITEMS` caps grouped usage summary rows and recent
job-event rows returned by admin endpoints. Keep it low enough that the admin
page cannot accidentally turn diagnostics into an unbounded table scan.

`REVIEWBOT_USAGE_API_PUBLIC_REPOS` and `REVIEWBOT_USAGE_API_PUBLIC_ORGS`
control which repo names may appear on public summaries. Any repo that does not
match those allowlists is collapsed into the public `private` bucket.

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
HMAC actor values cannot contain control characters, and role names must use
letters, digits, underscore, dot, colon, or hyphen.
See [admin-auth-bridge.md](admin-auth-bridge.md).

## Alerting And Scheduled Operator Checks

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns
REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED=false
REVIEWBOT_ALERTS_WEBHOOK_URL=
REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SNS_TOPIC_ARN=
REVIEWBOT_ALERTS_SNS_REGION=
REVIEWBOT_ALERTS_SNS_SUBJECT="6529bot spend alert"
REVIEWBOT_ALERTS_SNS_TIMEOUT_MS=10000
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
alerts through stdout, a webhook, or SNS. See
[alerting.md](alerting.md).

## Cost And Context Controls

```text
REVIEW_MAX_OUTPUT_TOKENS=4000
REVIEW_MAX_CHANGED_FILES=80
REVIEW_MAX_CHANGED_LINES=3500
REVIEW_MAX_DIFF_CHARS=90000
REVIEW_MAX_CONTEXT_CHARS=45000
REVIEW_MAX_INPUT_CHARS=160000
REVIEW_MAX_PRIOR_COMMENTS_CHARS=50000
REVIEW_CONTEXT_LINES=60
REVIEW_OVERSIZE_BEHAVIOR=skip
REVIEW_POST_SKIP_COMMENT=true
REVIEW_PROVIDER_TIMEOUT_MS=120000
REVIEW_TEMPERATURE=0
```

The engine enforces hard maximums above these configurable values. Repository
variables cannot make requests unbounded.

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
AWS_CLI_BIN=
```

When `REVIEW_USAGE_FAIL_CLOSED=false`, a failed ledger write logs a warning but
does not fail the PR review.

`AWS_CLI_BIN` is optional. Set it only when the runtime needs a specific AWS
CLI binary path.
