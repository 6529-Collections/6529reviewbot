# Usage API

The usage API is the read-side contract for dashboards, warnings, and admin
tools. It is designed so `6529.io` can display bot usage without holding AWS,
GitHub App, or provider secrets.

## Endpoints

```text
GET /api/public/usage/summary?days=30
GET /api/admin/usage/summary?days=30
GET /api/admin/budget/policies
```

The default paths can be changed with:

```text
REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH=/api/public/usage/summary
REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH=/api/admin/usage/summary
REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH=/api/admin/budget/policies
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

## Loader Contract

The HTTP server accepts injectable loaders:

```js
loadUsageEvents({ request, settings, range, visibility })
loadBudgetPolicies({ request, settings })
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
