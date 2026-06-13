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
- [Release operations map](release-operations-map.md) reviewed when deciding
  which public check, private evidence overlay, or release-bundle command is
  next
- [v0 release plan](v0-release-plan.md) reviewed before any pre-v1 tag
- [Operator evidence template](operator-evidence-template.md) completed or
  linked from the private operator runbook
- [Release candidate bundle](release-candidate.md) rendered from the private
  release-gate status and operator evidence files
- [Production cutover checklist](production-cutover.md) reviewed before live
  dogfood or production traffic
- `npm run operator:evidence -- -- --file <private-evidence-file> --summary`
  reviewed before copying deployment evidence into public release notes
- `npm run operator:evidence -- -- --file <private-evidence-file> --require-ready`
  passes before tagging unless release notes intentionally mark the release as
  dogfood-only or local-only
- [GitHub App registration packet](github-app-registration.md) completed or
  explicitly deferred in the release notes
- `npm run v0:gates -- -- --init-status <operator-status-file>` used when
  starting a new release-candidate evidence pass
- `npm run v0:gates` rendered, or rendered with
  `--status-file <operator-status-file>`, with deferred gates documented
- `npm run v0:gates -- -- --status-file <operator-status-file> --summary`
  reviewed for the final complete/deferred/pending/blocked counts
- `npm run v0:gates -- -- --status-file <operator-status-file> --require-ready`
  passes before tagging; every current gate must be present in the status file,
  and deferred gates remain allowed only when release notes name the risk and
  follow-up owner
- release-gate status notes/evidence are public-safe before copying them into
  issues, PRs, release notes, or durable manager memory; the CLI redacts common
  secret-shaped values, but private evidence remains operator-owned
- structured operator evidence summaries are public-safe before copying them
  into issues, PRs, release notes, or durable manager memory
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight`
  reviewed as the public-safe release evidence bundle
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file> --strict-preflight`
  reviewed when the release decision also covers command-only or limited
  initial-review dogfood evidence
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file> --strict-preflight`
  reviewed when the release decision also covers manual security review
  evidence
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file> --strict-preflight`
  reviewed when the release decision also covers live dogfood or production
  traffic
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready`
  passes before tagging unless release notes intentionally mark the release as
  dogfood-only or local-only
- `npm run production:cutover -- -- --init-status <operator-cutover-status-file>`
  used when starting a new production cutover pass
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary`
  reviewed before enabling live dogfood traffic
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready`
  passes before broad community traffic unless release notes intentionally mark
  the release as dogfood-only and name every cutover deferral
- `npm run dogfood:readiness -- -- --strict-preflight --require-ready` passes
  before first live dogfood traffic, using the operator-reviewed target repo
  config and budget policy when they differ from the public examples
- `npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary`
  reviewed after command-only and limited initial-review dogfood runs
- `npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --require-ready`
  passes before expanding dogfood, unless release notes name every deferral
- `npm run admin:snapshot -- -- --base-url <production-bot-origin> --require-ok`
  passes from a private operator environment when validating the 6529.io admin
  surface; keep the detailed snapshot private unless release notes only copy
  public-safe counts
- `npm run release:check`
- `npm run check:6529-io-env` confirms the public-safe 6529.io dashboard env
  template still points only at reviewed usage/admin API contract paths
- `npm run check:env-templates` confirms public env examples have valid syntax,
  blank secret placeholders, and conservative dogfood defaults
- `npm run check:release-gates` confirms the machine-readable v0 gates match
  the numbered required-gates list
- `npm run check:release-operations` confirms the release operations map only
  references existing package scripts and public documentation paths
- `npm run check:docs` passes before publishing docs-heavy release notes
- `npm run check:public-artifacts` passes before publishing release notes or
  public operator evidence, including the tracked root `.env.example`
- `npm run check:preflight` passes against the synthetic central App server
  and worker fixtures
- `npm run github-app:manifest -- -- --host <production-bot-origin> --quiet`
- `npm run github-app:convert -- -- --code <manifest-code> --output <private-json-path>`
  when using GitHub's manifest flow for the release App
- [Container deployment](container-deployment.md) reviewed when shipping the
  App server image; image digest, builder identity, and vulnerability scan are
  captured in private operator evidence
- `npm run check:workflow-actions`
- GitHub CI runs `npm run release:check` on the release PR
- `npm run validate:api-contract` if public or admin usage API contracts
  changed
- `npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>` when
  central budget rows changed, plus `--apply` from the operator environment
- `npm run model-prices -- -- --file <reviewed-model-price-file.json>` when
  provider/model price rows changed, plus `--apply` from the operator
  environment unless the release keeps conservative default estimates
- release notes name any accepted model-price `--allow-stale-source` or
  `--allow-zero-price` override and its operator evidence
- `npm run preflight -- -- --strict` in the release candidate environment
- [Worker capacity and backpressure](worker-capacity.md) reviewed for live
  worker releases
- docs updated
- pull request template security, cost, and contract questions answered
- workflow pins reviewed
- annotated GitHub Action tags pinned to their peeled commit SHA, not the
  tag-object SHA
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
- `npm run security:review -- -- --status-file <operator-security-status-file> --summary`
  reviewed for the candidate
- `npm run security:review -- -- --status-file <operator-security-status-file> --require-ready`
  passes before tagging unless release notes name every security deferral
- CodeRabbit or equivalent review feedback resolved
- CI, Dependency Review, and OpenSSF Scorecard reviewed
- OpenSSF Scorecard workflow-level permissions remain read-only; job-level
  write capability is limited to `id-token: write` for Scorecard result
  publishing

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
