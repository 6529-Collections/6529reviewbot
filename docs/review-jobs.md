# Review Jobs

Review jobs are the boundary between GitHub App events and model execution.
They make fanout explicit before any provider call happens.

## Why Jobs Exist

A single GitHub event can request more than one unit of work:

- an opened PR can request general, WCAG, i18n, and security reviews;
- a synchronize event can request a follow-up review;
- a maintainer comment can request one kind, multiple kinds, or all default
  kinds;
- the same review kind can run through more than one provider/model lane.

`src/review-job.cjs` expands that event into concrete jobs. Each job has one
review kind and one provider/model lane.

## Job Shape

Each job contains only routing and audit data:

```json
{
  "id": "rj_...",
  "version": 1,
  "status": "pending",
  "repository": { "fullName": "6529-Collections/example" },
  "deliveryId": "github-delivery-id",
  "trigger": "pull_request",
  "prNumber": 12,
  "headSha": "abc123...",
  "requestor": "maintainer",
  "reviewKind": "security",
  "provider": "anthropic",
  "model": "claude-opus-4-8",
  "lane": "anthropic:claude-opus-4-8"
}
```

The job ID is deterministic for the delivery, PR, head SHA, review kind, and
lane. Replays can therefore detect duplicated work without trusting prompt
text or visible comments.

Jobs also carry a `runKey`. Unlike `id`, the run key intentionally excludes
the GitHub delivery id, so duplicate webhook deliveries for the same PR head,
comment command, review kind, provider, and model can be deduped. Provider and
model are included in the run key so the same review kind can still run through
multiple lanes.

## Lanes

Lanes are configured centrally:

```text
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8,openai:gpt-5.5
```

If `REVIEWBOT_REVIEW_LANES` is empty, the app creates one lane from:

```text
REVIEWBOT_DEFAULT_PROVIDER
REVIEWBOT_DEFAULT_MODEL
REVIEW_PROVIDER
REVIEW_MODEL
REVIEW_DEFAULT_<PROVIDER>_MODEL
```

The built-in Anthropic default is `claude-opus-4-8`, but the default is still
configuration-driven through [Model Catalog](model-catalog.md) so the model can
be updated in one place.

OpenRouter lanes should name an explicit model:

```text
REVIEWBOT_REVIEW_LANES=openrouter:anthropic/claude-sonnet-4
```

Repository config may specify `lanes`, but those lanes are intersected with
central `REVIEWBOT_REVIEW_LANES`. A target repo can opt into fewer allowed
lanes; it cannot introduce a new provider or model by editing repo config.

## Fanout Limit

Use this variable to cap accidental or malicious fanout:

```text
REVIEWBOT_MAX_JOBS_PER_DELIVERY=50
```

The app denies a delivery that would create more jobs than this limit. This is
a pre-provider guardrail.

## Budget Admission

Budget admission runs per job, not once per webhook delivery. This matters
because provider, model, and review-kind budgets can differ.

Flow:

1. Normalize the GitHub webhook.
2. Evaluate trusted-actor admission.
3. Expand the event into review jobs.
4. Evaluate budget admission for each job's provider, model, and review kind.
5. Claim run-control slots for dedupe and concurrency.
6. Queue only budget-admitted and run-control-admitted jobs.

The webhook response includes admitted `jobs` and budget-denied `deniedJobs`
summaries so operators can see exactly what happened.

Run-control-denied jobs also appear in `deniedJobs`, and the response includes
a `runControl` summary once jobs reach the claim stage. See
[run-control.md](run-control.md).

## Worker Contract

The current default queue does not execute jobs. Production workers should
consume admitted jobs and invoke the existing review engine with equivalent
environment:

```text
GH_REPO=<job.repository.fullName>
PR_NUMBER=<job.prNumber>
PR_HEAD_SHA=<job.headSha>
REVIEW_KIND=<job.reviewKind>
REVIEW_PROVIDER=<job.provider>
REVIEW_MODEL=<job.model>
REVIEWBOT_RUN_KEY=<job.runKey>
```

Workers must still enforce engine-level context, token, timeout, and source
path limits. Job admission is not a substitute for provider-call guardrails.
If a live provider call returns no visible review text, the worker fails the
job instead of posting a generic no-finding comment. Empty model output should
be investigated as a provider, prompt, or adapter failure.

Workers can also pass the full job JSON to:

```bash
node bin/run-review-job.cjs --job-file job.json
```

`bin/run-review-job.cjs` is preferred for central workers because it updates
the durable run-control claim from `running` to `completed` or `failed` when
`REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true`.

See [worker-adapters.md](worker-adapters.md).
