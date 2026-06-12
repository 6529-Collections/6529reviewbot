# GitHub App

`6529reviewbot` is designed to run as a central GitHub App named `6529bot`.
The current app skeleton provides the webhook verification and event routing
surface that policy, budget, queue, and worker layers build on.

## Runtime Endpoints

```text
GET  /healthz
POST /webhooks/github
GET  /api/public/usage/summary
GET  /api/admin/usage/summary
GET  /api/admin/budget/policies
```

`GET /healthz` returns a basic health response.

`POST /webhooks/github` accepts GitHub webhook deliveries. The path can be
changed with `REVIEWBOT_WEBHOOK_PATH`.

The usage API paths are configurable and are intended for 6529.io dashboards.
Admin usage routes require an injected authorizer before they return data.

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
routing.

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

This keeps target repositories from owning bot GitHub tokens while still
allowing the central App to enforce trusted-actor admission.

Repository collaborator permission is the primary trusted-actor signal. Org
membership is best-effort and depends on the App installation having enough
organization visibility. A failed org-membership lookup does not erase a
successfully resolved collaborator permission.

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

The app normalizes events, evaluates admission policy, expands admitted events
into review jobs, evaluates budget admission per job, and passes admitted jobs
to an injectable queue function. When repository config loading is enabled, it
loads config from the target repository's base ref before admission and job
fanout. Without a real queue, valid admitted review jobs are acknowledged but
reported as not enqueued.

Actor context is resolved from GitHub App installation credentials when the
server is configured with `REVIEWBOT_GITHUB_APP_ID` and a private key. Until a
resolver supplies collaborator or org membership context, public repo events
fail closed as untrusted.

If budget caps are configured and the app cannot resolve current spend, budget
admission fails closed in `enforce` mode. If every job is denied by budget
admission, the queue function is not called.

## Queue Contract

`bin/server.cjs` injects the first two functions automatically when GitHub App
auth is configured. Custom deployments can still inject:

- `loadRepositoryConfig(event)` to read `.github/6529bot.yml` or another
  supported config file with GitHub App installation credentials;
- `resolveActorContext(event)` to resolve GitHub App permissions;
- `resolveBudgetSnapshot(jobEvent, admission, job)` to read current spend;
- `estimateBudgetCost(jobEvent, admission, job)` to provide job-specific cost
  estimates when available;
- `enqueueReviewJobs(jobs, controls)` to dispatch admitted jobs to the worker.

`src/worker-adapter.cjs` provides local and GitHub Actions enqueuer helpers for
this contract. See [worker-adapters.md](worker-adapters.md).

Each queued job has one review kind and one provider/model lane. See
[review-jobs.md](review-jobs.md).

## Local Smoke Test

```bash
GITHUB_WEBHOOK_SECRET=local-secret npm start
```

Then send a signed GitHub-compatible webhook payload to
`http://localhost:8080/webhooks/github`.

Do not use live GitHub App secrets or provider keys in local examples,
screenshots, logs, or PR descriptions.
