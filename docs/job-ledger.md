# Job Ledger

The job ledger records review-job lifecycle events separately from token and
cost usage. It gives operators a durable audit trail for admission, budget, and
dispatch behavior even when no provider call happens.

The ledger must not store prompts, diffs, provider responses, worker stdout,
worker stderr, credentials, or raw webhook payloads.

## Event Model

Each row is an append-only event for one review job.

Common statuses:

```text
budget_admitted
budget_warning
budget_denied
runtime_disabled
run_control_admitted
run_control_warning
run_control_denied
run_control_duplicate
dispatch_accepted
dispatch_failed
dispatch_error
```

Stages are intentionally coarse:

```text
budget
runtime_control
run_control
dispatch
```

Use the latest event for a `job_id` to understand the current known state. Use
the full event history when diagnosing retries, queue failures, or policy
changes.

## Configuration

Job ledger writes are disabled by default:

```text
REVIEWBOT_JOB_LEDGER_ENABLED=false
REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=false
```

By default, job ledger writes use the same Aurora Data API settings as the
usage ledger:

```text
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

Use these overrides only if job events live in a different database or schema:

```text
REVIEWBOT_JOB_LEDGER_AWS_REGION
REVIEWBOT_JOB_LEDGER_DB_NAME
REVIEWBOT_JOB_LEDGER_DB_RESOURCE_ARN
REVIEWBOT_JOB_LEDGER_DB_SCHEMA
REVIEWBOT_JOB_LEDGER_DB_SECRET_ARN
```

Keep `REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=false` during dogfood. Set it to `true`
only if losing job audit rows is worse than rejecting webhook work.

## Table

`npm run ledger:schema` prints the canonical schema for the job ledger and the
related usage/budget tables. The table below is included here for quick review.

Recommended table:

```sql
create table reviewbot.ai_review_job_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  job_id text not null,
  status text not null,
  stage text not null,
  repo_full_name text not null,
  pr_number bigint,
  pr_author text,
  pr_head_sha text,
  delivery_id text,
  requestor text,
  review_kind text not null,
  provider text not null,
  model text not null,
  lane text,
  adapter text,
  accepted boolean,
  reason text,
  exit_code integer,
  metadata jsonb not null default '{}'::jsonb
);

create index ai_review_job_events_job_created_idx
  on reviewbot.ai_review_job_events (job_id, created_at desc);

create index ai_review_job_events_repo_pr_created_idx
  on reviewbot.ai_review_job_events (repo_full_name, pr_number, created_at desc);

create index ai_review_job_events_status_created_idx
  on reviewbot.ai_review_job_events (status, created_at desc);

create index ai_review_job_events_requestor_created_idx
  on reviewbot.ai_review_job_events (requestor, created_at desc);
```

The canonical schema also includes `reviewbot.ai_review_run_claims`, which is
the durable table intended for run-control dedupe and concurrency claims. Keep
claims separate from append-only lifecycle events: claims represent current
work ownership, while job events preserve audit history.

Minimal claim table shape:

```sql
create table reviewbot.ai_review_run_claims (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  run_key text not null unique,
  job_id text not null,
  status text not null,
  repo_full_name text not null,
  org text,
  pr_number bigint,
  requestor text,
  pr_head_sha text,
  review_kind text not null,
  provider text not null,
  model text not null,
  lane text,
  delivery_id text,
  comment_id text,
  command_name text,
  metadata jsonb not null default '{}'::jsonb
);
```

## Operational Queries

Recent failed dispatches:

```sql
select created_at, job_id, repo_full_name, pr_number, review_kind, provider,
       model, adapter, reason
from reviewbot.ai_review_job_events
where status in ('dispatch_failed', 'dispatch_error')
order by created_at desc
limit 50;
```

Latest known job state:

```sql
select distinct on (job_id)
       job_id, created_at, status, repo_full_name, pr_number, review_kind,
       provider, model, adapter, reason
from reviewbot.ai_review_job_events
order by job_id, created_at desc;
```

Budget-denied jobs by requester:

```sql
select requestor, count(*) as denied_jobs
from reviewbot.ai_review_job_events
where status = 'budget_denied'
  and created_at >= now() - interval '7 days'
group by requestor
order by denied_jobs desc;
```

Active run claims by repo:

```sql
select repo_full_name, count(*) as active_claims
from reviewbot.ai_review_run_claims
where status in ('claimed', 'dispatching', 'running')
  and (expires_at is null or expires_at > now())
group by repo_full_name
order by active_claims desc;
```

Completed and failed worker claims are terminal and should disappear from this
active query without waiting for claim TTL expiry.

## Admin API

The private 6529.io admin surface can read recent lifecycle rows through:

```text
GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
```

The endpoint is backed by `reviewbot.ai_review_job_events`, uses the same
admin-auth bridge as the usage API, and caps `limit` with
`REVIEWBOT_USAGE_API_MAX_ITEMS`. Keep raw rows private; public pages should use
aggregates instead of exposing repository names, requestors, or failure text.

## Job-Health Alerts

Scheduled operator alerts can read bounded recent job events and active
run-control claims when `REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=true`.

The alert runner emits:

- `job_failure` when `dispatch_failed`, `dispatch_error`, or `failed` job
  events cross the configured threshold within the lookback window;
- `stale_run_claim` when active `claimed`, `dispatching`, or `running` claims
  have not been updated for the configured stale-claim window.

Configure the thresholds with:

```text
REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS=6
REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD=1
REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2
REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD=1
```

Alerts include repo names, job ids, statuses, and timing summaries, so route
them to private operator channels.

## Privacy

The job ledger can contain private repo names, PR numbers, requestors, provider
and model choices, and failure reasons. App server dispatch exception reasons
are redacted before ledger writes, but this is only a backstop. Treat job
events as admin-only data. Public 6529.io pages can summarize counts from them
later, but should not disclose raw rows or private repository identifiers.
