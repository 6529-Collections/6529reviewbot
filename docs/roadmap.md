# Roadmap

This roadmap captures the current product and architecture direction for
`6529reviewbot`.

## Direction

Build `6529reviewbot` as a true central GitHub App, not merely a reusable
workflow copied into each target repository.

The preferred production shape is:

- App: a GitHub App named `6529bot` receives PR and comment events.
- Workflow/worker: review jobs run from controlled 6529 infrastructure or from
  this repository's Actions context.
- Model/provider: Anthropic, OpenAI, and OpenRouter are interchangeable behind
  explicit configuration.

The reusable workflow in this repository remains useful as a development and
dogfood bridge, but the polished release should centralize secrets, budgets,
provider routing, and AWS access outside target application repositories.

## Why Central Execution

Central execution means the review job runs as the bot system rather than as
arbitrary caller-repository automation.

Advantages:

- provider keys stay in one controlled place;
- AWS OIDC trust can target the bot runner instead of every caller repo;
- model defaults and per-model policy are managed centrally;
- org-wide and repo-wide budgets are enforceable in one policy layer;
- target repositories do not own bot implementation code;
- the bot can be installed, disabled, upgraded, and audited consistently.

Caller-repo workflows are easier to bootstrap, but they push more setup into
every target repository. They also make budget controls and AWS trust harder:
each caller repo may need variables, secrets, OIDC trust, and workflow rules.
The reusable workflow remains a compatibility path only and must use explicit
provider-secret mapping instead of inheriting every caller secret.

## Release Gates

### 1. Execution Model

- Create the production GitHub App `6529bot`.
- Keep the reviewed GitHub App manifest template in sync with production
  permissions, events, webhook URL shape, and callback/setup URLs.
- Keep manifest rendering dry-run by default so operators can validate the
  production host and registration settings before GitHub returns live
  credentials.
- Keep a public-safe registration packet for operator roles, credential
  custody, acceptance checks, permission changes, rotation, and rollback.
- Decide whether jobs run in GitHub Actions in this repository, an external
  worker, or both.
- Keep worker capacity and backpressure policy explicit before live dogfood
  traffic scales.
- Define the event flow for PR open, synchronize, reopen, ready-for-review, and
  comment commands.
- Keep the reusable workflow as a compatibility/development path only if it
  does not weaken the central trust model.
- Document installation, uninstall, and repo onboarding.

### 2. Policy And Admission

Add a policy layer before any model call.

Default policy:

- Private/internal repos can auto-run on configured PR events.
- Public repos should auto-run only for trusted actors.
- Untrusted external contributors should not trigger model spend by opening or
  updating PRs.
- Trusted maintainers can trigger reviews with comment commands.

Trusted actor sources:

- org membership;
- repo collaborator permission of write, maintain, or admin;
- explicit allowlists;
- later, optionally, carefully scoped prior-contributor policy.

The trusted user who caused the model call should be the requestor for budget
and audit purposes. For an external PR triggered by a maintainer command, the
requestor is the maintainer, not the PR author.

### 3. Budget Management

Budget management is a core product requirement, especially for public
open-source repositories where attackers can attempt to burn provider spend.

The app should enforce hard limits before provider calls:

- org daily and monthly caps;
- repo daily and monthly caps;
- requester daily and monthly caps;
- PR-level caps;
- provider and model caps;
- review-kind caps;
- max parallel runs per org and repo;
- per-head-SHA and per-command dedupe;
- emergency kill switch.

Recommended flow:

1. Webhook arrives.
2. App identifies repo, PR, actor, event type, command, and head SHA.
3. Policy engine decides allowed, denied, or requires a trusted trigger.
4. Budget engine estimates and admits or rejects the run.
5. Worker runs the model with hard context, timeout, and token caps.
6. Usage ledger records actual provider/model/token/cost data.
7. Dashboards summarize spend by org, repo, requester, PR, provider, model, and
   review kind.

The current AWS usage ledger is the foundation for this, but the app still
needs an admission/reservation layer before model calls.

### 4. Visibility And Admin UX

Use `6529.io` as the human-facing surface for both public transparency and
private administration.

Recommended split:

- Public 6529.io transparency page:
  - aggregate spend by day, week, and month;
  - spend by public repo;
  - spend by provider and model;
  - review counts by review kind;
  - average cost per review;
  - coarse budget utilization;
  - public-repo activity only, or private repos aggregated into a generic
    private bucket.
- Private 6529.io admin page:
  - requester-level spend;
  - private repo detail;
  - budget policies;
  - alert recipients and thresholds;
  - runtime configuration warnings;
  - pause/disable controls for org, repo, provider, model, and review kind;
  - recent raw usage events and failed jobs through admin-only bot APIs;
  - emergency kill switch.

The private admin page should run under the existing `6529.io` auth system.
The bot project should not invent a second human auth system. Instead,
`6529.io` should prove the logged-in user's identity and permissions to the
bot backend through a signed token, auth introspection endpoint, or trusted
internal gateway.

The `6529.io` frontend must never talk directly to Aurora or hold AWS/provider
credentials. It should call bot-owned APIs that return safe public aggregates
or authorized admin data.

Alerts should not depend on anyone opening the dashboard. Scheduled checks
should run independently and send warnings through SNS/SES or the chosen 6529
notification path.

### 5. Product Contract

Finalize the user-facing bot contract:

- comment commands and aliases;
- default review kinds on initial PRs;
- follow-up review behavior after new commits;
- same review with multiple providers/models;
- skip behavior for draft PRs, oversized diffs, generated files, and external
  PRs;
- comment format, severity language, and dedupe behavior;
- opt-in repo configuration file format;
- model defaults with a clean update path as providers release new models.
- routine PR review prompts that force security, cost, API contract, and
  release-gate changes into the review conversation before merge.

The built-in provider defaults now live in `config/model-catalog.json` and are
validated by the release check. Production can still override defaults through
environment configuration while testing provider changes.

Current model direction:

- Anthropic defaults to `claude-opus-4-8` through configuration, not scattered
  code constants.
- OpenAI and OpenRouter defaults should remain explicit and easy to update.
- OpenRouter should require explicit model routing unless a repo/org policy
  defines a safe default.

### 6. Secret Ownership

The operational secret boundary should be explicit.

Owned by `6529reviewbot` / bot backend:

- GitHub App private key;
- GitHub webhook secret;
- provider API keys for Anthropic, OpenAI, and OpenRouter;
- AWS permissions for the usage ledger;
- DB secret or Data API access configuration;
- alerting/runtime secrets;
- worker deployment secrets.

Owned by `6529.io`:

- existing user auth/session/JWT secrets;
- user identity/session cookies;
- frontend auth configuration;
- existing 6529 role and authorization machinery.

Shared contract, not shared secrets:

- `6529.io` proves user identity and admin permission.
- `6529reviewbot` verifies that proof before privileged API actions.
- Bot provider keys, GitHub App credentials, and AWS access do not move into
  the frontend repo or browser runtime.

### 7. Security Hardening

Complete a first-principles threat model for:

- prompt injection through diffs, source files, commit messages, and comments;
- spoofed hidden bot metadata;
- external PRs and forked repositories;
- path traversal and symlink escapes;
- accidental secret exposure to model providers, logs, artifacts, or comments;
- provider error leakage;
- AWS credential scope;
- replayed webhook deliveries;
- comment-command abuse;
- model output that is misleading or overconfident.

Security invariants:

- never execute target repository code for review context;
- treat all PR-controlled content as hostile;
- trust GitHub identity and permissions, not prompt text;
- bound all provider calls by input size, output tokens, and timeout;
- use least-privilege AWS access;
- keep provider credentials outside target repo PR control.

### 8. Operations

Build the operator experience:

- spend dashboards by day, org, repo, requester, PR, provider, model, and review
  kind;
- alerting for failed review jobs, ledger write failures, budget exhaustion,
  provider errors, and unusual spend spikes;
- replay tooling for webhook events, starting with dry-run saved-payload
  replay;
- dry-run and prompt-print tools for debugging;
- release tags and changelog discipline;
- v0 release notes and compatibility warnings;
- rollback instructions;
- incident runbooks;
- support process for adopters.
- public-safe operator evidence templates for release, dogfood, and production
  deployment proof.

### 9. Community Release

Before broad community release:

- dogfood on one or two 6529 repositories;
- finalize the GitHub App installation docs;
- publish provider setup guides;
- document public-repo budget protections clearly;
- ship stable examples for repo configuration and comment commands;
- cut the first stable release tag;
- confirm SECURITY.md, support policy, and contribution process are accurate;
- verify OpenSSF Scorecard and dependency review are clean.

## Near-Term Implementation Order

1. Implement the central GitHub App skeleton and webhook verifier.
2. Add the policy/admission engine with trusted-actor checks.
3. Add budget checks against the AWS usage ledger before model calls.
4. Move the current review engine behind a worker/job interface.
5. Add bot API endpoints for public aggregates and authenticated admin data.
6. Add the `6529.io` public transparency page and private admin page.
7. Add repo/org configuration loading and validation.
8. Add worker execution adapters.
9. Add worker capacity and backpressure policy.
10. Add the 6529.io admin auth bridge contract.
11. Add alerting and scheduled spend checks.
12. Dogfood on one target repo with conservative limits.
13. Iterate docs, release process, and install flow toward a v1 tag.

## Current Progress

Completed in `6529reviewbot`:

- central GitHub App skeleton and webhook verifier;
- trusted-actor admission for public repositories;
- central runtime pause controls for org, repo, provider, model, review kind,
  and emergency global stops;
- documented comment-command contract for maintainer-triggered reviews;
- GitHub App installation-token handling for repository config and actor
  permission resolution;
- budget admission against the AWS usage ledger;
- production server budget spend snapshot wiring;
- dry-run/apply tooling for central budget policies and production admission
  loading from enabled DB rows;
- conservative dogfood budget policy example validated by release checks;
- review-job fanout with provider/model lanes;
- run-control contract and Aurora-backed claimer for duplicate delivery claims
  and concurrency caps;
- run-control claim status updates after dispatch attempts and worker
  completion;
- public and admin usage API contracts;
- validated OpenAPI contract for 6529.io usage/admin API integration;
- admin runtime status API backed by no-network preflight checks;
- read-only Aurora usage API loaders;
- repository configuration loading, validation, restrictive policy merge, and
  base-ref GitHub contents loading;
- worker execution adapters for local workers and central GitHub Actions
  dispatch;
- worker capacity and backpressure runbook for conservative live scaling;
- reusable workflow compatibility docs and explicit provider-secret mapping;
- 6529.io admin auth bridge contract;
- alerting and scheduled spend checks.
- dogfood runbook, conservative dogfood templates, and repository config
  validation.
- production deployment runbook and central worker installation-token flow.
- reviewable GitHub App manifest template for production registration.
- GitHub App manifest renderer for host-specific validation and local
  registration forms.
- GitHub App manifest conversion CLI that writes one-time generated
  credentials only to an explicit private output path.
- Public-safe GitHub App browser handoff routes for manifest, setup, and
  callback redirects.
- GitHub App registration packet for operator roles, credential custody,
  acceptance checks, permission changes, rotation, and rollback.
- installed central worker and dormant-by-default alert workflows with
  action-ref validation.
- repeatable release check script and manual security review checklist.
- documentation link checker for the public docs surface.
- public artifact leak scanner for docs, examples, workflows, and durable
  manager memory.
- machine-readable v0 release gates and checklist renderer.
- v0 release gate readiness summaries and tag/no-tag enforcement for
  operator-owned status files.
- optional v0 release gate status files for public-safe completion/defer
  evidence.
- validated model catalog for provider defaults.
- durable job lifecycle ledger for budget and dispatch audit events.
- repeatable Aurora ledger schema tooling.
- live run-control ledger claim, duplicate-denial, and completion-update path
  verified with a synthetic dogfood claim.
- dry-run/apply model pricing tooling.
- example AWS IAM/OIDC templates for central Data API and SNS access.
- ledger schema re-apply support for managed daily aggregate views.
- additive ledger table migrations for older dogfood databases.
- budget-scope constraint refreshes for older dogfood databases.
- conservative dogfood budget policy apply path verified against the isolated
  ledger with aggregate scope counts.
- spend-alert read/evaluation path verified against the isolated ledger in
  dry-run mode.
- usage-write cost estimation from maintained model price rows.
- provider setup guide for Anthropic, OpenAI, and OpenRouter.
- installation and onboarding guide for conservative central App dogfood.
- sanitized support bundle and support playbook.
- no-network production preflight checks.
- incident response runbook for operator containment and recovery.
- operator evidence template for public-safe deployment proof.

In progress in `6529reviewbot`:

- production deployment execution support, dogfood operations, release
  evidence collection, and dashboard wiring.

In progress outside this repository:

- Public `6529.io` usage dashboard PR:
  [6529-Collections/6529seize-frontend#2605](https://github.com/6529-Collections/6529seize-frontend/pull/2605).

Next implementation focus:

- dogfood on a target repo with conservative limits;
- production GitHub App deployment and 6529.io wiring.
