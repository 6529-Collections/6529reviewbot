# AWS Usage Ledger

The usage ledger stores review run telemetry in a separate AWS database.

## Current Recommended Database

```text
Engine: Aurora PostgreSQL Serverless v2
Access: RDS Data API
Credentials: RDS-managed Secrets Manager secret
Auth from GitHub Actions: AWS OIDC
```

## Tables

```text
reviewbot.ai_review_usage_events
reviewbot.ai_review_job_events
reviewbot.ai_review_run_claims
reviewbot.ai_model_prices
reviewbot.ai_review_budget_policies
```

`ai_review_budget_policies` stores enabled budget caps by scope:

```text
scope_type, scope_value, daily_budget_usd, weekly_budget_usd,
monthly_budget_usd, enabled
```

The budget admission helper reads current spend from
`ai_review_usage_events` and compares it with these policies before queueing
model work.

`ai_model_prices` stores operator-maintained provider/model price rows. Rows
include the provider source URL and the timestamp when the operator checked
that source, so cost-estimate evidence is auditable without committing current
price rows to the public repo. The model-pricing apply path rejects stale or
future-dated source-check evidence by default, and production preflight can
enforce the same freshness window when `REVIEWBOT_MODEL_PRICE_FILE` points at
the operator price file.

Use [Budget Policies](budget-policies.md) to dry-run and apply reviewed rows.
In production, `bin/server.cjs` loads enabled rows for every webhook when
`REVIEW_USAGE_ENABLED=true`, so DB caps are active admission controls rather
than dashboard-only metadata.

The usage API reader also reads `ai_review_usage_events` and
`ai_review_budget_policies` through the RDS Data API. The reader is read-only
from the application perspective and should use least-privilege SQL access in
production.

The scheduled operator-alert checker reads the same usage tables and, when
job-health alerts are enabled, the job-event and run-claim tables. It should
run from the central bot environment with read-only ledger access and
notification permissions for the chosen delivery mode.

`ai_review_job_events` stores append-only review-job lifecycle events such as
budget admission and worker dispatch results. These rows are operational audit
data, not cost accounting. See [job-ledger.md](job-ledger.md).

`ai_review_run_claims` stores durable run-control claims for dedupe and
concurrency. It represents active or recently completed job ownership, not
prompt or provider data. See [run-control.md](run-control.md).

## Ledger Privacy

Usage, job, and run-control ledgers normalize custom metadata before
persistence. The shared normalizer keeps safe scalar audit fields, bounds and
redacts string values, drops nested values and unsafe keys, and rejects keys
that look like prompts, diffs, provider payloads, webhook payloads, worker
stdout/stderr, credentials, secrets, tokens, or authorization headers.

The usage API and schema boundaries are also checked so public summaries do
not expose private repo/requestor detail and admin event responses do not
return provider request identifiers. Run the no-network contract check after
changing ledger metadata, usage API event normalization, or schema fields:

```bash
npm run check:ledger-privacy
```

## Schema Tooling

Print the full schema SQL without contacting AWS:

```bash
npm run ledger:schema
```

Apply the schema from a configured operator environment:

```bash
npm run ledger:schema -- -- --apply
```

The apply mode uses the RDS Data API settings below. It is intentionally
explicit; the default command is a dry run.

The schema command is safe to re-run. It uses `create table if not exists`,
additive `alter table ... add column if not exists` migrations, managed
constraint refreshes, `create index if not exists`, and recreates only the
bot-managed daily aggregate views so column, constraint, and view changes do
not block deployment.

The budget policy table uses the app's canonical budget scope vocabulary:
`global`, `org`, `repo`, `requestor`, `pr`, `provider`, `model`, and
`review_kind`. Re-applying the schema also normalizes the older `requester`
spelling to `requestor` before refreshing the managed check constraint.

Use a non-default schema name only when the deployment intentionally separates
bot data:

```bash
npm run ledger:schema -- -- --schema reviewbot
npm run ledger:schema -- -- --schema reviewbot --apply
```

## Views

```text
reviewbot.daily_ai_review_spend_by_requester
reviewbot.daily_ai_review_spend_by_model
reviewbot.daily_ai_review_spend_by_pr
```

## Required GitHub Variables

For the intended central app/dispatch model, set these on this bot
repository, not on target application repositories:

```text
REVIEW_USAGE_ENABLED=true
REVIEW_USAGE_AWS_REGION=us-east-1
REVIEW_USAGE_AWS_ROLE_ARN=arn:aws:iam::<account-id>:role/<reviewbot-usage-writer-role>
REVIEW_USAGE_DB_RESOURCE_ARN=arn:aws:rds:<region>:<account-id>:cluster/<reviewbot-usage-cluster>
REVIEW_USAGE_DB_SECRET_ARN=arn:aws:secretsmanager:<region>:<account-id>:secret:<reviewbot-db-secret>
REVIEW_USAGE_DB_NAME=reviewbot
REVIEW_USAGE_DB_SCHEMA=reviewbot
```

If target repositories call the reusable workflow directly, GitHub evaluates
repository variables and OIDC identity from the caller side. In that model, use
an explicit broker or configure trust and variables for each allowed caller.
Do not rely on `secrets: inherit`; see
[reusable-workflow.md](reusable-workflow.md) for the caller-secret boundary.

The IAM role trust policy must match the workflow identity that actually
assumes the role. For centralized execution, trust
`6529-Collections/6529reviewbot`. For direct caller-repo execution, trust only
the specific caller repositories that should be allowed to write usage events.

Start from [AWS IAM Templates](../infra/aws/README.md) when creating OIDC
trust policies and Data API identity policies. The templates are examples, not
live infrastructure, and must be reviewed with the final account, region,
repository, branch, cluster, secret, SNS topic, and SES identity values before
applying.

## Example Queries

Daily spend by requester:

```sql
select *
from reviewbot.daily_ai_review_spend_by_requester
order by day desc, cost_usd desc;
```

Daily spend by model:

```sql
select *
from reviewbot.daily_ai_review_spend_by_model
order by day desc, cost_usd desc;
```

Daily spend by PR:

```sql
select *
from reviewbot.daily_ai_review_spend_by_pr
order by day desc, cost_usd desc;
```

Recent failed job dispatches:

```sql
select created_at, job_id, repo_full_name, pr_number, review_kind, provider,
       model, adapter, reason
from reviewbot.ai_review_job_events
where status in ('dispatch_failed', 'dispatch_error')
order by created_at desc
limit 50;
```

## Operational Notes

- Token counts are provider-reported.
- Dollar cost is exact only when a provider returns cost directly.
- OpenRouter may return direct usage cost when usage accounting is enabled.
- When a provider does not return direct cost, the review runner looks up the
  current provider/model row in `ai_model_prices` and writes
  `estimated_cost_usd` when all applicable token rates are present.
- Missing applicable rates leave `estimated_cost_usd` empty rather than writing
  a partial or misleading cost.
- Use [Model Pricing](model-pricing.md) to dry-run and apply reviewed
  provider/model price rows.
- Use [Budget Policies](budget-policies.md) to dry-run and apply reviewed
  central budget caps.
- Usage writes can be configured fail-open or fail-closed with
  `REVIEW_USAGE_FAIL_CLOSED`.
