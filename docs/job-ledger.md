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
dispatch_accepted
dispatch_failed
dispatch_error
```

Stages are intentionally coarse:

```text
budget
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

## Privacy

The job ledger can contain private repo names, PR numbers, requestors, provider
and model choices, and failure reasons. Treat it as admin-only data. Public
6529.io pages can summarize counts from it later, but should not disclose raw
rows or private repository identifiers.
