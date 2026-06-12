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

The usage API reader also reads `ai_review_usage_events` and
`ai_review_budget_policies` through the RDS Data API. The reader is read-only
from the application perspective and should use least-privilege SQL access in
production.

The scheduled spend-alert checker reads the same tables. It should run from
the central bot environment with read-only ledger access and notification
permissions for the chosen delivery mode.

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
REVIEW_USAGE_AWS_ROLE_ARN=arn:aws:iam::987989283142:role/seize-6529bot-usage-writer
REVIEW_USAGE_DB_RESOURCE_ARN=arn:aws:rds:us-east-1:987989283142:cluster:seize-6529bot-usage
REVIEW_USAGE_DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:987989283142:secret:...
REVIEW_USAGE_DB_NAME=reviewbot
REVIEW_USAGE_DB_SCHEMA=reviewbot
```

If target repositories call the reusable workflow directly, GitHub evaluates
repository variables and OIDC identity from the caller side. In that model, use
an explicit broker or configure trust and variables for each allowed caller.

The IAM role trust policy must match the workflow identity that actually
assumes the role. For centralized execution, trust
`6529-Collections/6529reviewbot`. For direct caller-repo execution, trust only
the specific caller repositories that should be allowed to write usage events.

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

## Operational Notes

- Token counts are provider-reported.
- Dollar cost is exact only when a provider returns cost directly.
- OpenRouter may return direct usage cost when usage accounting is enabled.
- OpenAI and Anthropic cost estimation requires maintained pricing rows in
  `ai_model_prices`.
- Usage writes can be configured fail-open or fail-closed with
  `REVIEW_USAGE_FAIL_CLOSED`.
