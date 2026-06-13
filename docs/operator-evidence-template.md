# Operator Evidence Template

Use this template for release candidates, dogfood expansion, and production
changes that depend on resources outside the public repository.

Keep live secrets, full account ids, private repository names, webhook payloads,
provider responses, prompt text, and raw AWS ARNs out of public issues and PRs.
Store unredacted evidence in the operator runbook or secret-management system.
The release-gate CLI redacts common secret-shaped values when rendering status
notes/evidence, but this template should still use public-safe summaries when
it is copied outside the private operator workspace.

For repeatable production evidence, prefer a structured JSON file in the
operator workspace. Start from `config/production-evidence.example.json`, keep
the real file private, and validate or render a redacted public summary with:

```bash
npm run operator:evidence -- -- --file <private-evidence-file> --summary
npm run operator:evidence -- -- --file <private-evidence-file> --require-ready
```

The command validates that every required production section is present and
that complete sections include evidence. Deferred or blocked sections must
explain the risk in `notes`. The summary renderer redacts common token shapes,
AWS account ids, and AWS ARNs, but operators should still write public-safe
summaries before copying output into issues, PRs, release notes, or durable
manager memory.

## Header

```text
Date:
Operator:
Commit or tag:
Environment:
Public summary location:
Private evidence location:
Release gate status file:
Release gate summary:
Release gate ready check:
```

## GitHub App

```text
App name:
Manifest rendered with npm run github-app:manifest:
GitHub App registration packet completed:
Permissions match docs/github-app.md:
Webhook URL set:
Webhook secret stored in bot secret store:
Private key stored in bot secret store:
Installed repositories:
```

## AWS Ledger

```text
Region:
Aurora PostgreSQL Serverless v2 cluster created:
Data API enabled:
Storage encrypted:
Deletion protection:
Public accessibility disabled:
Schema applied with npm run ledger:schema -- -- --apply:
Expected base tables present:
Expected daily aggregate views present:
Usage row count:
Job-event row count:
Run-claim row count:
Model-price row count:
Budget-policy row count:
```

## IAM And Secrets

```text
OIDC trust reviewed from infra/aws templates:
Data API identity policy reviewed:
SNS/alert policy reviewed:
Provider keys stored only in bot-owned secret store:
GitHub App credentials stored only in bot-owned secret store:
6529.io admin HMAC secret stored only in server-side 6529 infrastructure:
```

## App Server Runtime

```text
Runtime type: direct Node / container / other
Source commit:
Container image digest, if used:
Container vulnerability scan reviewed:
Runtime secrets injected by hosting platform:
Image contains no committed .env or private evidence files:
Health check /healthz result:
Worker adapter:
GitHub Actions dispatch mode:
Dispatch App installation id configured:
Dispatch App limited to central bot repository:
Target-repository App has no Actions write permission:
Dispatch token stored only in bot secret store:
```

## Budget And Pricing

```text
Central budget policies reviewed:
Central budget policies applied:
Model price sources reviewed:
Model price source-checked timestamps recorded:
Model price source freshness policy:
Model prices applied:
Fail-open/fail-closed behavior accepted:
```

## Worker And Alerts

```text
Worker path:
Worker capacity policy reviewed:
npm run check:workflow-actions passed after installing workflows:
npm run preflight -- -- --strict result:
Run-control mode:
Run-control ledger enabled:
Operator alert destination:
Spend alert dry-run completed:
Job-health alert dry-run completed:
Stale-claim alert threshold reviewed:
```

## 6529.io Surfaces

```text
Public dashboard route:
Public dashboard API target:
Private admin route:
Admin HMAC bridge wired server-side:
Browser has no bot admin secret/provider key/AWS credential access:
Admin snapshot command result:
```

## Dogfood Evidence

```text
Target repository:
Repository config validated:
Command-only review tested:
Initial review tested:
Usage ledger row written:
Job ledger row written:
Run-control claim written:
Bot comment reviewed:
Rollback tested:
```

## Release Decision

```text
Decision: approve / approve with follow-up / block
Accepted deferrals:
Follow-up issues:
```
