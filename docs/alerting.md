# Alerting And Scheduled Spend Checks

`6529bot` alerting is a scheduled read-side check over the usage ledger. It
does not call model providers and does not depend on someone opening a
dashboard.

The first alerting surface focuses on spend:

- budget utilization against enabled budget policies;
- unusual spend spikes by global, repo, requestor, provider, model, and review
  kind dimensions.

## Runner

Run locally or from a central workflow:

```bash
npm run alerts:spend
```

Use `--dry-run` to evaluate alerts without sending notifications:

```bash
npm run alerts:spend -- -- --dry-run --force
```

`--force` runs even when `REVIEWBOT_ALERTS_ENABLED=false`. This is useful for
testing configuration and validating Aurora connectivity.

## Configuration

```text
REVIEWBOT_ALERTS_ENABLED=false
REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns
REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED=false
REVIEWBOT_ALERTS_WEBHOOK_URL=
REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS=10000
REVIEWBOT_ALERTS_SNS_TOPIC_ARN=
REVIEWBOT_ALERTS_SNS_REGION=
REVIEWBOT_ALERTS_SNS_SUBJECT="6529bot spend alert"
REVIEWBOT_ALERTS_SNS_TIMEOUT_MS=10000
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

## Scheduled Workflow

`templates/spend-alert-workflow.yml` is a starter central workflow for this
repository. It runs hourly, assumes the configured AWS role through OIDC, reads
the isolated usage ledger, and sends alerts through SNS or the configured
webhook.

Do not copy this workflow into target repositories unless there is a deliberate
dogfood reason. In production, scheduled checks should run from the central
bot environment so AWS credentials and alert routing stay out of caller repos.

## Alert Payload

Each alert has:

- `kind`: `budget_utilization` or `spend_spike`;
- `severity`: `warning` or `critical`;
- `scopeType` and `scopeValue`;
- current spend and the relevant threshold;
- a human-readable `title` and `message`.

The payload is safe for operators, but it can include private repo names,
requestors, providers, and model names. Route it through private notification
channels unless the configured deployment explicitly treats this data as
public.
