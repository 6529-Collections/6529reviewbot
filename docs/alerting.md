# Alerting And Scheduled Operator Checks

`6529bot` alerting is a scheduled read-side check over the usage and job
ledgers. It does not call model providers and does not depend on someone
opening a dashboard.

The alerting surface covers:

- budget utilization against enabled budget policies;
- unusual spend spikes by global, repo, requestor, provider, model, and review
  kind dimensions;
- failed or errored review jobs from the job ledger;
- stale active run-control claims that can indicate worker crashes, queue
  pressure, or claim-status update failures.

Run `npm run check:alerting-runbook` after edits. The alerting runbook contract
keeps runner behavior, configuration, delivery modes, scheduled workflow
posture, dogfood verification, payload privacy, and public docs synchronized
with release checks.

Before enabling production webhook, SNS, or SES delivery, build the
[alert delivery plan](alert-delivery-plan.md). It is a dry-run operator handoff
that records the reviewed delivery mode, private channel label, dry-run alert
evaluation, admin alert status check, cutover evidence, and release-note
follow-up without sending alerts or reading live ledgers:

```bash
npm run alerts:delivery-plan -- -- --bot-origin https://reviewbot.example.com --operator-workspace <private-workspace-dir> --notify-mode sns --alert-channel <operator-alert-channel> --release v0.1.0 --require-ready
npm run check:alert-delivery-plan
```

## Runner

Run locally or from a central workflow:

```bash
npm run alerts:operator
```

The older `alerts:spend` script name remains as a compatibility alias:

```bash
npm run alerts:spend
```

Use `--dry-run` to evaluate alerts without sending notifications:

```bash
npm run alerts:operator -- -- --dry-run --force
```

`--force` runs even when `REVIEWBOT_ALERTS_ENABLED=false`. This is useful for
testing configuration and validating Aurora connectivity.

## Configuration

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns|ses
REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED=false
REVIEWBOT_ALERTS_WEBHOOK_URL=
REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SNS_TOPIC_ARN=
REVIEWBOT_ALERTS_SNS_REGION=
REVIEWBOT_ALERTS_SNS_SUBJECT="6529bot spend alert"
REVIEWBOT_ALERTS_SNS_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SES_FROM=
REVIEWBOT_ALERTS_SES_TO=
REVIEWBOT_ALERTS_SES_REGION=
REVIEWBOT_ALERTS_SES_SUBJECT="6529bot operator alert"
REVIEWBOT_ALERTS_SES_TIMEOUT_MS=10000
```

Budget utilization thresholds:

```text
REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80
REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT=100
```

Spike detection thresholds:

```text
REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS=24
REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS=7
REVIEWBOT_ALERTS_SPIKE_MULTIPLIER=3
REVIEWBOT_ALERTS_SPIKE_MIN_USD=25
REVIEWBOT_ALERTS_SPIKE_DIMENSIONS=global,repo,requestor,provider,model,review_kind
REVIEWBOT_ALERTS_SPIKE_ALERT_ON_NEW_SPEND=true
```

Spike dimensions intentionally exclude `org` and `pr`: org is already covered
by budget-utilization alerts through central budget policies, and PR-level
spike detection is high-cardinality incident evidence rather than a stable
default alert dimension.

Job-health thresholds:

```text
REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=false
REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS=6
REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD=1
REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2
REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD=1
REVIEWBOT_ALERTS_JOB_MAX_ALERTS=25
```

If `REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED` is unset, job-health alerts default
to the value of `REVIEWBOT_JOB_LEDGER_ENABLED`. In the installed GitHub
Actions workflow the variable is set explicitly so operators opt in before the
scheduled job reads job and claim tables.

Ledger read bounds:

```text
REVIEWBOT_ALERTS_LOOKBACK_DAYS=35
REVIEWBOT_ALERTS_MAX_EVENTS=5000
```

The runner also needs the same read-only Aurora Data API settings used by the
usage API:

```text
REVIEW_USAGE_AWS_REGION=
REVIEW_USAGE_DB_RESOURCE_ARN=
REVIEW_USAGE_DB_SECRET_ARN=
REVIEW_USAGE_DB_NAME=
REVIEW_USAGE_DB_SCHEMA=reviewbot
```

## Delivery Modes

`none` evaluates alerts without delivering them.

`stdout` writes the alert payload as JSON. This is the safest local and CI
debugging mode.

`webhook` posts JSON to `REVIEWBOT_ALERTS_WEBHOOK_URL`. Use this when a 6529
internal gateway or notification service owns routing to email, chat, or admin
tools.

`sns` publishes the same JSON payload to `REVIEWBOT_ALERTS_SNS_TOPIC_ARN` using
the AWS CLI. This is the simplest AWS-native path for email or downstream
Lambda routing.

`ses` sends the same sanitized JSON payload as a plain-text email through
AWS SES v2 using the AWS CLI. `REVIEWBOT_ALERTS_SES_TO` is a comma-separated
recipient list. Keep sender identity verification, sandbox exit status, and
recipient policy in the private operator runbook.

## Scheduled Workflow

This repository includes `.github/workflows/spend-alerts.yml` for central
scheduled alerts. It is scheduled hourly but the job is dormant unless
`REVIEWBOT_ALERTS_ENABLED=true` is set in repository variables. When enabled,
it assumes the configured AWS role through OIDC, reads the isolated usage,
job-event, and run-claim tables as configured, and sends alerts through SNS,
SES, or the configured webhook.

Keep `templates/spend-alert-workflow.yml` aligned with the installed workflow
when changing alert behavior.

Do not copy this workflow into target repositories unless there is a deliberate
dogfood reason. In production, scheduled checks should run from the central
bot environment so AWS credentials and alert routing stay out of caller repos.

## Dogfood Verification

The spend-alert runner has been dry-run against the isolated dogfood usage
ledger with `--force` and notification delivery disabled:

- ledger reads completed for the default 35-day alert window;
- enabled central budget policy rows were evaluated;
- no alerts were generated for the current empty-usage dogfood ledger;
- notification delivery stayed in `dry_run` mode.

This verifies the read/evaluation path. Before broad release, route scheduled
operator alerts to an operator-owned SNS topic, SES sender/recipient list,
webhook, or equivalent private channel, enable job-health alerts after the job
ledger is live, and record that delivery evidence in the private operator
runbook.

## Alert Payload

Each alert has:

- `kind`: `budget_utilization`, `spend_spike`, `job_failure`, or
  `stale_run_claim`;
- `severity`: `warning` or `critical`;
- `scopeType` and `scopeValue`;
- current spend and the relevant threshold;
- job status and sample job ids for job-health alerts;
- a human-readable `title` and `message`.

The payload is safe for operators, but it can include private repo names,
requestors, providers, model names, job ids, and failure reasons. Route it
through private notification channels unless the configured deployment
explicitly treats this data as public. Before dry-run output or notification
delivery, the notifier redacts common bearer, GitHub, provider-key,
alert-webhook, AWS access-key id, and private-key shapes from alert strings,
bounds nested payload size, and omits unsafe or secret-shaped custom keys.
