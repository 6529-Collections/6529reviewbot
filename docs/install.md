# Installation And Onboarding

This guide is the shortest path from a fresh `6529reviewbot` checkout to a
conservative dogfood installation of the central GitHub App named `6529bot`.

`6529reviewbot` is pre-v1 infrastructure. Start with one trusted repository,
`noop` workers, strict budgets, and command-only reviews. Move to live model
calls only after webhook delivery, admission, budget, ledger, and rollback
paths are verified.

## 1. Prepare The Bot Repository

```bash
npm install
npm run release:check
npm run check:install-guide
npm run preflight
```

Read:

- [architecture.md](architecture.md)
- [security-model.md](security-model.md)
- [release-readiness.md](release-readiness.md)
- [v0-release-plan.md](v0-release-plan.md)
- [production-cutover.md](production-cutover.md)

## 2. Create The GitHub App

Create a GitHub App named `6529bot`.

Start from:

```text
templates/github-app-manifest.example.json
```

Replace `<bot-host>` with the production App server hostname and review the
permissions/events before registration. Keep GitHub-generated values such as
the App id, client secret, webhook secret, and private key in the bot runtime
secret store only.

Validate the rendered manifest:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet
npm run check:github-app-manifest
npm run check:github-app-auth
npm run check:github-app-routes
```

When using GitHub's manifest flow, render a local registration form:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com \
  --form \
  --owner 6529-Collections \
  --state <unguessable-state>
```

After GitHub redirects back with the one-hour manifest code, exchange it from a
private operator environment:

```bash
npm run github-app:convert -- -- --code <code> --output <private-json-path>
```

The redirect page intentionally shows only operator guidance. It does not echo
the code value or exchange credentials on the public App server.
`npm run check:install-guide` keeps this conservative dogfood installation
path synchronized with the GitHub App validation commands, runtime defaults,
target-repo posture, and rollback controls.

Minimum recommended permissions:

```text
Contents: read
Issues: write
Metadata: read
Pull requests: read
Members: read
```

Subscribe to:

```text
Issue comment
Pull request
```

Set the webhook URL to:

```text
https://<bot-host>/webhooks/github
```

Store the webhook secret and App private key only in the bot runtime secret
store. See [github-app-registration.md](github-app-registration.md),
[github-app.md](github-app.md), and [deployment.md](deployment.md).

## 3. Configure Central Runtime

Start from:

```text
templates/dogfood-central-env.example
```

Keep these conservative defaults for the first pass:

```text
REVIEWBOT_ENABLED=true
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8
REVIEWBOT_MAX_JOBS_PER_DELIVERY=8
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api
REVIEWBOT_BUDGET_MODE=enforce
REVIEWBOT_JOB_LEDGER_ENABLED=true
REVIEW_USAGE_ENABLED=true
```

Configure secret families in bot-owned infrastructure:

- GitHub App id, private key, and webhook secret;
- provider keys for the enabled lanes;
- AWS Data API access for the isolated Aurora ledger;
- alert delivery credentials, if not using `stdout`;
- 6529.io admin-auth HMAC secret, when private admin routes are enabled.

Provider setup is documented in [provider-setup.md](provider-setup.md). Runtime
settings are documented in [configuration.md](configuration.md).

## 4. Prepare The Ledger

Preview and apply the schema from an operator environment with AWS access:

```bash
npm run ledger:schema
npm run ledger:schema -- -- --apply
```

If provider cost estimates should come from maintained price rows, review a
price file and apply it:

```bash
npm run model-prices -- -- --file config/model-prices.example.json
npm run model-prices -- -- --file <reviewed-price-file.json> --apply
```

`--apply` rejects zero-rate rows by default. Use `--allow-zero-price` only when
the provider explicitly documents a free model or token class and the evidence
is captured in the private operator runbook.
It also rejects stale source-check evidence by default; re-check provider
pricing or record an explicit release acceptance before using
`--allow-stale-source`.

See [aws-usage-ledger.md](aws-usage-ledger.md) and
[model-pricing.md](model-pricing.md).

Review and apply conservative central budget rows before enabling live workers:

```bash
npm run budget-policies -- -- --file config/budget-policies.dogfood.example.json
npm run budget-policies -- -- --file <reviewed-budget-policy-file.json> --apply
```

The dogfood example is a starting point, not a live policy. Replace placeholder
requestors and adjust caps in an operator-owned file before applying. Keep the
real operator file outside public commits if it contains private requestor,
repo, or rollout notes. See [budget-policies.md](budget-policies.md).

## 5. Start The App In Noop Mode

Run a no-network preflight first:

```bash
npm run preflight -- -- --strict
```

Start the server in the chosen hosting environment:

```bash
npm start
```

For containerized hosting, build the reviewed image and inject runtime secrets
from the hosting platform instead of the repository:

```bash
docker build -t 6529reviewbot:local .
docker run --rm --env-file .env.production -p 8080:8080 6529reviewbot:local
```

See [container-deployment.md](container-deployment.md) for image contents,
worker-dispatch notes, and production verification.

Verify:

```text
GET /healthz
```

Then confirm GitHub App `ping` deliveries are acknowledged. For local saved
payload debugging, use:

```bash
npm run webhook:replay -- -- --payload payload.json --assume-empty-budget
```

Replay is dry-run unless `--dispatch` is passed.

## 6. Add A Worker Path

Keep `noop` until the central App response shows the expected event,
configuration, admission, budget, runtime-control, and job fanout decisions.

For GitHub Actions workers, install:

```text
templates/review-job-workflow.yml
```

as:

```text
.github/workflows/review-job.yml
```

in this repository. Then set:

```text
REVIEWBOT_WORKER_ADAPTER=github_actions
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
```

The worker mints a short-lived installation token for the target repo. Target
repositories do not receive provider keys, AWS credentials, or long-lived bot
tokens. See [worker-adapters.md](worker-adapters.md).

## 7. Wire 6529.io Surfaces

Copy the public-safe environment-name template into the private `6529.io`
deployment configuration system:

```text
templates/6529-io-reviewbot-env.example
```

Validate that the template's dashboard paths still match the bot API contract:

```bash
npm run check:6529-io-env
```

Replace only the placeholder values in the private deployment configuration.
Live wallet allowlists, auth-check URLs, HMAC secrets, and production origins
must not be committed to this public repository.

Public 6529.io pages should call:

```text
GET /api/public/usage/summary?days=30
```

Private admin pages should call server-side 6529.io infrastructure that signs
admin requests to:

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

The browser must not receive bot admin signing secrets, provider keys, GitHub
App private keys, or AWS credentials. See [usage-api.md](usage-api.md) and
[admin-auth-bridge.md](admin-auth-bridge.md).

## 8. Onboard One Target Repository

Install the GitHub App on one selected repository.

Add a repository config file on the target repository base branch:

```text
.github/6529bot.yml
```

Start with command-only mode:

```bash
cp templates/dogfood-command-only-config.yml <target-repo>/.github/6529bot.yml
```

Validate the config before opening the target repo PR:

```bash
npm run dogfood:target -- -- --repository-config <target-repo>/.github/6529bot.yml --mode auto --require-ready
npm run validate:repo-config -- <target-repo>/.github/6529bot.yml
```

`dogfood:target` renders the public-safe target PR checklist and validates the
dogfood posture. Use `npm --silent run dogfood:target` when the command line
contains a private local path you plan to copy into public notes.

Track the live dogfood run in a private operator status file:

```bash
npm run dogfood:status -- -- --init-status <operator-dogfood-status-file>
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary
```

Validate the full dogfood input set before the first command trigger:

```bash
npm run dogfood:readiness -- -- \
  --repository-config <target-repo>/.github/6529bot.yml \
  --budget-policy-file <reviewed-budget-policy-file.json> \
  --operator-workspace <private-workspace-dir> \
  --strict-preflight \
  --require-ready
npm --silent run dogfood:promotion -- -- \
  --repository-config <target-repo>/.github/6529bot.yml \
  --budget-policy-file <reviewed-budget-policy-file.json> \
  --operator-workspace <private-workspace-dir> \
  --strict-preflight \
  --require-ready
npm --silent run dogfood:go-live -- -- \
  --operator-workspace <private-workspace-dir> \
  --strict-preflight \
  --require-ready
```

After the config merges, trigger a trusted maintainer command:

```text
/6529bot security
```

See [comment-commands.md](comment-commands.md) and [dogfood.md](dogfood.md).

## 9. Move Gradually To Live Coverage

Only after command-only reviews are healthy:

1. Keep one provider/model lane.
2. Enable limited initial reviews with
   `templates/dogfood-repository-config.yml`.
3. Keep strict central DB budgets plus repo, requestor, PR, provider, model,
   and review-kind caps.
4. Enable run-control ledger claims before using `REVIEWBOT_RUN_CONTROL_MODE=enforce`.
5. Watch usage summaries, job events, alerts, and PR comment quality.

## 10. Roll Back

Fast rollback options, from broadest to narrowest:

```text
REVIEWBOT_ENABLED=false
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_PUBLIC_REPO_MODE=off
REVIEWBOT_DISABLED_REPOS=<owner/repo>
```

Target repository rollback:

```yaml
enabled: false
```

Last resort:

- uninstall the GitHub App from the target repository;
- disable provider keys in the bot secret store;
- disable alert or AWS access from the bot runtime.

Use [incident-response.md](incident-response.md) for active incidents.
