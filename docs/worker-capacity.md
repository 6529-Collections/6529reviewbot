# Worker Capacity And Backpressure

This runbook defines how to operate `6529bot` workers without letting model
traffic outrun trust, budget, provider, or GitHub Actions limits.

The safe default is low throughput, explicit human triggers, and fast rollback.
Scale only after comments, usage rows, run-control claims, and alerts are
healthy at the previous level.

## Capacity Layers

Capacity is controlled at several layers. Treat them as cumulative, not
interchangeable:

- Runtime controls decide whether a scope is allowed to run at all.
- Trusted-actor admission decides who may cause spend.
- Job fanout decides how many jobs one delivery can create.
- Budget admission decides whether a job may spend money.
- Run control decides whether an admitted job may occupy a worker slot.
- Worker timeout decides how long a job may hold a slot.
- Provider account limits decide how much traffic the provider will accept.
- GitHub Actions or external worker limits decide how many jobs can execute.

Do not increase a lower layer just because a higher layer exists. A public repo
should keep trusted-actor admission, budget, and run-control caps even when
GitHub Actions concurrency is low.

## Starting Policy

For the first live dogfood repository:

```text
REVIEWBOT_WORKER_ADAPTER=github_actions
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
REVIEWBOT_WORKER_GITHUB_REF=main
REVIEWBOT_MAX_JOBS_PER_DELIVERY=4
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8
REVIEWBOT_RUN_CONTROL_MODE=enforce
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=2
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=1
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=3
REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=4
REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT=4
REVIEWBOT_WORKER_TIMEOUT_MINUTES=20
```

Target repository config should start command-only. Initial PR automation can
be enabled only after command-triggered reviews prove that comments, ledgers,
and alerts are healthy.

## GitHub Actions Worker Shape

The installed worker workflow uses:

- one workflow-dispatch job per admitted review job;
- a concurrency group keyed by `run_key`;
- a short-lived GitHub App installation token for target checkout and
  comments;
- central provider secrets and AWS access;
- a configurable job timeout.

The workflow-level concurrency group dedupes the exact run key inside GitHub
Actions. It is not a substitute for the durable run-control ledger, because it
does not express org, repo, requestor, provider, model, or review-kind caps.

Keep the central worker workflow in this repository. Target repositories should
not receive provider keys, AWS credentials, or long-lived bot tokens.

## Scale-Up Rules

Change only one capacity dimension at a time.

Accept a scale-up only when the prior level has:

```text
No unresolved bad-comment incident:
No provider 429/rate-limit incident:
No over-budget denial surprise:
No stuck run-control claims:
Usage rows written for completed reviews:
Job ledger rows written for dispatch and completion:
Alerts dry-run or delivery verified:
Median and p95 worker duration recorded:
```

Preferred scale order:

1. Increase trusted repository count.
2. Increase requestor or repo concurrency by one.
3. Add one initial review kind.
4. Add a second provider/model lane.
5. Raise org or provider concurrency.

Do not add multi-model lanes and initial full-review fanout in the same
release. Multi-model review multiplies spend, provider limits, and comment
volume.

## Backpressure

Use the narrowest effective control first:

```text
REVIEWBOT_DISABLED_REPOS=<owner/repo>
REVIEWBOT_DISABLED_PROVIDERS=<provider>
REVIEWBOT_DISABLED_MODELS=<model>
REVIEWBOT_DISABLED_REVIEW_KINDS=<kind>
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_ENABLED=false
```

Then lower capacity:

```text
REVIEWBOT_MAX_JOBS_PER_DELIVERY=1
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=1
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=1
REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=1
```

If provider errors or rate limits are the pressure source, pause that provider
or model rather than pausing the entire App. If GitHub Actions queue time is
the pressure source, keep admission and budgets active but reduce run-control
caps so jobs do not pile up.

## Stuck Jobs

If reviews stop while webhooks are admitted:

1. Check recent job events:

   ```text
   GET /api/admin/jobs/recent?status=dispatch_failed&limit=50
   ```

2. Check stale active run-control claims:

   ```text
   GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50
   ```

3. Confirm the worker workflow is enabled and has available runner capacity.
4. Confirm provider keys and AWS OIDC variables are present in the central
   worker environment.
5. Confirm `REVIEWBOT_WORKER_TIMEOUT_MINUTES` is not too short for the review
   kind and model.
6. If claims are stuck because workers crashed, let TTL expire or update
   terminal status from the private operator runbook after preserving evidence.

Do not delete run-control rows from a public incident thread. Keep exact run
keys and private database evidence in the operator record.

## Provider Limits

Provider-side rate limits are part of capacity planning. Before enabling a
provider/model lane:

- record the account or project limit in the private operator runbook;
- apply central budget rows for the provider and model;
- set run-control provider/model concurrency caps below the provider limit;
- verify provider error handling with a dry run or controlled low-volume job.

If a provider offers project-level spend or rate limits, use them as an
outer guardrail. They complement `6529bot` budgets but do not replace them,
because provider limits usually do not know the GitHub requestor, repo, PR, or
review kind.

## Alerting

Worker capacity is not healthy until alerts are healthy.

Before moving beyond command-only dogfood:

- run `npm run alerts:operator -- -- --dry-run --force`;
- enable `REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=true` once the job ledger and
  run-control ledger are live;
- route scheduled alerts to an operator-owned SNS topic, webhook, or
  equivalent private channel;
- record delivery evidence in the operator runbook;
- set alert thresholds below the hard budget caps so operators have time to
  react.

## Evidence To Capture

Public-safe evidence:

```text
Worker adapter:
Worker timeout:
Run-control mode:
Repo max concurrency:
PR max concurrency:
Requestor max concurrency:
Provider/model concurrency cap class:
Alert delivery configured: yes/no
Last release check: pass/fail
```

Private evidence:

```text
Exact provider limits:
Exact GitHub Actions run URLs for private repos:
Exact run keys:
Private repository names:
Provider error payloads:
Raw worker logs:
AWS account ids, ARNs, and secret ARNs:
```

## Release Decision

Block a scale-up when:

- run control is disabled or unverified;
- budget policies are missing for the target org/repo/provider/model;
- provider keys are present in a target repository;
- alerts are disabled for live provider traffic;
- p95 worker duration is unknown;
- external PRs can trigger automatic spend without a trusted actor.
