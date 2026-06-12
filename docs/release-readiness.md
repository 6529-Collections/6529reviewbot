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
- review job fanout across review kinds and provider/model lanes;
- run-control contract and Aurora-backed claimer for duplicate delivery claims
  and concurrency caps;
- run-control worker completion updates for durable claims;
- repository config loading from the target repo base ref;
- local and central GitHub Actions worker adapters;
- public/admin usage API contracts and Aurora readers;
- validated OpenAPI contract for 6529.io usage/admin API integration;
- admin runtime status API backed by no-network preflight checks;
- repeatable Aurora ledger schema tooling;
- example AWS IAM/OIDC templates for least-privilege Data API and SNS access;
- reviewed GitHub App manifest template for production registration;
- GitHub App manifest renderer for host-specific validation and local
  registration-form generation;
- dry-run/apply tooling for operator-maintained model price rows;
- usage-write cost estimation from active provider/model price rows;
- 6529.io admin auth bridge contract;
- scheduled spend alerts with stdout, webhook, and SNS delivery;
- no-network production preflight command;
- incident response runbook for spend, secret, provider, webhook, ledger, and
  bad-comment incidents;
- sanitized support bundle and support playbook;
- dogfood runbook, conservative config templates, and repository config
  validation tooling;
- documented maintainer comment-command contract;
- installation and onboarding guide for conservative central App dogfood;
- production deployment runbook and central worker template that mints
  short-lived GitHub App installation tokens;
- machine-readable v0 release gates and checklist renderer;
- PR and security-review templates that call out API contracts, admin/private
  data boundaries, budget controls, runtime pauses, and release validation.

Not yet v1-ready:

- production GitHub App registration and deployment execution;
- production worker deployment choice and scaling policy;
- 6529.io public dashboard merge and production routing;
- 6529.io private admin UI and HMAC bridge wiring;
- production SNS/webhook alert routing;
- dogfood on one or two target repositories;
- release tags and compatibility guarantees.

## Community Release Gates

Before announcing broad community use:

1. Create and configure the production GitHub App named `6529bot` from the
   reviewed manifest template or equivalent manual settings.
2. Deploy the central App server and worker path in controlled 6529
   infrastructure.
3. Configure provider keys, GitHub App secrets, AWS Data API access, and
   alerting secrets only in the bot environment.
4. Review AWS IAM/OIDC trust and identity policies for the central bot runtime.
5. Apply reviewed central budget policies or explicitly keep budget control to
   environment/repository caps for the release.
6. Merge and deploy the 6529.io public transparency dashboard.
7. Wire the 6529.io private admin surface to the HMAC admin auth bridge.
8. Enable scheduled spend alerts through private operator channels.
9. Dogfood on a small set of trusted repositories with conservative budgets.
   Start with [Dogfood Runbook](dogfood.md), `noop` worker mode, and the
   command-only repository config template.
10. Run CI, Dependency Review, OpenSSF Scorecard, and a manual security review.
11. Publish an initial `v0` tag with explicit pre-v1 compatibility warnings.
12. Update README, changelog, release notes, install docs, and example configs.

Use `npm run release:check` and
[Security Review Checklist](security-review-checklist.md) as the repeatable
local and manual gates.

Use [v0 Release Plan](v0-release-plan.md) and `npm run v0:gates` for the exact
pre-v1 tagging gates and public release note expectations.

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
