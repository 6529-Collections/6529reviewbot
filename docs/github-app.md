# GitHub App

`6529reviewbot` is designed to run as a central GitHub App named `6529bot`.
The current app skeleton provides the webhook verification and event routing
surface that later policy, budget, queue, and worker layers will build on.

## Runtime Endpoints

```text
GET  /healthz
POST /webhooks/github
```

`GET /healthz` returns a basic health response.

`POST /webhooks/github` accepts GitHub webhook deliveries. The path can be
changed with `REVIEWBOT_WEBHOOK_PATH`.

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

The current skeleton only normalizes events and passes accepted review events
to an injectable queue function. Without a real queue, valid review events are
acknowledged but reported as not enqueued. The policy/admission layer must run
before any model call in a later increment.

## Local Smoke Test

```bash
GITHUB_WEBHOOK_SECRET=local-secret npm start
```

Then send a signed GitHub-compatible webhook payload to
`http://localhost:8080/webhooks/github`.

Do not use live GitHub App secrets or provider keys in local examples,
screenshots, logs, or PR descriptions.
