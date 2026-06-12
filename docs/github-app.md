# GitHub App

`6529reviewbot` is designed to run as a central GitHub App named `6529bot`.
The current app skeleton provides the webhook verification and event routing
surface that policy, budget, run-control, queue, and worker layers build on.

## Runtime Endpoints

```text
GET  /healthz
POST /webhooks/github
GET  /api/public/usage/summary
GET  /api/admin/usage/summary
GET  /api/admin/budget/policies
GET  /api/admin/jobs/recent
GET  /api/admin/status
GET  /github-app/manifest-complete
GET  /github-app/setup
GET  /github-app/callback
```

`GET /healthz` returns a basic health response.

`POST /webhooks/github` accepts GitHub webhook deliveries. The path can be
changed with `REVIEWBOT_WEBHOOK_PATH`.

The usage API paths are configurable and are intended for 6529.io dashboards.
Admin usage routes, job diagnostics, and runtime status require an injected
authorizer before they return data.

The GitHub App browser handoff routes return public-safe operator guidance for
manifest conversion, setup, and callback redirects. They do not echo temporary
manifest codes, exchange credentials, or trigger review work.

## Required Environment

```text
GITHUB_WEBHOOK_SECRET
```

Alternative name:

```text
REVIEWBOT_GITHUB_WEBHOOK_SECRET
```

Optional:

```text
PORT=8080
REVIEWBOT_PORT=8080
REVIEWBOT_WEBHOOK_PATH=/webhooks/github
REVIEWBOT_WEBHOOK_MAX_BODY_BYTES=2097152
```

The server refuses to start without a webhook secret. Webhook payloads are
verified with GitHub's `X-Hub-Signature-256` HMAC before JSON parsing or event
routing. Production webhook secrets should be high-entropy and at least 32
characters; `npm run preflight` warns when a shorter placeholder is configured.

## Production Registration

Start from the reviewed manifest template:

```text
templates/github-app-manifest.example.json
```

Replace `<bot-host>` with the production App server hostname before using the
manifest. The committed template uses GitHub's manifest fields for default
permissions, events, webhook URL, setup URL, and callback URLs so the
registration settings are reviewable before any live App credentials exist.

Render the template for a concrete HTTPS host with:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com
```

To generate an operator-owned registration form for an organization install:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com \
  --form \
  --owner 6529-Collections \
  --state <unguessable-state>
```

The helper validates the reviewed template, replaces only the `<bot-host>`
placeholder, and emits either JSON or a local HTML form. It does not exchange
GitHub's temporary manifest code and never receives generated credentials.

After GitHub redirects back with a manifest code, exchange it from a private
operator environment:

```bash
npm run github-app:convert -- -- --code <code> --output C:\private\6529bot-app.json
```

The server exposes safe guidance responses for the manifest redirect, setup,
and callback URLs:

```text
GET /github-app/manifest-complete
GET /github-app/setup
GET /github-app/callback
```

Those routes do not echo the manifest code or any generated credential values.

Do not commit the generated App id, client secret, webhook secret, or private
key returned by GitHub. Store those values only in the bot-owned runtime secret
store. If operators register the App manually through the GitHub UI, match the
manifest's permissions and events exactly.

Use [github-app-registration.md](github-app-registration.md) as the operator
packet for first registration, credential custody, post-registration checks,
permission changes, rotation, and rollback.

GitHub documents the manifest flow in
[Registering a GitHub App from a manifest](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest).
The permission names in the template follow GitHub's documented GitHub App
permission contract.

Recommended repository permissions:

```text
Contents: read
Issues: write
Metadata: read
Pull requests: read
```

Recommended organization permissions:

```text
Members: read
```

Subscribe to:

```text
Issue comment
Pull request
```

See [deployment.md](deployment.md) for the full production deployment runbook.

## Installation Tokens

Production deployments should configure GitHub App credentials:

```text
REVIEWBOT_GITHUB_APP_ID=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_GITHUB_APP_API_URL=https://api.github.com
REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS=10000
```

When configured, the server creates short-lived GitHub App JWTs, exchanges them
for installation tokens, and uses those tokens to:

- read repository config from the target repo base ref;
- resolve the requestor's repository collaborator permission;
- best-effort check organization membership.

The central GitHub Actions worker template also mints a short-lived installation
token for the target repository. It uses the `installation_id` dispatched with
each review job, so target repositories do not need a long-lived bot token.

Workflow dispatch is a separate credential boundary. Production server
deployments should prefer a dispatch-only GitHub App configured with
`REVIEWBOT_WORKER_GITHUB_APP_*`, installed only on the central bot repository
with `Actions: write`. The target-repository App manifest intentionally does
not request `Actions: write`. Reusing the main App for dispatch is supported
only after operators explicitly accept that broader permission on every
repository where the App is installed.

This keeps target repositories from owning bot GitHub tokens while still
allowing the central App to enforce trusted-actor admission.

Repository collaborator permission is the primary trusted-actor signal. Org
membership is best-effort and depends on the App installation having enough
organization visibility. A failed org-membership lookup does not erase a
successfully resolved collaborator permission.

Operators can test either credential profile from a private environment:

```bash
npm run github-app:token -- --profile main --installation-id <target-installation-id>
npm run github-app:token -- --profile worker-dispatch --installation-id <dispatch-installation-id>
```

## Supported Events

The skeleton normalizes these GitHub events:

- `ping`
- `pull_request` with actions:
  - `opened`
  - `synchronize`
  - `reopened`
  - `ready_for_review`
- `issue_comment.created` on pull requests when the comment contains a
  `6529bot` command

Unsupported events are acknowledged without queueing review work.

## Initial Routing

Pull request routing:

```text
opened / reopened / ready_for_review -> general, wcag, i18n, security
synchronize                         -> followup
```

Comment command routing:

```text
/6529bot review
/6529bot review all
/6529bot review security wcag
/6529bot general
/6529bot followup
/6529bot wcag
/6529bot i18n
/6529bot security
@6529bot review all
```

See [comment-commands.md](comment-commands.md) for requestor attribution,
policy gates, dedupe behavior, and examples.

The app normalizes events, evaluates admission policy, expands admitted events
into review jobs, evaluates budget admission per job, claims run-control slots,
and passes admitted jobs to an injectable queue function. When repository
config loading is enabled, it loads config from the target repository's base
ref before admission and job fanout. Without a real queue, valid admitted
review jobs are acknowledged but reported as not enqueued.

When the job ledger is enabled, the App records budget and dispatch lifecycle
events around the queue call. When run control is enabled, it can also record
run-control claim decisions. These rows are for operator diagnostics and do not
include prompt text, diffs, provider output, or worker stdout/stderr.

Actor context is resolved from GitHub App installation credentials when the
server is configured with `REVIEWBOT_GITHUB_APP_ID` and a private key. Until a
resolver supplies collaborator or org membership context, public repo events
fail closed as untrusted.

If budget caps are configured and the app cannot resolve current spend, budget
admission fails closed in `enforce` mode. If every job is denied by budget
admission, the queue function is not called.

If run control is set to `enforce` and no claim store is enabled or injected,
run control fails closed before dispatch. This avoids silently accepting
duplicate or over-parallel work when operators intended claims to be active.
`bin/server.cjs` wires the built-in Aurora-backed claimer when
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true`.

## Queue Contract

`bin/server.cjs` injects the first two functions automatically when GitHub App
auth is configured. Custom deployments can still inject:

- `loadRepositoryConfig(event)` to read `.github/6529bot.yml` or another
  supported config file with GitHub App installation credentials;
- `resolveActorContext(event)` to resolve GitHub App permissions;
- `resolveBudgetSnapshot(jobEvent, admission, job)` to read current spend;
- `estimateBudgetCost(jobEvent, admission, job)` to provide job-specific cost
  estimates when available;
- `claimReviewJob(job, controls)` to atomically claim dedupe/concurrency slots
  before dispatch;
- `recordJobEvent(event)` to persist best-effort job lifecycle audit rows;
- `enqueueReviewJobs(jobs, controls)` to dispatch admitted jobs to the worker.

`src/worker-adapter.cjs` provides local and GitHub Actions enqueuer helpers for
this contract. See [worker-adapters.md](worker-adapters.md).

Each queued job has one review kind and one provider/model lane. See
[review-jobs.md](review-jobs.md) and [run-control.md](run-control.md).

## Local Smoke Test

```bash
GITHUB_WEBHOOK_SECRET=local-secret npm start
```

Then send a signed GitHub-compatible webhook payload to
`http://localhost:8080/webhooks/github`.

For delivery debugging without running the server, replay a saved payload:

```bash
npm run webhook:replay -- -- \
  --payload payload.json \
  --actor-permission write \
  --repository-config templates/dogfood-repository-config.yml \
  --assume-empty-budget
```

Replay is dry-run by default. It reports the normalized event, admission
decision, budget decision, generated jobs, and dry-run queue result without
dispatching workers.

Do not use live GitHub App secrets or provider keys in local examples,
screenshots, logs, or PR descriptions.
