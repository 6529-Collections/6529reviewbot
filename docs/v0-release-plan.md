# v0 Release Plan

This plan defines what the first public `v0` release should mean. It is a
pre-v1 dogfood and community-review release, not a broad production guarantee.

## Release Intent

The `v0` release should make it easy for 6529 maintainers and interested
community contributors to inspect, install, dogfood, and audit `6529bot`
without confusing that milestone with a finished hosted service.

The release should communicate three things clearly:

- `6529reviewbot` is a central GitHub App and worker framework;
- target repositories do not own provider keys, AWS credentials, or bot code;
- public repositories require trusted-actor admission, budget gates, and
  run-control claims before model calls.

## Included In v0

The first `v0` tag can include:

- review prompts and comment format for general, follow-up, WCAG 2.2 AA, i18n,
  and crypto/security reviews;
- maintainer comment-command contract for manual review triggers;
- Anthropic, OpenAI, and OpenRouter provider adapters behind explicit
  configuration;
- provider setup guide for Anthropic, OpenAI, and OpenRouter;
- Anthropic Opus defaulting through environment/configuration rather than
  scattered code constants;
- GitHub App webhook verification, installation-token handling, and
  collaborator permission lookup;
- trusted-actor admission for public repositories;
- central runtime pause controls before budget or worker dispatch;
- budget admission against the isolated AWS usage ledger;
- dry-run/apply tooling for central DB budget policies loaded during
  production admission;
- conservative dogfood budget policy example validated by release checks;
- review job fanout by review kind and provider/model lane;
- run-control contract and Aurora-backed claimer for duplicate delivery claims
  and concurrency caps;
- run-control worker completion updates for durable claims;
- local and central GitHub Actions worker adapters;
- native GitHub Actions workflow-dispatch API support with short-lived App
  installation tokens and `gh` fallback for compatibility environments;
- worker capacity and backpressure runbook for conservative live scaling;
- central App server container packaging with non-root runtime, health check,
  and runtime-only secret injection guidance;
- base-ref repository configuration with restrictive central-policy merge;
- public and admin usage API contracts with read-only Aurora loaders;
- validated OpenAPI contract for usage/admin API integration;
- admin runtime status API for no-network preflight warnings;
- repeatable Aurora ledger schema tooling;
- dry-run/apply tooling for operator-maintained model price rows;
- zero-rate model price apply guard with explicit override for documented free
  rates;
- stale or future-dated model price source-check guard with explicit
  release-evidence override;
- usage-write cost estimation from active provider/model price rows;
- 6529.io admin auth bridge contract;
- scheduled operator alert checks for spend and job health with stdout,
  webhook, SNS, and SES email delivery modes;
- reviewed GitHub App manifest template for repeatable App registration;
- GitHub App manifest renderer for production-host validation before App
  creation;
- GitHub App manifest conversion CLI for the one-hour manifest code exchange;
- GitHub App registration packet for operator roles, credential custody,
  post-registration checks, rotation, and rollback;
- installed central worker and dormant-by-default alert workflows plus a local
  action-ref pinning guard;
- example AWS IAM/OIDC templates for central Data API, SNS, and SES access;
- no-network production preflight command;
- incident response runbook;
- sanitized support bundle and support playbook;
- install and onboarding guide;
- operator evidence template for redacted deployment proof;
- operator workspace bootstrap for private status/evidence skeletons and final
  promotion/go-live command guidance;
- dashboard deployment plan handoff for reviewed 6529.io public/private
  route exposure evidence;
- dogfood go-live packet for cross-checking release, promotion, cutover, and
  operator-workspace evidence before command-only live traffic;
- dogfood templates, deployment docs, release checks, and security-review
  checklists;
- release operations map for deciding which public check, private evidence
  overlay, or release-candidate command applies at each stage.

## Not Included In v0

The first `v0` tag should not promise:

- a production-hosted 6529bot service for arbitrary repositories;
- compatibility guarantees for hidden metadata, config fields, API response
  shapes, or worker payloads;
- unmanaged automatic model calls on public repositories;
- direct 6529.io private admin UI completion;
- provider pricing freshness without an explicit price-file update;
- support for repositories that cannot satisfy the trusted-actor, budget, and
  secret-boundary requirements.

## Required Gates Before Tagging

Do not create the `v0` tag until all of these are true:

1. The production GitHub App named `6529bot` exists from the reviewed manifest
   template or equivalent manual settings, with documented permissions, events,
   webhook secret handling, private-key rotation, and completed registration
   packet evidence.
2. The central App server and at least one worker path are deployed with a
   reviewed worker capacity policy and dispatch credential evidence, preferring
   a dispatch-only GitHub App with any fallback explicitly accepted, or the
   release notes explicitly mark the release as local/dogfood-only.
3. If the App server is containerized, reviewed container publish plan evidence
   exists for an operator-owned registry, `npm run check:container-image`
   passes, and the image was built from a reviewed commit, scanned, and
   recorded by digest in private operator evidence.
4. Provider keys, GitHub App secrets, AWS Data API access, and alert secrets
   are configured only in bot-owned infrastructure.
5. AWS IAM/OIDC trust and identity policies are reviewed from the templates in
   `infra/aws` or equivalent least-privilege documents.
6. The 6529.io public usage dashboard is merged, deployed, wired to the
   public usage API, covered by reviewed dashboard deployment plan evidence,
   and limited to reviewed public repo/org disclosure allowlists, or explicitly
   deferred in the release notes.
7. The 6529.io private admin surface is wired to the HMAC auth bridge and
   protected by reviewed 6529.io auth-check URL and wallet allowlist evidence,
   covered by reviewed dashboard deployment plan evidence, or explicitly
   deferred behind operator-only APIs.
8. Dogfood repository configuration has been merged into at least one trusted
   6529 repository and tested in command-only mode. Use
   `npm run dogfood:target` before opening the target repository config PR.
9. The dogfood promotion packet and dogfood go-live packet have passed from
   the private operator environment before first live dogfood traffic,
   including target repository config, central dogfood inputs, self-dogfood
   replay, production cutover status, private workspace, and strict preflight
   gates.
10. `npm run ledger:schema -- -- --apply` has been run in the target Aurora
   database, or release notes explicitly mark ledger setup as manual.
11. Central budget policy rows have been reviewed and applied with
   `npm run budget-policies -- -- --file <file> --apply`, or release notes
   explicitly keep budget control to environment/repository caps.
12. Model pricing rows have source URLs, fresh source-checked timestamps, have
   been reviewed against current provider docs, and have been applied with
   `npm run model-prices -- -- --file <file> --apply`, or release notes
   explicitly keep conservative default cost estimates. Any stale,
   future-dated, or zero-rate rows must be documented before using
   `--allow-stale-source` or `--allow-zero-price`.
13. Run-control claims are either enforced with conservative caps using the
   built-in ledger-backed claimer or explicitly deferred in release notes with
   the worker adapter kept conservative.
14. A limited initial-review dogfood run has completed with conservative budget
   caps, visible comments, and ledgered usage, tracked with
   `npm run dogfood:status -- -- --status-file <operator-dogfood-status-file>`.
15. Scheduled operator alerts have reviewed alert delivery plan evidence and
    route to an operator-owned channel.
16. `npm run release:check` passes from a clean `main`.
    The release check includes `npm run check:release-operations` so the
    operations map cannot reference stale scripts or missing docs.
17. `npm run preflight -- -- --strict` passes in the release candidate
    environment, or every warning is accepted in release notes.
18. GitHub CI, Dependency Review, and OpenSSF Scorecard have been reviewed.
19. `docs/security-review-checklist.md` has been completed for the release
    candidate and tracked with
    `npm run security:review -- -- --status-file <operator-security-status-file>`.
20. `CHANGELOG.md`, `README.md`, release notes, templates, and deployment docs
    match the tagged behavior.

Render the same gates as an operator checklist:

```bash
npm run v0:gates
```

Use a separate operator-owned status file to mark gates complete, deferred, or
blocked without editing the canonical gate list:

```bash
npm run v0:gates -- -- --init-status <operator-status-file>
npm run v0:gates -- -- --status-file config/v0-release-status.example.json
```

`--init-status` writes every current gate as `pending` with the evidence target
in notes. It refuses to overwrite an existing file unless `--force` is passed,
so operators can safely keep the real status file in a private runbook.

Print the concise tag/no-tag summary from an operator-owned status file:

```bash
npm run v0:gates -- -- --status-file <operator-status-file> --summary
```

Before tagging, require that the status file has no pending or blocked gates:

```bash
npm run v0:gates -- -- --status-file <operator-status-file> --require-ready
npm run check:v0-gates
```

`--require-ready` also verifies that the status file lists every gate in the
current canonical gate list. If a new public gate is added, regenerate the
private status file with `--init-status` or add the new gate before tagging.

Gate status notes and evidence rendered by the CLI redact common secret-shaped
values, AWS account ids, and AWS ARNs, including JSON output. That is a
guardrail for accidental copy/paste, not permission to store live secrets,
full account ids, private repository names, raw payloads, or unredacted
deployment evidence in public status files.

The v0 release gate contract check verifies status readiness semantics,
missing-gate handling, complete-gate evidence requirements, deferral and
blocked notes, public Markdown redaction, source invariants, and this release
plan. Run it after changing the gate renderer, status schema, CLI flags, or
release docs.

For broader deployment evidence, keep a private structured evidence file and
render a public-safe summary with:

```bash
npm run operator:evidence -- -- --file <private-evidence-file> --summary
npm run operator:evidence -- -- --file <private-evidence-file> --require-ready
```

The example shape lives at `config/production-evidence.example.json` and is
validated by `npm run release:check`.

Create the public-safe release candidate bundle from the private status and
operator evidence files:

```bash
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --strict-preflight --out <public-bundle-file.md> --quiet
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready
```

If any gate is intentionally skipped, the release notes must say so plainly and
describe the risk.

Before enabling live dogfood traffic from a release candidate, bootstrap and
review the production cutover status file:

```bash
npm run production:cutover -- -- --init-status <operator-cutover-status-file>
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready
```

The 6529.io cutover phase includes
`dashboard-deployment-plan-reviewed`, so the dashboard deployment plan should
be rendered and recorded before dashboard route exposure is marked complete.
It also includes `alert-delivery-plan-reviewed`, so the alert delivery plan
should be rendered and recorded before scheduled alert delivery is marked
complete.

`--require-ready` is the broad-traffic cutover gate. Dogfood-only releases may
defer items, but release notes must name the risk and follow-up owner for each
deferral.

## Tagging Procedure

Use this procedure from a clean checkout after all gates pass:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status --short
npm run release:check
npm run v0:gates -- -- --status-file <operator-status-file> --require-ready
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready --out <public-bundle-file.md> --quiet
npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready
```

The release tag plan is a dry-run tag plan. It checks clean synced `main` and
completed release notes, then prints the operator commands; it does not create
the tag or GitHub Release.

Then review remote checks and create an annotated tag:

```bash
git tag -a v0.1.0 -m "v0.1.0 dogfood release"
git push origin v0.1.0
```

Do not retag a published version. If a release candidate needs fixes, merge the
fixes and create a newer tag.

## Recommended Release Notes Shape

Use [Release Notes Template](release-notes-template.md) as the starting point.
Every `v0` release note should include:

- release status and intended audience;
- supported worker path;
- tested providers and model defaults;
- recommended dogfood budgets;
- public-repo safety requirements;
- known production gaps;
- upgrade and rollback notes.

## Post-Tag Follow-Up

After tagging:

- create or update the GitHub Release from the release notes;
- link the dogfood and deployment runbooks;
- verify target repos pin the intended tag or commit SHA;
- watch alerts, usage ledger writes, and PR comments from the first dogfood
  repositories;
- open follow-up issues for any manual gate that remains deferred.
