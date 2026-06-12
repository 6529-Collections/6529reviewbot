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
- usage-write cost estimation from active provider/model price rows;
- 6529.io admin auth bridge contract;
- scheduled operator alert checks for spend and job health with stdout,
  webhook, and SNS delivery modes;
- reviewed GitHub App manifest template for repeatable App registration;
- GitHub App manifest renderer for production-host validation before App
  creation;
- GitHub App manifest conversion CLI for the one-hour manifest code exchange;
- GitHub App registration packet for operator roles, credential custody,
  post-registration checks, rotation, and rollback;
- installed central worker and dormant-by-default alert workflows plus a local
  action-ref pinning guard;
- example AWS IAM/OIDC templates for central Data API and SNS access;
- no-network production preflight command;
- incident response runbook;
- sanitized support bundle and support playbook;
- install and onboarding guide;
- operator evidence template for redacted deployment proof;
- dogfood templates, deployment docs, release checks, and security-review
  checklists.

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
   reviewed worker capacity policy, or the release notes explicitly mark the
   release as local/dogfood-only.
3. If the App server is containerized, the image was built from a reviewed
   commit, scanned, and recorded by digest in private operator evidence.
4. Provider keys, GitHub App secrets, AWS Data API access, and alert secrets
   are configured only in bot-owned infrastructure.
5. AWS IAM/OIDC trust and identity policies are reviewed from the templates in
   `infra/aws` or equivalent least-privilege documents.
6. The 6529.io public usage dashboard is merged, deployed, and wired to the
   public usage API or explicitly deferred in the release notes.
7. The 6529.io private admin surface is wired to the HMAC auth bridge or
   explicitly deferred behind operator-only APIs.
8. Dogfood repository configuration has been merged into at least one trusted
   6529 repository and tested in command-only mode.
9. `npm run ledger:schema -- -- --apply` has been run in the target Aurora
   database, or release notes explicitly mark ledger setup as manual.
10. Central budget policy rows have been reviewed and applied with
   `npm run budget-policies -- -- --file <file> --apply`, or release notes
   explicitly keep budget control to environment/repository caps.
11. Model pricing rows have source URLs, source-checked timestamps, have been
   reviewed against current provider docs, and have been applied with
   `npm run model-prices -- -- --file <file> --apply`, or release notes
   explicitly keep conservative default cost estimates. Any zero-rate rows
   must be documented before using `--allow-zero-price`.
12. Run-control claims are either enforced with conservative caps using the
   built-in ledger-backed claimer or explicitly deferred in release notes with
   the worker adapter kept conservative.
13. A limited initial-review dogfood run has completed with conservative budget
   caps, visible comments, and ledgered usage.
14. Scheduled operator alerts route to an operator-owned channel.
15. `npm run release:check` passes from a clean `main`.
16. `npm run preflight -- -- --strict` passes in the release candidate
    environment, or every warning is accepted in release notes.
17. GitHub CI, Dependency Review, and OpenSSF Scorecard have been reviewed.
18. `docs/security-review-checklist.md` has been completed for the release
    candidate.
19. `CHANGELOG.md`, `README.md`, release notes, templates, and deployment docs
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
```

If any gate is intentionally skipped, the release notes must say so plainly and
describe the risk.

## Tagging Procedure

Use this procedure from a clean checkout after all gates pass:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git status --short
npm run release:check
npm run v0:gates -- -- --status-file <operator-status-file> --require-ready
```

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
