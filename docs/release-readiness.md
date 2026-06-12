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
- default Anthropic model configuration through environment variables;
- trusted-actor admission for public repositories;
- GitHub App installation-token handling for repo config and actor permission
  resolution;
- budget admission against the isolated AWS usage ledger;
- review job fanout across review kinds and provider/model lanes;
- repository config loading from the target repo base ref;
- local and central GitHub Actions worker adapters;
- public/admin usage API contracts and Aurora readers;
- 6529.io admin auth bridge contract;
- scheduled spend alerts with stdout, webhook, and SNS delivery;
- dogfood runbook, conservative config templates, and repository config
  validation tooling;
- production deployment runbook and central worker template that mints
  short-lived GitHub App installation tokens.

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

1. Create and configure the production GitHub App named `6529bot`.
2. Deploy the central App server and worker path in controlled 6529
   infrastructure.
3. Configure provider keys, GitHub App secrets, AWS Data API access, and
   alerting secrets only in the bot environment.
4. Merge and deploy the 6529.io public transparency dashboard.
5. Wire the 6529.io private admin surface to the HMAC admin auth bridge.
6. Enable scheduled spend alerts through private operator channels.
7. Dogfood on a small set of trusted repositories with conservative budgets.
   Start with [Dogfood Runbook](dogfood.md), `noop` worker mode, and the
   command-only repository config template.
8. Run CI, Dependency Review, OpenSSF Scorecard, and a manual security review.
9. Publish an initial `v0` tag with explicit pre-v1 compatibility warnings.
10. Update README, changelog, release notes, install docs, and example configs.

Use `npm run release:check` and
[Security Review Checklist](security-review-checklist.md) as the repeatable
local and manual gates.

Use [v0 Release Plan](v0-release-plan.md) for the exact pre-v1 tagging gates
and public release note expectations.

## Conservative Dogfood Defaults

Use central settings like:

```text
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_MAX_JOBS_PER_DELIVERY=8
REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8
REVIEWBOT_BUDGET_MODE=enforce
REVIEWBOT_BUDGET_GLOBAL_DAILY_USD=25
REVIEWBOT_BUDGET_REPO_DAILY_USD=10
REVIEWBOT_BUDGET_REQUESTOR_DAILY_USD=5
REVIEWBOT_ALERTS_ENABLED=true
REVIEWBOT_ALERTS_NOTIFY_MODE=sns
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
  gates before model calls.

Avoid implying that arbitrary public repositories can safely enable automatic
model calls without trusted-actor admission and budgets.
