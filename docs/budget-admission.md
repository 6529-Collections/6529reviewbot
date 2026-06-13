# Budget Admission

Budget admission decides whether an admitted review request may be queued for
model work. It runs after trusted-actor admission, after review-job expansion,
and before run-control claims or any provider call.

Budget admission is about spend. Duplicate delivery handling and max-parallel
controls live in [run-control.md](run-control.md).

## Modes

```text
REVIEWBOT_BUDGET_MODE=enforce
```

Supported modes:

```text
enforce   Deny requests that exceed configured budget caps.
warn      Allow requests but return warning status when caps would be exceeded.
off       Skip budget checks.
```

Default mode is `enforce`.

## Cost Estimate

```text
REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD=1
```

The default estimate is used when provider-specific cost estimation is not yet
available. The GitHub App evaluates one review kind and one provider/model lane
at a time, so the default estimate applies to one job.

After a worker completes, actual usage telemetry may be more precise than the
pre-call budget estimate. OpenRouter can return direct dollar cost. Other
providers use the active `ai_model_prices` row to write `estimated_cost_usd`
when complete rates are available. Future admission improvements can reuse the
same pricing table for provider/model-specific pre-call estimates.

## Caps

Budget caps are configured by scope and period:

```text
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

Each scope also supports `_WEEKLY_USD` and `_MONTHLY_USD`.

Supported scopes:

- `global`
- `org`
- `repo`
- `requestor`
- `pr`
- `provider`
- `model`
- `review_kind`

The database-backed `reviewbot.ai_review_budget_policies` table can also hold
enabled scope policies with daily, weekly, and monthly caps. Use
[Budget Policies](budget-policies.md) to dry-run and apply those rows from a
reviewed JSON file.
Run `npm run check:budget-policies-runbook` after changing budget policy
operator guidance so the central cap review path stays aligned with admission
behavior.

When `REVIEW_USAGE_ENABLED=true`, the production server loads enabled DB
policies for each webhook and merges them into the base budget policy before
repository config is applied. If the DB policy read fails, the webhook stops
before queueing work. Repository config can add stricter caps, but it cannot
remove or raise central DB caps.

## Fail-Closed Behavior

If caps are configured and the app cannot read current spend, budget admission
denies the request in `enforce` mode. In `warn` mode, it allows the request but
returns a warning.

If no caps are configured, budget admission allows the request even when no
spend snapshot resolver is available.

## Ledger Snapshot Contract

Budget snapshots are keyed by scope:

```json
{
  "totals": {
    "repo:6529-Collections/6529reviewbot": {
      "dailyUsd": 10.5,
      "weeklyUsd": 20.75,
      "monthlyUsd": 42
    }
  }
}
```

`src/budget-ledger.cjs` reads snapshots from
`reviewbot.ai_review_usage_events`, using:

```sql
coalesce(actual_cost_usd, estimated_cost_usd, 0)
```

Requester scope uses:

```sql
coalesce(metadata->>'requestor', pr_author)
```

That preserves the intended attribution rule: when a maintainer triggers review
for an external contributor PR, the maintainer is the budget requestor.

## Current Implementation

- Pure decision logic: `src/budget-admission.cjs`
- Data API snapshot helper: `src/budget-ledger.cjs`
- Central budget policy tooling: `src/budget-policies.cjs` and
  `bin/apply-budget-policies.cjs`
- App-server enforcement: `src/app-server.cjs`
- Production server wiring: `bin/server.cjs` injects the Data API snapshot
  resolver and central DB policy loader when `REVIEW_USAGE_ENABLED=true`

`AWS_CLI_BIN` can be set when the runtime needs a specific AWS CLI binary path.
On Windows, the ledger helpers invoke the AWS CLI through a shell when no
explicit path is configured.

The GitHub App server passes provider/model context into each budget decision
and passes the merged budget policy to the spend snapshot resolver. That lets
the Data API reader include repository config caps and explicit policies when
choosing which scopes to read. A queue adapter or worker can provide a
provider-specific estimated cost through `estimateBudgetCost(jobEvent,
admission, job)`.
