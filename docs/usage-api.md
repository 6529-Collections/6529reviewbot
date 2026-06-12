# Usage API

The usage API is the read-side contract for dashboards, warnings, and admin
tools. It is designed so `6529.io` can display bot usage without holding AWS,
GitHub App, or provider secrets.

The machine-readable OpenAPI contract lives at
[usage-api.openapi.json](usage-api.openapi.json) and is validated by
`npm run release:check`.

## Endpoints

```text
GET /api/public/usage/summary?days=30
GET /api/admin/usage/summary?days=30
GET /api/admin/usage/events/recent?days=7&limit=50
GET /api/admin/budget/policies
GET /api/admin/budget/status
GET /api/admin/alerts/status
GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50
GET /api/admin/status?profile=server&strict=false
```

The default paths can be changed with:

```text
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH=/api/admin/usage/events/recent
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH=/api/admin/budget/status
REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH=/api/admin/alerts/status
REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH=/api/admin/jobs/recent
REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH=/api/admin/run-claims/recent
REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH=/api/admin/status
```

## Public Summary

The public summary is safe for a public 6529.io transparency page. It includes:

- totals for review runs, cost, tokens, and budget-skipped runs;
- daily aggregates;
- repo aggregates, with private and unallowlisted repos collapsed into a
  `private` bucket;
- provider/model aggregates;
- review-kind aggregates.

It does not include requester-level aggregates, raw events, private repo names,
provider request IDs, or hidden metadata.

## Admin Summary

The admin summary is for authenticated 6529 operators. It includes the public
summary fields plus:

- requester aggregates;
- PR-level aggregates;
- private repo names, when the data loader supplies them.

Admin endpoints fail closed unless the server is given an admin authorizer.
Production should use the existing `6529.io` auth system and pass only a
verified admin decision to `6529reviewbot`. This repository should not create a
separate human-login system.

`src/admin-auth.cjs` provides a service-to-service bridge for this contract.
The preferred mode is a short-lived HMAC assertion signed by trusted `6529.io`
server-side infrastructure. See
[admin-auth-bridge.md](admin-auth-bridge.md).

## Usage Events

`GET /api/admin/usage/events/recent` returns recent normalized usage events for
private operator dashboards and incident triage. It accepts:

- `days`: lookback window capped by `REVIEWBOT_USAGE_API_MAX_DAYS`;
- `limit`: positive integer capped by `REVIEWBOT_USAGE_API_MAX_EVENTS`.

When `limit` is omitted, the endpoint defaults to the smaller of
`REVIEWBOT_USAGE_API_MAX_ITEMS` and `REVIEWBOT_USAGE_API_MAX_EVENTS` so the
admin UI starts with a small page while the raw usage-event reader keeps one
hard row cap end-to-end.

This endpoint is admin-only because raw usage rows can include private repo
names, PR numbers, requestors, provider/model routing, token counts, and cost
estimates. It is the private complement to the public aggregate summary and
should be called by server-side 6529.io infrastructure that signs the admin
request. The browser should not read Aurora directly.

The response boundary sanitizes custom loader output: string fields are
bounded, common secret-shaped values are redacted, and `metadata` is reduced
to safe-keyed scalar values. It must never include prompts, diffs, provider
responses, worker output, raw webhook payloads, or credentials.

Example response:

```json
{
  "ok": true,
  "visibility": "admin",
  "kind": "usage_events",
  "range": {
    "days": 7,
    "from": "2026-06-05T12:00:00.000Z",
    "to": "2026-06-12T12:00:00.000Z"
  },
  "limit": 50,
  "events": [
    {
      "createdAt": "2026-06-10T01:00:00.000Z",
      "repoFullName": "6529-Collections/private-repo",
      "prNumber": 12,
      "prAuthor": "author",
      "prHeadSha": "abc123",
      "workflowRunId": "123456",
      "workflowJob": "review-job",
      "requestor": "maintainer",
      "reviewKind": "security",
      "provider": "openai",
      "model": "gpt-5.2",
      "lane": "openai:gpt-5.2",
      "inputTokens": 1000,
      "cachedInputTokens": 0,
      "outputTokens": 250,
      "reasoningTokens": 0,
      "totalTokens": 1250,
      "estimatedCostUsd": 0.75,
      "actualCostUsd": null,
      "costUsd": 0.75,
      "currency": "USD",
      "budgetSkipped": false,
      "metadata": {
        "requestor": "maintainer"
      }
    }
  ]
}
```

## Budget Policies

`GET /api/admin/budget/policies` returns normalized budget policy rows:

```json
{
  "scopeType": "repo",
  "scopeValue": "6529-Collections/6529reviewbot",
  "dailyBudgetUsd": 25,
  "weeklyBudgetUsd": null,
  "monthlyBudgetUsd": 500,
  "enabled": true
}
```

The endpoint is admin-only because it may reveal private repo names, requester
scopes, or operational budget controls.

`GET /api/admin/budget/status` returns those same enabled budget policy rows
with current daily, weekly, and monthly spend/utilization:

```json
{
  "ok": true,
  "visibility": "admin",
  "kind": "budget_status",
  "generatedAt": "2026-06-12T12:00:00.000Z",
  "policies": [
    {
      "scopeType": "repo",
      "scopeValue": "6529-Collections/6529reviewbot",
      "dailyBudgetUsd": 25,
      "weeklyBudgetUsd": null,
      "monthlyBudgetUsd": 500,
      "enabled": true,
      "utilization": {
        "daily": {
          "budgetUsd": 25,
          "usedUsd": 18,
          "remainingUsd": 7,
          "percentUsed": 72,
          "overBudget": false
        },
        "weekly": {
          "budgetUsd": null,
          "usedUsd": 42,
          "remainingUsd": null,
          "percentUsed": null,
          "overBudget": false
        },
        "monthly": {
          "budgetUsd": 500,
          "usedUsd": 140,
          "remainingUsd": 360,
          "percentUsed": 28,
          "overBudget": false
        }
      }
    }
  ]
}
```

Use budget status for private admin dashboards and warning banners. It keeps
the utilization calculation bot-side, where the same ledger scope rules used by
budget admission are available. The browser should still receive this through
server-side 6529.io admin auth, not by reading Aurora directly.

## Alert Status

`GET /api/admin/alerts/status` returns alerting posture for private operator
dashboards:

```json
{
  "ok": true,
  "visibility": "admin",
  "kind": "alert_status",
  "generatedAt": "2026-06-12T12:00:00.000Z",
  "status": {
    "enabled": true,
    "spend": {
      "enabled": true,
      "budgetWarningPercent": 80,
      "budgetCriticalPercent": 100,
      "spikeWindowHours": 24,
      "spikeBaselineDays": 7,
      "spikeMultiplier": 3,
      "spikeMinUsd": 25,
      "spikeDimensions": ["global", "repo", "requestor", "provider", "model", "review_kind"],
      "alertOnNewSpend": true,
      "maxAlerts": 50
    },
    "jobHealth": {
      "enabled": true,
      "failureLookbackHours": 6,
      "failureThreshold": 1,
      "staleClaimHours": 2,
      "staleClaimThreshold": 1,
      "maxAlerts": 25
    },
    "schedule": {
      "lookbackDays": 35,
      "maxEvents": 5000
    },
    "notifier": {
      "mode": "sns",
      "failClosed": false,
      "webhookConfigured": false,
      "webhookTimeoutMs": 10000,
      "snsTopicConfigured": true,
      "snsRegion": "us-east-1",
      "snsSubjectConfigured": true,
      "snsTimeoutMs": 10000
    }
  }
}
```

The response reports delivery posture and secret presence only. It does not
return webhook URLs, SNS topic ARNs, AWS account ids, provider keys, or alert
payloads. Use it for private warning banners and setup diagnostics; use the
scheduled alert workflow for actual delivery.

## Runtime Status

`GET /api/admin/status` returns the no-network runtime preflight snapshot for
private operator dashboards. It accepts:

- `profile`: `server` or `worker`; defaults to `server`;
- `strict`: when true, warnings make the preflight `ok` field false.

The response deliberately reports configuration posture and secret presence
only. It must never include provider keys, GitHub App private keys, webhook
secrets, AWS credentials, database passwords, or raw webhook payloads. The API
response boundary redacts common secret-shaped diagnostic strings and omits
unsafe-keyed or deeply nested custom diagnostic values before returning the
payload.

## Job Events

Review-job lifecycle rows live in `reviewbot.ai_review_job_events` when the job
ledger is enabled. They are intentionally not part of the public usage summary:
raw job events can reveal private repo names, requestors, provider/model
routing, and operational failure details.

`GET /api/admin/jobs/recent` returns recent normalized job events for the
private 6529.io admin surface. It accepts:

- `limit`: positive integer up to `REVIEWBOT_USAGE_API_MAX_ITEMS`;
- `status`: optional exact status filter, for example `dispatch_failed`.

The endpoint is admin-only because it can include private repository names,
requestors, provider/model routing, and operational failure details. It still
sanitizes loader output before responding: string fields are bounded, common
secret-shaped values are redacted, and `metadata` is reduced to safe-keyed
scalar values. Loader `503` reasons are redacted through the same diagnostic
path before they become JSON errors.

Example response:

```json
{
  "ok": true,
  "visibility": "admin",
  "kind": "job_events",
  "limit": 50,
  "status": "dispatch_failed",
  "events": [
    {
      "eventId": 99,
      "createdAt": "2026-06-10 02:00:00+00",
      "jobId": "job-1",
      "status": "dispatch_failed",
      "stage": "dispatch",
      "repoFullName": "6529-Collections/private-repo",
      "prNumber": 12,
      "requestor": "maintainer",
      "reviewKind": "security",
      "provider": "openai",
      "model": "gpt-5.2",
      "lane": "openai:gpt-5.2",
      "adapter": "github_actions",
      "accepted": false,
      "reason": "queue disabled",
      "exitCode": 1,
      "metadata": {
        "workflow": "review-job"
      }
    }
  ]
}
```

## Run Claims

Run-control claim rows live in `reviewbot.ai_review_run_claims` when durable
run control is enabled. They show current or recently completed work ownership
for duplicate-run and concurrency protection. They are operational data, not
public transparency data.

`GET /api/admin/run-claims/recent` returns recent normalized run-control
claims for the private 6529.io admin surface. It accepts:

- `limit`: positive integer up to `REVIEWBOT_USAGE_API_MAX_ITEMS`;
- `status`: optional exact status filter, for example `running`;
- `active`: when true, returns `claimed`, `dispatching`, and `running` claims;
- `staleMinutes`: optional updated-before threshold. Without a `status`
  filter, setting `staleMinutes` also selects active claims.

When `active=true` and `status` are both supplied, `status` must be one of the
active claim statuses. This keeps active/stale triage from silently returning
terminal rows such as `completed` or `failed`.

The endpoint is admin-only because it can include private repository names,
run keys, requestors, PR numbers, provider/model routing, and queue state. It
still sanitizes loader output before responding: string fields are bounded,
common secret-shaped values are redacted, and `metadata` is reduced to
safe-keyed scalar values. Loader `503` reasons are redacted through the same
diagnostic path before they become JSON errors.

Example stale-active query:

```text
GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50
```

Example response:

```json
{
  "ok": true,
  "visibility": "admin",
  "kind": "run_claims",
  "limit": 50,
  "status": null,
  "active": true,
  "staleMinutes": 120,
  "updatedBefore": "2026-06-12T10:00:00.000Z",
  "claims": [
    {
      "claimId": 101,
      "createdAt": "2026-06-12 08:00:00+00",
      "updatedAt": "2026-06-12 08:30:00+00",
      "completedAt": "",
      "expiresAt": "2026-06-12 13:00:00+00",
      "runKey": "6529-Collections/private-repo#12:security:openai:gpt-5.2",
      "jobId": "job-claim",
      "status": "running",
      "repoFullName": "6529-Collections/private-repo",
      "org": "6529-Collections",
      "prNumber": 12,
      "requestor": "maintainer",
      "reviewKind": "security",
      "provider": "openai",
      "model": "gpt-5.2",
      "lane": "openai:gpt-5.2",
      "deliveryId": "delivery-1",
      "commandName": "review",
      "metadata": {
        "worker": "review-job"
      }
    }
  ]
}
```

## Loader Contract

The HTTP server accepts injectable loaders:

```js
loadUsageEvents({ request, settings, range, visibility, query })
loadBudgetPolicies({ request, settings })
loadJobEvents({ request, settings, query })
loadRunClaims({ request, settings, query })
loadAdminStatus({ request, settings, query })
authorizeUsageApiAdmin(request)
```

Default loaders return `503` because no database reader is configured. The
default admin authorizer returns `403`.

## Aurora Reader

When `REVIEW_USAGE_ENABLED=true`, `bin/server.cjs` installs the read-only
Aurora Data API loaders from `src/usage-api-ledger.cjs`.

Required ledger settings are the same settings used for usage writes:

```text
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

Public repo-name disclosure is allowlist based:

```text
REVIEWBOT_USAGE_API_PUBLIC_REPOS=6529-Collections/6529reviewbot
REVIEWBOT_USAGE_API_PUBLIC_ORGS=6529-Collections
```

If a repo does not match either allowlist, public summaries still include its
cost and review counts but collapse the repo name to `private`.
Repository names must have exact `owner/repo` shape before org allowlists can
match; malformed names collapse instead of being partially matched.
The HTTP summarizer enforces this disclosure rule even when a custom loader
supplies `repoPrivate: false`; loaders should still mark unallowlisted repos as
private early, but the API boundary is the final guard before public output.

`6529.io` should call these HTTP endpoints rather than reading Aurora directly.
