# Operations Runbook

## Routine Checks

Run locally:

```bash
npm run check
npm test
```

Validate the configured runtime without network calls:

```bash
npm run preflight
```

Verify AWS ledger connectivity:

```bash
aws rds-data execute-statement \
  --region "$REVIEW_USAGE_AWS_REGION" \
  --resource-arn "$REVIEW_USAGE_DB_RESOURCE_ARN" \
  --secret-arn "$REVIEW_USAGE_DB_SECRET_ARN" \
  --database "$REVIEW_USAGE_DB_NAME" \
  --sql "select count(*) from reviewbot.ai_review_usage_events"
```

Review AWS IAM/OIDC policy templates:

```bash
ls infra/aws
```

Render final policies with real account, region, repository, branch, cluster,
secret, and SNS values only in the operator workspace.

Preview the expected ledger schema:

```bash
npm run ledger:schema
```

Apply or repair missing tables from a configured operator environment:

```bash
npm run ledger:schema -- -- --apply
```

Review central budget policies without touching AWS:

```bash
npm run budget-policies -- -- --file config/budget-policies.example.json
```

Apply reviewed central budget policies from a configured operator environment:

```bash
npm run budget-policies -- -- --file <reviewed-budget-policy-file.json> --apply
```

Review model price rows without touching AWS:

```bash
npm run model-prices -- -- --file <reviewed-model-price-file.json>
```

Apply reviewed model price rows from a configured operator environment:

```bash
npm run model-prices -- -- --file <reviewed-model-price-file.json> --apply
```

The apply path rejects stale or future-dated source checks and zero-rate rows
by default. Record explicit operator evidence before using
`--allow-stale-source` or `--allow-zero-price`.

Run a dry operator-alert pass:

```bash
npm run alerts:operator -- -- --dry-run --force
```

Validate target repo config before rollout:

```bash
npm run validate:repo-config -- templates/dogfood-repository-config.yml
```

Replay a saved webhook payload without dispatching workers:

```bash
npm run webhook:replay -- -- \
  --payload payload.json \
  --actor-permission write \
  --repository-config templates/dogfood-repository-config.yml \
  --assume-empty-budget
```

Use replay when investigating a GitHub delivery, config change, or admission
decision. The command signs the local payload, runs the App pipeline, and
prints the same public response shape the webhook handler would produce. It is
dry-run unless `--dispatch` is passed.

For active spend, secret, webhook, provider, ledger, or bad-comment incidents,
use [Incident Response](incident-response.md).

For containerized App server deployments, use
[Container Deployment](container-deployment.md) for image contents, runtime
secret boundaries, health checks, and rollback.

For worker queue pressure, provider rate limits, stuck jobs, or scale-up
decisions, use [Worker Capacity And Backpressure](worker-capacity.md).

Private operator dashboards can call:

```text
GET /api/admin/status?profile=server
GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50
```

to show the same no-network preflight checks and stale run-control claims
without exposing runtime secrets or direct database access to the browser.

## If Reviews Stop Posting

Check:

- target repo workflow permissions;
- GitHub App installation;
- replaying the saved GitHub delivery with `npm run webhook:replay`;
- recent `reviewbot.ai_review_job_events` rows for `dispatch_failed` or
  `dispatch_error`;
- recent `reviewbot.ai_review_run_claims` rows for active duplicate or
  over-concurrency claims;
- [Worker Capacity And Backpressure](worker-capacity.md) for current caps and
  scale-up rules;
- `GH_TOKEN` scope;
- provider key availability;
- empty provider output, which fails closed instead of posting a generic
  no-finding comment;
- fork/external PR skip logic;
- PR draft state;
- changed-file and changed-line budgets.
- `GET /api/admin/status?profile=server` warnings and errors.

## If Usage Rows Stop Writing

Check:

- `REVIEW_USAGE_ENABLED`;
- AWS OIDC role trust;
- `id-token: write` workflow permission;
- RDS Data API enabled;
- Secrets Manager secret ARN;
- IAM role policy;
- `REVIEW_USAGE_FAIL_CLOSED`.

## If Job Ledger Rows Stop Writing

Check:

- `REVIEWBOT_JOB_LEDGER_ENABLED`;
- `REVIEWBOT_JOB_LEDGER_FAIL_CLOSED`;
- the shared `REVIEW_USAGE_DB_*` settings, unless job-ledger-specific database
  overrides are configured;
- whether the `reviewbot.ai_review_job_events` table exists;
- Data API and IAM permissions for inserting into that table;
- whether the App is intentionally running with best-effort job telemetry.

## If A GitHub Delivery Needs Replay

1. Save the delivery payload JSON from GitHub's App delivery view.
2. Run replay without dispatch:

   ```bash
   npm run webhook:replay -- -- \
     --payload payload.json \
     --actor-permission write \
     --repository-config templates/dogfood-repository-config.yml \
     --assume-empty-budget
   ```

3. Inspect `body.event`, `body.configuration`, `body.admission`, `body.budget`,
   `body.jobs`, and `body.queue`.
4. Re-run with the real repository config source only after GitHub App
   credentials are available in the operator environment.
5. Use `--dispatch` only when the payload and budget assumptions are understood
   and the worker adapter is intentionally configured.

Do not paste provider keys, GitHub App private keys, webhook secrets, or raw
private repository payloads into public issues, PRs, or release notes.

## If Provider Spend Spikes

Check:

- the latest `npm run alerts:operator -- -- --dry-run --force` output;
- enabled rows in `reviewbot.ai_review_budget_policies`;
- the dry-run SQL from `npm run budget-policies -- -- --file <policy-file>`;
- `REVIEW_BOT_INITIAL_KINDS`;
- provider/model overrides;
- `REVIEW_MAX_OUTPUT_TOKENS`;
- `REVIEW_MAX_DIFF_CHARS`;
- `REVIEW_MAX_CONTEXT_CHARS`;
- `REVIEW_MAX_PRIOR_COMMENTS_CHARS`;
- oversize behavior.

If the spike is caused by repeated webhook deliveries or repeated comment
commands, inspect [Run Control](run-control.md) and move production toward
`REVIEWBOT_RUN_CONTROL_MODE=enforce` with conservative PR and repo caps.

For immediate containment, set `REVIEWBOT_ENABLED=false` or pause the affected
org, repo, provider, model, or review kind with the `REVIEWBOT_DISABLED_*`
runtime-control settings, then restart the central App server.

If alerts did not send, check:

- `REVIEWBOT_ALERTS_ENABLED`;
- `REVIEWBOT_ALERTS_NOTIFY_MODE`;
- `REVIEWBOT_ALERTS_WEBHOOK_URL` or `REVIEWBOT_ALERTS_SNS_TOPIC_ARN`;
- AWS OIDC credentials for SNS mode;
- whether `REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED` should fail the scheduled job.

## If Workers Fail Or Claims Look Stuck

Check:

- `REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED`;
- `REVIEWBOT_JOB_LEDGER_ENABLED`;
- recent `job_failure` and `stale_run_claim` alerts from
  `npm run alerts:operator -- -- --dry-run --force`;
- `GET /api/admin/jobs/recent?status=dispatch_failed&limit=50`;
- `GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50`;
- worker workflow status, runner capacity, and provider keys.

If job-health alerts fire, preserve private run keys and workflow URLs in the
operator evidence record, then apply the backpressure controls in
[Worker Capacity And Backpressure](worker-capacity.md).

## If Usage Dashboards Stop Updating

Check:

- `GET /api/public/usage/summary?days=30`;
- the bot API data loader or Aurora reader;
- `REVIEWBOT_USAGE_API_PUBLIC_ENABLED`;
- `REVIEWBOT_USAGE_API_PUBLIC_REPOS` and
  `REVIEWBOT_USAGE_API_PUBLIC_ORGS`;
- 6529.io auth handoff for admin routes;
- `GET /api/admin/status?profile=server`;
- whether private repo data is intentionally collapsed in public responses.

## If A Bot Comment Looks Wrong

Check:

- whether the finding is grounded in diff/context;
- prior comments included in prompt;
- hidden metadata marker lane;
- provider/model used;
- whether target PR content attempted prompt injection.
