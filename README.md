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
- Exposes a read-side usage API contract for public transparency and
  6529.io-authenticated admin dashboards.
- Verifies private admin API calls through a server-side `6529.io` auth bridge
  instead of a separate login system.
- Runs scheduled spend checks for budget utilization and unusual usage spikes.
- Uses GitHub Actions OIDC for AWS access, not long-lived AWS credentials.

## Repository Status

This repository is public and MIT licensed. It is pre-v1 infrastructure: the
core review engine, GitHub App skeleton, admission and budget policy, worker
adapters, usage APIs, admin auth bridge, and scheduled spend alerts are present,
but production deployment, dogfooding, and release tags are still pending.

For the current release gates, see
[docs/release-readiness.md](docs/release-readiness.md).

## Project Layout

```text
bin/                         Thin runtime and review-mode entrypoints
src/                         Review engine, App, policy, ledger, and alert code
docs/                        Architecture, configuration, operations docs
templates/                   Caller workflow and config examples
.github/                     Community files, issue templates, CI/security
AGENTS.md                    Instructions for coding agents working here
```

## Quick Start

Install dependencies:

```bash
npm install
```

Run local checks:

```bash
npm run check
npm test
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
REVIEW_DEFAULT_ANTHROPIC_MODEL=claude-opus-4-8
REVIEW_DEFAULT_OPENAI_MODEL=gpt-5.5
REVIEW_DEFAULT_OPENROUTER_MODEL=
```

Central App job fanout:

```text
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8,openai:gpt-5.5
REVIEWBOT_MAX_JOBS_PER_DELIVERY=50
```

Worker adapter:

```text
REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
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

Scheduled spend alerts:

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns
REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80
REVIEWBOT_ALERTS_SPIKE_MULTIPLIER=3
```

OpenRouter intentionally has no built-in default model. Set
`REVIEW_MODEL` or `REVIEW_DEFAULT_OPENROUTER_MODEL` explicitly so routing and
cost are predictable.

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

## Security Model

The bot treats PR diffs, source files, comments, and metadata as untrusted
input. In particular:

- hidden bot metadata is trusted only from configured bot accounts;
- target PR code is read as text and is not executed;
- source context refuses absolute paths, parent traversal, `.git` paths, and
  symlinks;
- provider errors are sanitized before logging;
- provider requests have explicit timeout and token/context caps;
- AWS access uses OIDC and least-privilege Data API permissions.

See [SECURITY.md](SECURITY.md) and [docs/security-model.md](docs/security-model.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Production deployment](docs/deployment.md)
- [Dogfood runbook](docs/dogfood.md)
- [GitHub App](docs/github-app.md)
- [Repository config](docs/repository-config.md)
- [Review jobs](docs/review-jobs.md)
- [Worker adapters](docs/worker-adapters.md)
- [Usage API](docs/usage-api.md)
- [Admin auth bridge](docs/admin-auth-bridge.md)
- [Alerting and scheduled spend checks](docs/alerting.md)
- [Admission policy](docs/admission-policy.md)
- [Budget admission](docs/budget-admission.md)
- [Review workflows](docs/review-workflows.md)
- [Roadmap](docs/roadmap.md)
- [AWS usage ledger](docs/aws-usage-ledger.md)
- [Operations runbook](docs/operations.md)
- [Release process](docs/release.md)
- [Release readiness](docs/release-readiness.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project uses the MIT license and
expects signed-off commits when that is required by the target 6529 repository.

## License

MIT. See [LICENSE](LICENSE).
