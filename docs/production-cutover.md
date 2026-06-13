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

Fail unless every current checklist item is represented and no item is pending
or blocked:

```bash
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready
```

`--require-ready` permits `deferred` items only when the status includes notes.
Release notes must name every deferral, the accepted risk, and follow-up owner.

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
- 6529.io and alerts: public dashboard, private admin HMAC bridge, admin
  snapshot, and operator alert delivery;
- dogfood: target repo config, command-only review, and limited initial review;
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
```

Keep private evidence like the exact App id, installation id, secret names,
database identifiers, provider-console screenshots, raw webhook payloads, and
admin snapshot details outside the public repo.

## Related Runbooks

- [Release Process](release.md)
- [Release Candidate Bundle](release-candidate.md)
- [Operator Evidence Template](operator-evidence-template.md)
- [Production Deployment](deployment.md)
- [GitHub App Registration](github-app-registration.md)
- [Container Deployment](container-deployment.md)
- [Dogfood Runbook](dogfood.md)
