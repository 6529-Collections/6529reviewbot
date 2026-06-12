# Usage API

The usage API is the read-side contract for dashboards, warnings, and admin
tools. It is designed so `6529.io` can display bot usage without holding AWS,
GitHub App, or provider secrets.

## Endpoints

```text
GET /api/public/usage/summary?days=30
GET /api/admin/usage/summary?days=30
GET /api/admin/budget/policies
GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
GET /api/admin/status?profile=server&strict=false
```

The default paths can be changed with:

```text
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH=/api/admin/jobs/recent
REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH=/api/admin/status
```

## Public Summary

The public summary is safe for a public 6529.io transparency page. It includes:

- totals for review runs, cost, tokens, and budget-skipped runs;
- daily aggregates;
- repo aggregates, with private repos collapsed into a `private` bucket;
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

## Runtime Status

`GET /api/admin/status` returns the no-network runtime preflight snapshot for
private operator dashboards. It accepts:

- `profile`: `server` or `worker`; defaults to `server`;
- `strict`: when true, warnings make the preflight `ok` field false.

The response deliberately reports configuration posture and secret presence
only. It must never include provider keys, GitHub App private keys, webhook
secrets, AWS credentials, database passwords, or raw webhook payloads.

## Job Events

Review-job lifecycle rows live in `reviewbot.ai_review_job_events` when the job
ledger is enabled. They are intentionally not part of the public usage summary:
raw job events can reveal private repo names, requestors, provider/model
routing, and operational failure details.

`GET /api/admin/jobs/recent` returns recent normalized job events for the
private 6529.io admin surface. It accepts:

- `limit`: positive integer up to `REVIEWBOT_USAGE_API_MAX_ITEMS`;
- `status`: optional exact status filter, for example `dispatch_failed`.

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

## Loader Contract

The HTTP server accepts injectable loaders:

```js
loadUsageEvents({ request, settings, range, visibility })
loadBudgetPolicies({ request, settings })
loadJobEvents({ request, settings, query })
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

`6529.io` should call these HTTP endpoints rather than reading Aurora directly.
