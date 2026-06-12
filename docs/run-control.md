# Run Control

Run control is the pre-dispatch guardrail for duplicate review work and
parallelism. It runs after trusted-actor admission and budget admission, but
before a worker is queued or a provider can be called.

Budget admission answers whether a job is allowed to spend money. Run control
answers whether this exact job should start now.

## Modes

```text
REVIEWBOT_RUN_CONTROL_MODE=off
```

Supported modes:

```text
off       Skip run-control checks.
warn      Return warnings but still allow dispatch.
enforce   Deny duplicate or over-concurrency jobs.
```

Default mode is `off` so development and early dogfood deployments do not need
a durable claim store on day one. Production should use `enforce` after the
claim table has been applied and the built-in run-control ledger is enabled.

If mode is `enforce` and no claim store is configured, the default claim hook
fails closed before worker dispatch. This prevents operators from believing
dedupe exists when the runtime cannot actually claim jobs.

## Dedupe Key

Every review job has two identifiers:

- `id`: delivery-specific audit id for job events;
- `runKey`: delivery-independent claim key for dedupe.

The run key includes:

- target repository;
- PR number;
- head SHA;
- trigger type;
- comment id and command name, when the trigger is a comment command;
- review kind;
- provider;
- model.

Provider and model are part of the key on purpose. The same review kind may run
through more than one model lane, and those jobs must not dedupe each other.

Duplicate GitHub deliveries for the same PR head and command share a run key.
A new maintainer comment command gets its own comment id and can intentionally
request another run.

## Concurrency Scopes

Run-control caps are configured independently from spend caps:

```text
REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_ORG_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT=
REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT=
```

A blank value means no cap for that scope. A value of `0` pauses that scope.
For example, `REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=0` can stop all
provider jobs when combined with a claim implementation that reports active
provider counts.

Recommended dogfood starting point after the claim table is applied and
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true` is set:

```text
REVIEWBOT_RUN_CONTROL_MODE=enforce
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=2
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=1
REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=3
```

## Claim Store Contract

`src/app-server.cjs` accepts an injectable `claimReviewJob(job, context)` hook.
The hook receives a budget-admitted job and should return the normalized
decision from `src/run-control.cjs`.

`bin/server.cjs` wires the built-in Aurora/RDS Data API implementation when:

```text
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true
```

By default, the run-control ledger reuses the usage-ledger Data API settings.
Override them only if run claims live in a different cluster, database, or
schema:

```text
REVIEWBOT_RUN_CONTROL_LEDGER_AWS_REGION=
REVIEWBOT_RUN_CONTROL_LEDGER_DB_NAME=
REVIEWBOT_RUN_CONTROL_LEDGER_DB_RESOURCE_ARN=
REVIEWBOT_RUN_CONTROL_LEDGER_DB_SCHEMA=
REVIEWBOT_RUN_CONTROL_LEDGER_DB_SECRET_ARN=
REVIEWBOT_RUN_CONTROL_LEDGER_CLAIM_TTL_SECONDS=3600
```

The built-in claimer serializes claim attempts with a PostgreSQL advisory lock
before checking duplicates, active scope counts, and inserting the claim. That
is conservative but appropriate for dogfood volume. `CLAIM_TTL_SECONDS` gates
how long a claim counts as active for concurrency; `DEDUPE_TTL_SECONDS` remains
the duplicate-run window. A future high-throughput worker can replace the
global advisory lock with finer-grained scope locks behind the same hook.

Claim implementations must be atomic:

1. Look up or insert the job's `runKey`.
2. Reject duplicates that are still active or inside the dedupe window.
3. Count active claims for configured scopes.
4. Reject claims that would exceed a max-concurrent cap.
5. Insert or update the claim before dispatching the worker.

The schema CLI includes `reviewbot.ai_review_run_claims` for this purpose.
Implementations should update claim rows when dispatch starts, completes,
fails, or expires. The built-in claimer sets `expires_at` on every claim so
worker crashes do not block a PR forever.

When the built-in ledger is enabled, `bin/server.cjs` also updates claim rows
after dispatch attempts:

```text
dispatching       Queue accepted the job.
running           Worker started executing the job.
completed         Worker finished successfully.
failed            Worker finished unsuccessfully after dispatch.
dispatch_failed   Queue rejected the job.
dispatch_error    Queue threw before returning a result.
```

`completed`, `failed`, `dispatch_failed`, and `dispatch_error` are terminal
for concurrency purposes, so finished or failed jobs do not consume active
slots until the TTL.

The central review-job runner updates `running` before it calls the provider
worker and then writes `completed` or `failed` when the worker returns. The
GitHub Actions worker therefore needs the job `runKey` plus run-control ledger
environment variables when durable claims are enabled.

## Durable Table

Print the canonical schema:

```bash
npm run ledger:schema
```

Apply it from a configured operator environment:

```bash
npm run ledger:schema -- -- --apply
```

The run-claim table stores operational routing data only. It must not store
prompts, diffs, provider responses, raw webhook payloads, worker output, or
credentials.

## Dogfood Verification

The built-in Aurora-backed claimer has been smoke-tested against the isolated
dogfood ledger with a synthetic operator job:

- first claim returned `run_control_claimed`;
- duplicate claim for the same `runKey` returned `duplicate_run`;
- worker-style status update marked the claim `completed`;
- aggregate status verification showed one completed synthetic claim and no
  active stuck claims.

Keep live resource identifiers, exact run keys, and operator environment files
out of public release notes. Store them in the private operator evidence
record.

## Webhook Response

Webhook responses include a `runControl` summary when jobs reach this stage.
Denied jobs appear in `deniedJobs` with their run-control code, while
dispatchable jobs appear in `jobs`.

Common codes:

```text
run_control_off
run_control_claimed
duplicate_run
concurrency_limit_exceeded
run_control_snapshot_unavailable
```

## Preflight

`npm run preflight` validates run-control mode, dedupe TTL, and concurrency
cap values without calling the database. It warns when run control is disabled.
Use `npm run preflight -- -- --strict` before production changes when warnings
should block release.
