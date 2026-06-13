# Release Readiness

`6529reviewbot` is public and MIT licensed, but it should be treated as
pre-v1 operational infrastructure until the production GitHub App, worker
environment, and 6529.io surfaces are wired and dogfooded.

## Current Readiness

Ready for community review:

- public repository structure, license, governance, support, and security docs;
- standalone review engine for general, follow-up, WCAG 2.2 AA, i18n, and
  crypto/security review modes;
- provider abstraction for Anthropic, OpenAI, and OpenRouter;
- provider setup guide for Anthropic, OpenAI, and OpenRouter;
- default Anthropic model configuration through environment variables;
- trusted-actor admission for public repositories;
- central runtime pause controls before budget or worker dispatch;
- GitHub App installation-token handling for repo config and actor permission
  resolution;
- budget admission against the isolated AWS usage ledger;
- central DB budget policy dry-run/apply tooling and production admission
  loading;
- conservative dogfood budget policy example validated by release checks;
- conservative central budget policy apply path dogfooded against the isolated
  ledger with aggregate scope-count verification;
- review job fanout across review kinds and provider/model lanes;
- run-control contract and Aurora-backed claimer for duplicate delivery claims
  and concurrency caps;
- run-control worker completion updates for durable claims;
- run-control ledger claim, duplicate-denial, and completion-update path
  dogfooded against the isolated ledger with aggregate status verification;
- repository config loading from the target repo base ref;
- local and central GitHub Actions worker adapters;
- native GitHub Actions workflow-dispatch API support with short-lived App
  installation tokens and `gh` fallback for compatibility environments;
- fail-closed provider output guard so empty live model responses do not become
  generic no-finding comments;
- worker diagnostic redaction for common token, alert-webhook, AWS access-key
  id, and private-key shapes in local output tails and GitHub API dispatch
  failure bodies;
- worker capacity and backpressure runbook for live scaling decisions;
- reusable workflow compatibility docs with explicit provider-secret mapping;
- public/admin usage API contracts and Aurora readers;
- validated OpenAPI contract for 6529.io usage/admin API integration;
- public-safe 6529.io dashboard environment template validated against the
  OpenAPI usage/admin API contract;
- admin recent usage-events API for private raw usage triage without direct
  Aurora browser access;
- admin budget-status API for current daily, weekly, and monthly policy
  utilization without direct Aurora browser access;
- admin model-price status API for active price rows, token-class rate
  coverage, and source-evidence freshness without direct Aurora browser
  access;
- admin alert-status API for private alert threshold, schedule, and notifier
  posture checks without exposing delivery secrets;
- admin run-claims API for stale active claim triage without direct Aurora
  browser access;
- admin runtime status API backed by no-network preflight checks;
- admin API diagnostic responses redact and bound custom loader output before
  job-event, runtime-status, or unavailable JSON reaches 6529.io;
- repeatable Aurora ledger schema tooling;
- example AWS IAM/OIDC templates for least-privilege Data API, SNS, and SES
  access;
- reviewed GitHub App manifest template for production registration;
- GitHub App manifest renderer for host-specific validation and local
  registration-form generation;
- GitHub App manifest conversion CLI that writes one-time generated
  credentials only to an explicit private output path;
- public-safe GitHub App registration/setup/callback guidance routes;
- GitHub App registration packet covering operator roles, credential custody,
  acceptance checks, permission changes, rotation, and rollback;
- dry-run/apply tooling for operator-maintained model price rows;
- model price rows require provider source URLs and source-checked timestamps;
- model price apply and production preflight can reject stale or future-dated
  source-checked timestamps before cost estimates rely on bad provider pricing
  evidence;
- model-price apply safety that rejects zero-rate placeholder rows unless an
  operator explicitly allows a documented free price;
- usage-write cost estimation from active provider/model price rows;
- 6529.io admin auth bridge contract;
- server-side 6529.io usage API client helper for signed admin endpoint calls;
- admin snapshot CLI for private dashboard bring-up and release evidence;
- production cutover checklist and validator for go/no-go tracking before live
  dogfood traffic;
- scheduled operator alerts for spend, failed jobs, and stale claims with
  stdout, webhook, SNS, and SES email delivery;
- scheduled alert payloads redact common secret-shaped strings and unsafe
  custom keys before dry-run, stdout, webhook, SNS, or SES output;
- no-network production preflight command;
- release-time preflight fixtures for central App server and worker
  configuration postures;
- public usage summaries enforce repo/org allowlists before repo names are
  disclosed, even when data comes from a custom loader;
- incident response runbook for spend, secret, provider, webhook, ledger, and
  bad-comment incidents;
- sanitized support bundle and support playbook;
- dogfood runbook, conservative config templates, and repository config
  validation tooling;
- dogfood readiness summary command for validating repository configs, central
  budget policy, model catalog, and optional no-network preflight before first
  traffic;
- dogfood execution status checklist for command-only, limited initial-review,
  visibility, alert, and rollback evidence;
- documented maintainer comment-command contract;
- installation and onboarding guide for conservative central App dogfood;
- production deployment runbook and installed central worker workflow that
  mints short-lived GitHub App installation tokens;
- repository-owned container packaging for the central App server with
  non-root runtime, health check, and runtime-only secret injection guidance;
- installed central worker and dormant-by-default alert workflows with
  release-check action pinning validation;
- public env template checker for syntax, duplicate keys, blank secret
  placeholders, and conservative dogfood defaults;
- CI runs `npm run release:check` on pull requests and pushes to `main`;
- OpenSSF Scorecard keeps workflow-level permissions read-only, scopes
  `id-token: write` to the Scorecard job for result publishing, and leaves
  optional SARIF upload disabled until the publishing verifier accepts the
  pinned upload action path cleanly;
- GitHub Action pins use commit SHAs that belong to the action repository;
  annotated release tags are peeled before pinning;
- spend-alert read/evaluation path dogfooded against the isolated ledger in
  dry-run mode, with job-health alert evaluation available once job and
  run-control ledgers are enabled in the scheduled job;
- machine-readable v0 release gates with optional status/evidence rendering;
- structured operator evidence validation and redacted public-summary rendering
  for production deployment proof kept outside the public repo;
- PR and security-review templates that call out API contracts, admin/private
  data boundaries, budget controls, runtime pauses, and release validation.
- security review status checklist for private manual-review evidence without
  copying raw payloads, prompts, private repo details, or live identifiers into
  public release artifacts.

Not yet v1-ready:

- production GitHub App registration and deployment execution;
- production worker deployment execution;
- 6529.io public dashboard merge and production routing;
- 6529.io private admin UI and HMAC bridge wiring;
- production SNS, SES, or webhook alert routing;
- dogfood on one or two target repositories;
- release tags and compatibility guarantees.

## Community Release Gates

Before announcing broad community use:

1. Create and configure the production GitHub App named `6529bot` from the
   reviewed manifest template or equivalent manual settings, using the
   [GitHub App Registration Packet](github-app-registration.md).
2. Deploy the central App server and worker path in controlled 6529
   infrastructure, using the reviewed container image or an equivalent
   operator-reviewed runtime.
3. Configure provider keys, GitHub App secrets, AWS Data API access, and
   alerting secrets only in the bot environment.
4. Review AWS IAM/OIDC trust and identity policies for the central bot runtime.
5. Apply reviewed central budget policies or explicitly keep budget control to
   environment/repository caps for the release.
6. Merge and deploy the 6529.io public transparency dashboard.
7. Wire the 6529.io private admin surface to the HMAC admin auth bridge.
8. Enable scheduled operator alerts through private operator channels.
9. Dogfood on a small set of trusted repositories with conservative budgets.
   Start with [Dogfood Runbook](dogfood.md), `noop` worker mode, and the
   command-only repository config template.
   Run [Dogfood Readiness](dogfood-readiness.md) before the first command-only
   trigger.
10. Run CI, Dependency Review, OpenSSF Scorecard, and a manual security review.
11. Publish an initial `v0` tag with explicit pre-v1 compatibility warnings.
12. Update README, changelog, release notes, install docs, and example configs.

Use `npm run release:check` and
[Security Review Checklist](security-review-checklist.md) as the repeatable
local and manual gates.

Use [v0 Release Plan](v0-release-plan.md) and `npm run v0:gates` for the exact
pre-v1 tagging gates and public release note expectations.
Use [Release Operations Map](release-operations-map.md) or
`npm run release:operations` when choosing the next public check, private
status overlay, or release-candidate command.
Use `npm run v0:gates -- -- --init-status <operator-status-file>` to create a
private pending status skeleton for the current gate list.
Use `npm run v0:gates -- -- --status-file <operator-status-file> --summary`
for the final public-safe gate counts, and use
`npm run v0:gates -- -- --status-file <operator-status-file> --require-ready`
as the tag/no-tag check. `--require-ready` fails if any current gate is missing
from the status file, so regenerate or update private evidence when the public
gate list changes. The status file can stay in the private operator runbook
when evidence contains live deployment details.

Use [Operator Evidence Template](operator-evidence-template.md) to capture
deployment evidence without leaking live account ids, ARNs, secrets, private
repository names, webhook payloads, prompts, or provider responses.
Use [Operator Workspace](operator-workspace.md) to create all current private
status and evidence skeletons in one operator-owned directory:

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir>
npm run operator:workspace -- -- --dir <private-workspace-dir> --check
```

Use [Security Review Status](security-review-status.md) to track manual
security review evidence in a private status file:

```bash
npm run security:review -- -- --init-status <operator-security-status-file>
npm run security:review -- -- --status-file <operator-security-status-file> --summary
npm run security:review -- -- --status-file <operator-security-status-file> --require-ready
```
Use `npm run operator:evidence -- -- --file <private-evidence-file> --summary` to
validate a structured private evidence file and render a redacted public
summary. `operator:evidence --require-ready` is useful for the evidence file
itself: it fails when production evidence sections remain pending or blocked.
Use [Release Candidate Bundle](release-candidate.md) to combine release-gate
counts, missing status ids, operator-evidence counts, redacted operator
sections, git metadata, and no-network preflight into one public-safe release
note artifact. The full pre-tag readiness rule is enforced by the bundle's
`--require-ready`, because that check covers gate completeness, missing status
ids, operator-evidence readiness, and preflight:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file> --strict-preflight
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready
```

Use [Production Cutover](production-cutover.md) when moving from release
readiness to live dogfood traffic. The public checklist stays in this repo; the
real status file stays in the private operator workspace:

```bash
npm run production:cutover -- -- --init-status <operator-cutover-status-file>
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary
npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready
```

Use [Dogfood Readiness](dogfood-readiness.md) as the focused input check before
first traffic:

```bash
npm run dogfood:readiness
npm run dogfood:readiness -- -- --strict-preflight --require-ready
```

Use [Dogfood Status](dogfood-status.md) as the private evidence overlay after
the first live command-only trigger:

```bash
npm run dogfood:status -- -- --init-status <operator-dogfood-status-file>
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --require-ready
```

`npm run check:docs` is included in `npm run release:check` and verifies local
Markdown links across tracked and non-ignored untracked repository docs before
release.
`npm run check:6529-io-env` is included in `npm run release:check` and verifies
that the public-safe 6529.io dashboard environment template keeps placeholder
secrets blank and references only reviewed OpenAPI usage/admin paths.
`npm run check:env-templates` is included in `npm run release:check` and checks
all public env templates for valid syntax, duplicate keys, nonblank secret
placeholders, and conservative dogfood defaults.
`npm run check:release-operations` is included in `npm run release:check` and
keeps the command/evidence-boundary map aligned with package scripts and docs.
`npm run check:public-artifacts` is included in `npm run release:check` and
scans tracked and non-ignored untracked public docs, configs, templates,
workflows, and durable manager memory for live-looking credentials or cloud
identifiers before release.

Use the repository pull request template as the routine contributor gate for
changes that affect behavior, security, cost, or API contracts. It is not a
replacement for the release checklist, but it should catch review-sensitive
changes before they reach release prep.

## Conservative Dogfood Defaults

Use central settings like:

```text
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_MAX_JOBS_PER_DELIVERY=8
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8
REVIEWBOT_ENABLED=true
REVIEWBOT_BUDGET_MODE=enforce
REVIEWBOT_BUDGET_GLOBAL_DAILY_USD=25
REVIEWBOT_BUDGET_REPO_DAILY_USD=10
REVIEWBOT_BUDGET_REQUESTOR_DAILY_USD=5
REVIEWBOT_RUN_CONTROL_MODE=off
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false
REVIEWBOT_ALERTS_ENABLED=true
REVIEWBOT_ALERTS_NOTIFY_MODE=sns
REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=true
```

After the durable run-control claim table is applied, move to:

```text
REVIEWBOT_RUN_CONTROL_MODE=enforce
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true
REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=2
REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=1
```

Use target repo config only to narrow central policy:

```yaml
version: 1
enabled: true
reviewKinds:
  initial: [general, security]
  followup: [followup]
limits:
  maxJobsPerDelivery: 4
admission:
  publicRepoMode: trusted
budget:
  mode: enforce
  caps:
    repo:
      dailyUsd: 5
```

## Public Communication

When releasing publicly, describe the project as:

- a central GitHub App and worker framework, not a prompt-only workflow;
- pre-v1 until production dogfood is complete;
- designed to keep provider keys, AWS access, and bot code out of target repo
  PR control;
- intended to protect public repos with trusted-actor admission and budget
  gates plus run-control claims before model calls.

Avoid implying that arbitrary public repositories can safely enable automatic
model calls without trusted-actor admission and budgets.
