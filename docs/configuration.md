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
