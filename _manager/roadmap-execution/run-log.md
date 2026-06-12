# Run Log

## 2026-06-11

- Created `6529-Collections/6529reviewbot` local checkout at
  `D:\repos\6529reviewbot`.
- Moved review-bot code and documentation out of the frontend repo.
- Created the initial public MIT repository foundation.
- Opened and merged PR #1:
  - URL: `https://github.com/6529-Collections/6529reviewbot/pull/1`
  - Merge commit: `50e4b475cde7f48092e36cf5da1eec3e5d5000de`
  - Validation: `npm ci --ignore-scripts`, `npm run check`, `npm test`,
    `git diff --check`, YAML parse for 9 files.
- Enabled repository vulnerability alerts so Dependency Review could run.
- Added local roadmap content covering:
  - central GitHub App model;
  - public repo trusted-actor gates;
  - budget management;
  - public 6529.io transparency page;
  - private 6529.io admin page under existing auth;
  - secret ownership split between bot backend and 6529.io.
- Began autonomous roadmap execution workstream and created durable manager
  memory under `_manager/roadmap-execution/`.
- Opened PR #4 for roadmap and memory; CodeRabbit requested wording fixes in
  `docs/roadmap.md` and this run log; accepted both. PR is pending merge.
- Merged PR #4 as `56930617d998050426d70a2256fb11ba70a51a94`.
- Started `codex/github-app-skeleton` runtime increment for webhook
  verification, event normalization, minimal HTTP server, and docs.
- Merged PR #5 as `9e500b411266ae9cada88f628c99fb70199f9d03`.
- Started `codex/policy-admission` increment for trusted-actor admission,
  public repo budget-abuse prevention, requestor attribution, and docs.
- Merged PR #6 as `d256d41b5ef26e4082c9707bbbd538e247c2e4c4`.
- Started `codex/budget-admission` increment for pre-provider budget checks,
  usage-ledger spend snapshots, budget docs, and app-server enforcement.
- Verified live read-only budget ledger access through Aurora Data API:
  loaded 1 enabled policy and a `global:*` snapshot with zero current spend.
- Merged PR #7 as `69c1739587d9e4224664e6766b0481a848becf33`.
- Started `codex/review-job-interface` increment for App-to-worker job fanout,
  provider/model lanes, per-job budget admission, and worker contract docs.
- Merged PR #8 as `43dfbea9634a165b1986c5fbb52401d34e0296cf`.
- Started `codex/usage-api-contracts` increment for public/admin usage summary
  routes, budget policy route contracts, injectable admin auth, and docs.
- Merged PR #9 as `f5af84041570322f923ba60cd0a74822de35cfc6`.
- Started `codex/usage-api-ledger-loader` increment for read-only Aurora usage
  API loaders, Data API helper reuse, public repo allowlists, and server
  auto-wiring when usage ledger is enabled.
- Live read-only Aurora smoke for the usage API loader passed with zero events
  returned for the last 30 days.
- Merged PR #10 as `edaadc69c3536d064c814937d782738f78a2cc33`.
- Created clean frontend worktree
  `D:\repos\6529seize-frontend-reviewbot` on
  `codex/reviewbot-usage-dashboard`.
- Opened frontend PR #2605:
  `https://github.com/6529-Collections/6529seize-frontend/pull/2605`.
  It adds `/open-data/6529bot`, server-only usage API env handling, the Open
  Data hub card, focused tests, docs, and a Bootstrap Sass import hardening
  discovered during browser verification.
- Frontend validation for PR #2605:
  - `pnpm run test:no-coverage -- __tests__/services/reviewbot-usage-api.test.ts --runInBand --detectOpenHandles --silent=false`
  - `node scripts/typecheck-changed.cjs`
  - focused `pnpm exec eslint --no-warn-ignored --max-warnings=0 ...`
  - `git diff --check`
  - Playwright desktop and mobile render checks against
    `http://localhost:3101/open-data/6529bot` with a local mock usage API.
- PR #2605 is not merged yet because GitHub reports required review and
  pending CodeQL/Snyk/CodeRabbit checks.

## 2026-06-12

- Frontend PR #2605 initially reported one SonarCloud security hotspot caused
  by an `ftp://` negative-path test fixture. Removed that fixture, tightened
  the server-side usage API URL builder to require HTTPS except localhost, and
  constrained the configurable summary path to same-origin paths. Pushed commit
  `a24fdaaae` to the frontend PR.
- Merged `6529reviewbot` PR #11 after CI, Dependency Review, and CodeRabbit
  passed. Local `main` was fast-forwarded to `f635a2d`.
- Started `codex/repo-org-config-policy` increment for target repository
  configuration:
  - strict YAML/JSON config parsing;
  - GitHub contents loading from the base ref;
  - restrictive merge with central admission, job lane, and budget policy;
  - webhook integration before admission and budget checks;
  - docs and a template config file.
- Frontend PR #2605 also received follow-up fixes for SonarCloud and
  CodeRabbit:
  - removed full insecure URL literals from tests;
  - normalized IPv6 localhost hosts before local HTTP allowlist checks;
  - preserved usage API base-path prefixes when joining summary paths.
  All frontend checks are now green; the PR still needs required human review.
- Merged `6529reviewbot` PR #12 as `6edb52d` after CI, Dependency Review, and
  CodeRabbit passed.
- Started `codex/worker-execution-adapters` increment:
  - local worker adapter maps review jobs to the existing review CLI;
  - GitHub Actions adapter dispatches central workflow inputs;
  - `bin/run-review-job.cjs` runs a job JSON payload;
  - `templates/review-job-workflow.yml` provides a central workflow scaffold;
  - worker stdout/stderr are excluded from adapter results unless explicitly
    requested for local debugging.
- Addressed CodeRabbit feedback on PR #13:
  - GitHub Actions dispatch now sends separate `target_repo` and `head_repo`
    fields so fork PR checkouts can use the submitted head repository while
    comments and reporting still target the base repository;
  - `gh workflow run` dispatch is bounded by the worker timeout policy;
  - worker adapter docs and `.env.example` list the advanced binary and working
    directory overrides.
  Validation: `npm test`, `npm run check`, `git diff --check`.
- Merged `6529reviewbot` PR #13 as `1d84b10` after CI, Dependency Review, and
  CodeRabbit passed.
- Started `codex/admin-auth-bridge` increment for private 6529.io admin
  controls:
  - `src/admin-auth.cjs` supports fail-closed disabled mode, internal
    shared-secret mode, and preferred short-lived HMAC assertions;
  - `bin/server.cjs` wires the admin authorizer only when explicitly
    configured;
  - docs explain secret ownership, canonical signing payloads, TTL limits, and
    why this is a bridge to existing 6529.io auth rather than a second login
    system;
  - smoke tests cover shared-secret auth, HMAC success, missing roles,
    path/query signature tampering, expired assertions, TTL limits, and usage
    API admin access.
  Validation: `npm test`, `npm run check`, `git diff --check`.
- Addressed CodeRabbit feedback on PR #14 by documenting multi-role HMAC
  canonicalization and regenerating signed admin headers immediately before
  the smoke-test integration request.
- Merged `6529reviewbot` PR #14 as `17e6dd2` after CI, Dependency Review,
  CodeRabbit, and resolved review threads passed.
- Started `codex/scheduled-spend-alerts` increment:
  - `src/spend-alerts.cjs` evaluates budget utilization and spend-spike alerts
    from usage events and budget policies;
  - `src/alert-notifier.cjs` supports `none`, `stdout`, `webhook`, and SNS
    delivery modes;
  - `src/scheduled-spend-check.cjs` and `bin/run-spend-alert-check.cjs` run
    scheduled checks from the existing Aurora usage ledger;
  - `templates/spend-alert-workflow.yml` provides a central hourly workflow
    scaffold;
  - docs cover alerting configuration, runbook usage, security boundaries, and
    AWS ledger integration.
  Validation: `npm test`, `npm run check`, `git diff --check`, YAML parse for
  all files under `templates/`.
- Addressed CodeRabbit feedback on PR #15 by redacting CLI alert output,
  adding SNS publish timeouts, validating spike dimensions, and quoting and
  ordering the alert environment examples.
- Merged `6529reviewbot` PR #15 as `c079b7a` after CI, Dependency Review,
  CodeRabbit, and resolved review threads passed.
- Started `codex/release-docs-sweep` increment:
  - added `docs/release-readiness.md` with current readiness, community release
    gates, dogfood defaults, and public communication guidance;
  - updated README status, changelog, roadmap, and release process so they
    match the current implementation state.
  Validation: `npm test`, `npm run check`, `git diff --check`, YAML parse for
  all workflow and template files.
- Merged `6529reviewbot` PR #16 as `6bb7e93` after CI, Dependency Review,
  CodeRabbit, and resolved review threads passed.
- Started `codex/github-app-installation-auth` increment:
  - added `src/github-app-auth.cjs` for App JWT creation, installation-token
    exchange, collaborator permission lookup, best-effort org membership, and
    repository config loading through installation tokens;
  - wired `bin/server.cjs` to inject actor context and repository config
    loaders when GitHub App credentials are configured;
  - updated README/configuration/GitHub App/security/architecture/release docs;
  - smoke tests use a generated RSA key and fake GitHub API responses.
  Validation: `npm test`, `npm run check`, `git diff --check`, YAML parse for
  all workflow and template files.
- Addressed CodeRabbit feedback on PR #17 by adding GitHub API request
  timeouts, preserving collaborator permission when the best-effort org
  membership lookup fails, and short-circuiting disabled repository config
  before installation-token exchange.
- Merged `6529reviewbot` PR #17 as `d667ffd` after CI, Dependency Review,
  CodeRabbit, and resolved review threads passed.
- Started `codex/dogfood-onboarding-kit` increment:
  - dogfood runbook for phased rollout from noop to command-only to limited
    initial reviews;
  - conservative central env example and target repo config templates;
  - repository config validator entrypoint.
- Merged `6529reviewbot` PR #18 as `b5f458d` after CI, Dependency Review, and
  CodeRabbit passed with no review threads.
- Opened frontend dogfood config PR #2606:
  `https://github.com/6529-Collections/6529seize-frontend/pull/2606`.
  It adds only `.github/6529bot.yml` in command-only mode. All automated
  checks are green; merge is blocked by required human review.
- Started `codex/production-app-deployment-wiring` increment:
  - central worker jobs carry `installation_id`;
  - worker workflow mints a short-lived GitHub App installation token instead
    of requiring a long-lived target repo token;
  - deployment docs cover App permissions/events, central server env, worker
    secrets, 6529.io usage/admin API wiring, verification, and rollback.
- Addressed CodeRabbit feedback on PR #19 by failing fast before GitHub
  Actions dispatch when a review job lacks a target installation id.
- Merged `6529reviewbot` PR #19 as `cee929b` after CI, Dependency Review,
  CodeRabbit, and resolved review threads passed.
- Started `codex/release-hardening-checklist` increment:
  - repeatable `npm run release:check` gate;
  - manual security review checklist for dogfood expansion and pre-v1 tags.
- Merged `6529reviewbot` PR #20 as `78401dc` after CI, Dependency Review,
  CodeRabbit, and release checks passed.
- Started `codex/v0-release-plan` increment:
  - v0 release plan with explicit tag gates;
  - release notes template for pre-v1 GitHub Releases;
  - README, release docs, roadmap, changelog, and manager-memory sweep.
- Merged `6529reviewbot` PR #21 as `9a5b5e9` after CI, Dependency Review,
  CodeRabbit, and link/release checks passed.
- Started `codex/webhook-replay-tool` increment:
  - dry-run webhook replay CLI for saved GitHub delivery payloads;
  - smoke coverage for argument parsing and replay pipeline behavior;
  - README, configuration, GitHub App, deployment, operations, changelog, and
    manager-memory updates.
- Merged `6529reviewbot` PR #22 as `ea7a118` after CI, Dependency Review,
  CodeRabbit, direct replay smoke, and release checks passed.
- Started `codex/model-catalog-defaults` increment:
  - model catalog for Anthropic, OpenAI, and OpenRouter defaults;
  - runtime wiring for review jobs and standalone review scripts;
  - catalog validator in the release gate;
  - README, configuration, review-jobs, roadmap, changelog, and manager-memory
    updates.
- Addressed CodeRabbit feedback on PR #23 by moving the catalog env example,
  clarifying explicit-lane smoke coverage, and adding explicit unsupported
  provider validation.
- Merged `6529reviewbot` PR #23 as `8cba107` after CI and Dependency Review
  passed; CodeRabbit's follow-up status was stale but the normal merge path
  allowed the merge.
- Started `codex/job-state-ledger` increment:
  - job ledger settings and Aurora Data API insert builder;
  - App hook for budget and dispatch lifecycle event recording;
  - server wiring behind `REVIEWBOT_JOB_LEDGER_ENABLED`;
  - smoke coverage for SQL payload construction and webhook lifecycle events;
  - README, architecture, configuration, GitHub App, deployment, operations,
    usage API, AWS ledger, worker adapter, roadmap, changelog, and
    manager-memory updates.
- Merged `6529reviewbot` PR #24 as `91701f2` after CI and Dependency Review
  passed; CodeRabbit again remained on an in-progress status with no review
  threads, and the normal merge path allowed the merge.
- Started `codex/ledger-schema-tooling` increment:
  - `src/ledger-schema.cjs` defines idempotent Aurora schema statements for
    usage events, job events, model prices, budget policies, indexes, and
    daily spend views;
  - `bin/apply-ledger-schema.cjs` prints SQL by default and requires
    `--apply` for RDS Data API execution;
  - smoke coverage validates SQL rendering, invalid schema rejection, mocked
    apply execution, and CLI argument parsing;
  - docs and release gates now reference `npm run ledger:schema`.
- Merged `6529reviewbot` PR #25 as `0ffd197` after CI and Dependency Review
  passed; CodeRabbit stayed in pending with no review threads, and the normal
  merge path allowed the merge.
- Started `codex/production-preflight` increment:
  - `src/preflight.cjs` validates runtime settings without network calls;
  - `bin/preflight.cjs` exposes text and JSON output plus strict mode;
  - smoke coverage validates success-with-warnings, strict mode, missing
    webhook secret handling, CLI parsing, and local-worker provider key checks;
  - README, configuration, deployment, operations, release, security checklist,
    v0 plan, release notes template, roadmap, changelog, and manager memory
    mention `npm run preflight`.
- Merged `6529reviewbot` PR #26 as `9b57580` after CI and Dependency Review
  passed; CodeRabbit remained queued with no review threads, and the normal
  merge path allowed the merge.
- Started `codex/incident-runbooks` increment:
  - added `docs/incident-response.md` covering severity, first-five-minute
    containment, spend spikes, secret exposure, provider outages, webhook or
    command abuse, ledger/dashboard outages, bad bot comments, and post-incident
    notes;
  - linked incident response from README, operations, release readiness,
    security checklist, release notes template, v0 plan, roadmap, changelog, and
    manager memory.
- Merged `6529reviewbot` PR #27 as `0c9ee6b` after CI and Dependency Review
  passed; CodeRabbit stayed pending with no review threads, and the normal
  merge path allowed the merge.
- Started `codex/run-control` increment:
  - `src/run-control.cjs` defines duplicate-run and concurrency decisions;
  - review jobs now carry a delivery-independent `runKey` that still includes
    provider and model;
  - App server supports an injectable `claimReviewJob` hook between budget
    admission and worker dispatch;
  - ledger schema includes `ai_review_run_claims`;
  - preflight validates run-control settings;
  - docs, changelog, release gates, and manager memory describe the contract.
- Merged `6529reviewbot` PR #28 as `ac7bc12` after CI and Dependency Review
  passed; CodeRabbit stayed pending with no review threads, and the normal
  merge path allowed the merge.
- Started `codex/run-control-ledger` increment:
  - built-in Aurora/RDS Data API claimer for `ai_review_run_claims`;
  - server wiring through `REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED`;
  - preflight validation for run-control ledger settings;
  - smoke coverage for claimed, duplicate, concurrency-denied, and disabled
    ledger decisions;
  - docs and memory update from contract-only to built-in claimer.
- Merged `6529reviewbot` PR #29 as `ba902fe` after CI and Dependency Review
  passed; CodeRabbit remained in progress with no review threads, and the
  normal merge path allowed the merge.
- Started `codex/budget-ledger-wiring` increment:
  - `bin/server.cjs` injects `readBudgetSpendSnapshot` when
    `REVIEW_USAGE_ENABLED=true`;
  - App server passes merged budget policy to the snapshot resolver;
  - smoke coverage confirms repository config budget caps reach the resolver;
  - docs and memory describe production budget ledger wiring.
- Merged `6529reviewbot` PR #30 as `25bd1b9` after CI and Dependency Review
  passed; CodeRabbit remained in progress with no review threads, and the
  normal merge path allowed the merge.
- Started `codex/run-claim-status` increment:
  - run-control ledger can update claim status after dispatch attempts;
  - App server calls an optional `updateRunClaimStatus` hook after queue
    success/failure and dispatch exceptions;
  - `bin/server.cjs` wires the built-in updater when the run-control ledger is
    enabled;
  - smoke coverage validates SQL update construction and dispatch-failed
    status propagation.
- Merged `6529reviewbot` PR #31 as `7d16d96` after CI and Dependency Review
  passed; CodeRabbit remained in progress with no review threads, and the
  normal merge path allowed the merge.
- Started `codex/model-price-tooling` increment:
  - model price file parser and validator;
  - dry-run/apply CLI for `ai_model_prices`;
  - empty example price file to avoid stale committed prices;
  - release check dry-runs the example file;
  - docs and release gates describe operator-maintained price updates.
- Merged `6529reviewbot` PR #32 as `5a3bf47` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/model-price-estimation` increment:
  - active model price lookup for review-runner usage writes;
  - token cost estimator that handles cached input and reasoning tokens;
  - fail-open lookup behavior unless usage ledger fail-closed is enabled;
  - docs and smoke coverage for cost estimation behavior.
- Merged `6529reviewbot` PR #33 as `7aa4bd3` after CI and Dependency Review
  passed; CodeRabbit again had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/run-claim-completion` increment:
  - worker dispatch payloads carry `runKey`;
  - local workers return terminal run-claim statuses;
  - central `bin/run-review-job.cjs` marks claims `running`, then `completed`
    or `failed`;
  - starter GitHub Actions workflow passes run-control ledger environment;
  - docs and smoke coverage describe worker claim completion.
- Merged `6529reviewbot` PR #34 as `91a1e57` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/provider-setup-guides` increment:
  - provider setup guide for Anthropic, OpenAI, and OpenRouter;
  - links to provider-owned docs/pricing/account setup sources;
  - central secret ownership, provider-side limits, rotation, and budget safety
    guidance;
  - README, release, roadmap, changelog, and manager-memory links.
- Merged `6529reviewbot` PR #35 as `199bccc` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/support-bundle` increment:
  - sanitized support bundle module and CLI;
  - release gate dry-runs the JSON support bundle;
  - smoke coverage verifies secret redaction and CLI parsing;
  - support playbook, SUPPORT.md, issue template, README, roadmap, release, and
    manager-memory updates.
- Merged `6529reviewbot` PR #36 as `cc6369d` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/v0-gates-tooling` increment:
  - machine-readable `config/v0-release-gates.json`;
  - `npm run v0:gates` checklist renderer/validator;
  - release-check integration in quiet mode;
  - smoke coverage for duplicate gate validation and CLI parsing;
  - README, release docs, changelog, roadmap, and manager-memory updates.
- Merged `6529reviewbot` PR #37 as `f8e86b2` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/admin-job-events-api` increment:
  - admin-only `GET /api/admin/jobs/recent` route with bounded `limit` and
    optional exact `status` filtering;
  - Aurora Data API reader for `ai_review_job_events`;
  - production server wiring for usage-reader mode and job-ledger-only mode;
  - smoke coverage for SQL rendering, ledger record mapping, direct handler
    behavior, and App server loader forwarding;
  - README, configuration, usage API, deployment, job-ledger, architecture,
    changelog, roadmap, and manager-memory updates.
- Merged `6529reviewbot` PR #38 as `283b9d3` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/admin-status-api` increment:
  - admin-only `GET /api/admin/status` route with `server` and `worker`
    profile selection plus optional strict mode;
  - production server wiring to the existing no-network preflight checks;
  - smoke coverage for direct handler behavior, query validation, and App
    server loader forwarding;
  - README, configuration, usage API, deployment, operations, release
    readiness, v0 release plan, changelog, roadmap, and manager-memory
    updates.
- Merged `6529reviewbot` PR #39 as `9134361` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/runtime-pause-controls` increment:
  - central runtime policy module with global, org, repo, provider, model, and
    review-kind pause controls;
  - App server enforcement before budget admission and worker dispatch;
  - `runtime_disabled` job ledger audit events;
  - preflight/admin-status visibility into runtime control state;
  - smoke coverage for policy filtering, preflight warnings, and webhook
    provider pauses;
  - README, configuration, operations, security model, incident response,
    release readiness, release notes template, v0 release plan, changelog,
    roadmap, and manager-memory updates.
- Merged `6529reviewbot` PR #40 as `137c949` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/comment-command-docs` increment:
  - dedicated `docs/comment-commands.md` covering `/6529bot` and `@6529bot`
    syntax, review-kind aliases, requestor attribution, policy gates, dedupe,
    and examples;
  - README, GitHub App, review workflows, dogfood, release readiness, v0 plan,
    changelog, roadmap, and manager-memory links/updates.
- Merged `6529reviewbot` PR #41 as `752f1a5` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/install-onboarding-guide` increment:
  - ordered `docs/install.md` for fresh checkout, GitHub App creation, central
    runtime configuration, ledger setup, noop server verification, worker
    wiring, 6529.io API wiring, target repo onboarding, gradual live rollout,
    and rollback;
  - dogfood central env template now lists runtime-control pause variables;
  - dogfood rollback now includes scoped and global runtime-control stops;
  - README, deployment, dogfood, changelog, release readiness, v0 plan,
    roadmap, and manager-memory updates.
- Merged `6529reviewbot` PR #42 as `b945e57` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/usage-api-openapi-contract` increment:
  - OpenAPI 3.1 contract for public usage summary and private admin summary,
    budget policies, recent job events, and runtime status;
  - lightweight validator CLI and `npm run validate:api-contract`;
  - release-check integration so endpoint contract drift is caught locally and
    in CI;
  - README, usage API docs, changelog, release readiness, v0 plan, roadmap, and
    manager-memory updates.
- Merged `6529reviewbot` PR #43 as `174b275` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/release-template-hardening` increment:
  - PR template prompts for behavior/API contracts, security boundaries, cost
    controls, release checks, API validation, and preflight;
  - security checklist coverage for runtime pauses, scoped pause bypasses,
    admin job/status APIs, machine-readable API contracts, and secret-redacted
    diagnostics;
  - release docs, changelog, roadmap, and manager-memory updates.
