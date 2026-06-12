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
server requires one of them before it will accept GitHub webhooks.

## GitHub App Installation Auth

```text
REVIEWBOT_GITHUB_APP_ID=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_GITHUB_APP_API_URL=https://api.github.com
REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS=540
REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS=60
```

When the App id and private key are configured, `bin/server.cjs` resolves actor
repository permissions and repository config through GitHub App installation
tokens. The private key may be supplied as a PEM string with escaped newlines or
as base64.

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
See [budget-admission.md](budget-admission.md).

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
REVIEW_DEFAULT_ANTHROPIC_MODEL=claude-opus-4-8
REVIEW_DEFAULT_OPENAI_MODEL=gpt-5.5
REVIEW_DEFAULT_OPENROUTER_MODEL=
```

OpenRouter has no built-in default. Configure it explicitly.

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
after an installation-token path is wired in.

Repository config is intentionally not a second source of unlimited authority.
It can disable the bot, narrow review kinds, select from centrally allowed
lanes, lower job fanout, add stricter admission rules, and add tighter budget
caps. It cannot add a model lane that is not already allowed by central
`REVIEWBOT_REVIEW_LANES`, and it cannot raise central budget caps.

See [repository-config.md](repository-config.md).

## Worker Adapters

```text
REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions
REVIEWBOT_WORKER_NODE_BIN=
REVIEWBOT_WORKER_CWD=
REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS=900000
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
REVIEWBOT_WORKER_GITHUB_REF=main
REVIEWBOT_WORKER_GH_BIN=gh
```

`noop` is the safe default. Use `local` for controlled local workers and
`github_actions` to dispatch admitted jobs to a central workflow in this repo.
The node binary, working directory, and `gh` binary overrides are advanced
options with sensible defaults; set them only for non-standard worker
environments.
See [worker-adapters.md](worker-adapters.md).

## Usage API

```text
REVIEWBOT_USAGE_API_PUBLIC_ENABLED=true
REVIEWBOT_USAGE_API_ADMIN_ENABLED=true
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
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
See [admin-auth-bridge.md](admin-auth-bridge.md).

## Alerting And Scheduled Spend Checks

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
REVIEWBOT_ALERTS_LOOKBACK_DAYS=35
REVIEWBOT_ALERTS_MAX_EVENTS=5000
```

Scheduled spend checks read the usage ledger, evaluate budget utilization and
spend spikes, and send alerts through stdout, a webhook, or SNS. See
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
