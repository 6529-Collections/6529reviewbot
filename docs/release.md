# Release Process

This repository ships the central `6529bot` App/worker implementation and
keeps workflow scaffolds for dogfood and compatibility.

## Versioning

Before `v1`, downstream repositories and dogfood workflows should pin to a
reviewed commit SHA or explicit pre-release tag.

After stabilization:

- `v1` should be a moving major tag for compatible updates;
- minor/patch tags may be added for auditability;
- high-risk adopters may continue pinning exact SHAs.

## Release Checklist

- [Release readiness](release-readiness.md) reviewed
- [v0 release plan](v0-release-plan.md) reviewed before any pre-v1 tag
- [Operator evidence template](operator-evidence-template.md) completed or
  linked from the private operator runbook
- [GitHub App registration packet](github-app-registration.md) completed or
  explicitly deferred in the release notes
- `npm run v0:gates` rendered, or rendered with
  `--status-file <operator-status-file>`, with deferred gates documented
- `npm run v0:gates -- -- --status-file <operator-status-file> --summary`
  reviewed for the final complete/deferred/pending/blocked counts
- `npm run v0:gates -- -- --status-file <operator-status-file> --require-ready`
  passes before tagging; deferred gates remain allowed only when release notes
  name the risk and follow-up owner
- `npm run release:check`
- `npm run check:docs` passes before publishing docs-heavy release notes
- `npm run check:public-artifacts` passes before publishing release notes or
  public operator evidence
- `npm run github-app:manifest -- -- --host <production-bot-origin> --quiet`
- `npm run github-app:convert -- -- --code <manifest-code> --output <private-json-path>`
  when using GitHub's manifest flow for the release App
- `npm run check:workflow-actions`
- GitHub CI runs `npm run release:check` on the release PR
- `npm run validate:api-contract` if public or admin usage API contracts
  changed
- `npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>` when
  central budget rows changed, plus `--apply` from the operator environment
- `npm run preflight -- -- --strict` in the release candidate environment
- [Worker capacity and backpressure](worker-capacity.md) reviewed for live
  worker releases
- docs updated
- pull request template security, cost, and contract questions answered
- workflow pins reviewed
- reusable workflow caller-secret mapping reviewed when compatibility workflow
  changes
- security model reviewed for trust-boundary changes
- AWS/IAM changes documented
- AWS IAM/OIDC templates reviewed when AWS trust or permissions changed
- ledger schema changes captured in `npm run ledger:schema`, including
  additive table migrations, managed constraint refreshes, and managed view
  recreation behavior
- comment contract changes documented
- configuration changes documented
- alerting and admin-auth changes documented
- release-readiness checklist reviewed
- [Security review checklist](security-review-checklist.md) completed
- CodeRabbit or equivalent review feedback resolved
- CI, Dependency Review, and OpenSSF Scorecard reviewed
- OpenSSF Scorecard workflow-level permissions remain read-only; job-level
  writes are limited to SARIF upload and result publishing

## Breaking Changes

Treat these as breaking:

- changing hidden metadata format;
- changing required provider config;
- changing AWS ledger schema without updating the schema CLI and migration docs;
- changing central budget policy file shape or DB admission loading;
- changing workflow permissions;
- changing default review fan-out;
- changing skip behavior;
- changing admin auth canonical signing payloads;
- changing alert payload shape or delivery guarantees.

## Pre-v1 Release Notes

Every pre-v1 release should say:

- whether it is safe only for dogfood or for broader community testing;
- which worker path is supported;
- which providers and model defaults were tested;
- which budget and admission defaults are recommended;
- which known production gaps remain.

Use [Release Notes Template](release-notes-template.md) as the starting point
for GitHub Releases.
