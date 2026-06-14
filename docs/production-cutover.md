# Production Cutover

The production cutover checklist is the operator go/no-go layer between
reviewed source code and live `6529bot` dogfood traffic.

It does not contain live account ids, ARNs, secrets, private repository names,
webhook payloads, prompts, provider responses, or raw ledger rows. The public
repo owns the checklist. Operators own the private status/evidence file.

## Files

- `config/production-cutover-checklist.json` is the canonical public checklist.
- `config/production-cutover-status.example.json` is a public-safe example
  status overlay.
- The real status file should stay in the private operator workspace or
  private runbook.

## Commands

Render the canonical checklist:

```bash
npm run production:cutover
```

Create a private pending status skeleton for the current checklist:

```bash
npm run production:cutover -- -- --init-status <operator-cutover-status-file>
```

Render a public-safe summary from private status:

```bash
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary
```

Before marking 6529.io dashboard items complete, render and review the
dashboard deployment plan with explicit production inputs:

```bash
npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --require-ready
```

Before marking scheduled alert delivery complete, render and review the alert
delivery plan with explicit production inputs:

```bash
npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --require-ready
```

Before marking the container image complete, render and review the dry-run
publish plan with an operator-owned registry. The plan must run before any
live image build or push:

```bash
npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0 --require-ready
```

Before marking worker traffic enabled, record the worker dispatch credential
posture in private evidence. Prefer a dispatch-only GitHub App scoped to the
central bot repository with `Actions: write`; explicitly accept any main-App
credential reuse or `REVIEWBOT_WORKER_GITHUB_TOKEN` fallback before enabling
non-noop worker traffic.

Include the cutover summary in the release-candidate bundle:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file>
```

Fail unless every current checklist item is represented and no item is pending
or blocked:

```bash
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready
```

`--require-ready` permits `deferred` items only when the status includes notes.
Release notes must name every deferral, the accepted risk, and follow-up owner.

Run the production cutover contract check after changing the checklist/status
schema, readiness behavior, deferral handling, Markdown redaction, source
invariants, or this runbook:

```bash
npm run check:production-cutover
```

The production cutover contract check verifies the pending skeleton, complete
and deferred readiness semantics, required evidence rules, public Markdown
redaction, and docs stay synchronized.

## Cutover Phases

The checklist tracks these phases:

- release baseline: reviewed commit, local release check, remote checks, and
  release-candidate bundle;
- GitHub App registration: manifest rendering, production App creation,
  credential custody, and selected-repository install scope;
- AWS ledger and secrets: IAM review, ledger schema, budget policies, model
  prices, and runtime secret presence;
- server and worker: image evidence, noop deployment, strict preflight,
  webhook acceptance, conservative worker enablement, and run-control posture;
- 6529.io and alerts: dashboard deployment plan evidence, public dashboard,
  private admin HMAC bridge, admin snapshot, alert delivery plan evidence, and
  operator alert delivery;
- dogfood: target repo config, promotion packet, command-only review, and
  limited initial review;
- rollback and decision: spend-stop controls, manual security review, and
  explicit release decision.

## Public Safety

The renderer redacts common secret-shaped strings, AWS account ids, and AWS
ARNs, but operators should still write summaries as if they may be copied into
public release notes.

Use public-safe evidence like:

```text
npm run release:check passed on reviewed commit
strict preflight passed in release-candidate environment
selected-repository installation scope reviewed
operator alert delivery verified without publishing destination details
alert delivery plan reviewed before delivery enablement
worker dispatch credential posture reviewed before worker enablement
```

Keep private evidence like the exact App id, installation id, secret names,
database identifiers, provider-console screenshots, raw webhook payloads, and
admin snapshot details outside the public repo.

## Related Runbooks

- [Release Process](release.md)
- [Release Candidate Bundle](release-candidate.md)
- [Operator Evidence Template](operator-evidence-template.md)
- [Dashboard Deployment Plan](dashboard-deployment-plan.md)
- [Alert Delivery Plan](alert-delivery-plan.md)
- [Container Publish Plan](container-publish-plan.md)
- [Production Deployment](deployment.md)
- [GitHub App Registration](github-app-registration.md)
- [Container Deployment](container-deployment.md)
- [Dogfood Runbook](dogfood.md)
