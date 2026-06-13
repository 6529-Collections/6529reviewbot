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
- Merged `6529reviewbot` PR #44 as `9678649` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/budget-policy-tooling` increment:
  - central budget policy JSON validator and dry-run/apply CLI;
  - empty public example file and release-check integration;
  - production server loading of enabled DB policy rows into admission when
    `REVIEW_USAGE_ENABLED=true`;
  - smoke coverage for file validation, SQL rendering, Data API apply, CLI
    parsing, and DB-loaded budget denial before queueing;
  - README, budget, ledger, install, dogfood, operations, deployment, release,
    roadmap, and manager-memory docs.
- Merged `6529reviewbot` PR #45 as `38a5ca9` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/aws-iam-templates` increment:
  - placeholder-based GitHub Actions OIDC trust policy example;
  - Aurora Data API and Secrets Manager identity policy example;
  - scheduled spend alert Data API plus SNS identity policy example;
  - release-check JSON parsing for `infra/aws`;
  - README, AWS ledger, deployment, operations, security, release, roadmap, and
    manager-memory updates.
- Merged `6529reviewbot` PR #46 as `461bea3` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/github-app-manifest` increment:
  - placeholder-only GitHub App manifest template for `6529bot` registration;
  - release-check JSON parsing for templates;
  - install, deployment, GitHub App, release gate, security checklist,
    changelog, roadmap, and manager-memory docs.
- Merged `6529reviewbot` PR #47 as `fecf502` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/github-app-manifest-renderer` increment:
  - host-specific GitHub App manifest renderer module and CLI;
  - optional local registration-form output for GitHub's manifest flow;
  - release-check rendering validation and smoke coverage;
  - README, install, deployment, GitHub App, release, security, roadmap,
    changelog, and manager-memory docs.
- Merged `6529reviewbot` PR #48 as `d115833` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/pin-template-actions` increment:
  - pinned central worker and spend-alert template actions by commit SHA;
  - disabled persisted checkout credentials in central templates;
  - added central worker timeout/concurrency defaults and AWS OIDC
    credential configuration;
  - added `npm run check:workflow-actions` and release-check integration;
  - README, worker, deployment, release, security, roadmap, changelog, and
    manager-memory docs.
- Merged `6529reviewbot` PR #49 as `5f9d53c` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Inspected AWS `us-east-1` with the configured operator credentials:
  - found an existing operator Aurora PostgreSQL Serverless v2 usage cluster;
  - database `reviewbot`, Data API enabled, encrypted storage, private
    instance, deletion protection on, min ACU 0/max ACU 1;
  - initial schema apply reached the managed views and failed because an
    existing view definition could not drop columns through
    `create or replace view`.
- Started `codex/ledger-view-recreate` increment:
  - ledger schema drops bot-managed daily aggregate views before recreating
    them;
  - smoke coverage asserts the managed-view drop statement;
  - AWS usage ledger, deployment, release, security checklist, changelog,
    roadmap, and manager-memory docs.
- Merged `6529reviewbot` PR #50 as `f7677bb` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Re-ran the live Aurora ledger schema apply from `main` after PR #50:
  - apply succeeded through the RDS Data API;
  - read-only verification found the expected five base tables and three daily
    aggregate views;
  - aggregate counts showed zero usage/job/run/model-price rows and one budget
    policy row;
  - no raw payloads, prompts, provider responses, secrets, or private row data
    were read into the public work log.
- Started `codex/operator-ledger-evidence` increment:
  - public-safe operator evidence template for GitHub App, AWS ledger, IAM,
    budget/pricing, worker/alerts, 6529.io surfaces, dogfood, and release
    decisions;
  - README, deployment, release-readiness, release, v0 plan, security
    checklist, changelog, roadmap, and manager-memory docs.
- Merged `6529reviewbot` PR #51 as `6c128a7` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/dogfood-budget-example` increment:
  - concrete dogfood budget policy example with global, org, repo, requestor,
    provider, and review-kind caps;
  - release-check dry-run validation for the dogfood budget policy file;
  - README, budget policy, dogfood, install, release-readiness, v0 plan,
    changelog, roadmap, and manager-memory docs.
- Merged `6529reviewbot` PR #52 as `a62dbe5` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Tried applying conservative operator budget caps to the live ledger:
  - skipped the public placeholder requestor row;
  - discovered the older budget policy table lacked the managed `notes`
    column;
  - inspected managed table column sets and found the model-prices table also
    had an older shape.
- Started `codex/ledger-additive-migrations` increment:
  - additive schema migrations for missing model-price `id`, `created_at`, and
    `source_url` columns;
  - additive schema migration for missing budget-policy `notes`;
  - smoke coverage and AWS ledger/release/security/roadmap docs.
- Merged `6529reviewbot` PR #53 as `6811de2` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Re-applied the live ledger schema with the additive migrations; it completed
  successfully and reported all managed table, index, constraint-column, and
  view statements applied.
- Retried the conservative operator budget caps. The apply then hit an older
  `ai_review_budget_policies_scope_type_check` constraint that allowed
  `requester` but rejected the canonical `org` scope.
- Started `codex/budget-scope-check-migration` increment:
  - named budget-scope check constraint for new budget policy tables;
  - repeatable legacy `requester` to `requestor` normalization;
  - repeatable managed budget-scope constraint drop/add using canonical app
    scopes;
  - smoke coverage and AWS ledger/release/security/roadmap docs.
- Merged `6529reviewbot` PR #54 as `04916c7` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Re-applied the live ledger schema with the budget-scope constraint refresh;
  it completed successfully and reported the legacy scope normalization,
  managed constraint drop, and managed constraint add statements applied.
- Applied conservative dogfood budget policies to the live isolated ledger:
  - six statements applied;
  - aggregate verification showed one row each for `global`, `org`, `repo`,
    `provider`, `model`, and `review_kind`;
  - no raw policy notes, live resource identifiers, prompts, payloads, or
    provider data were committed to the public repo.
- Started `codex/record-budget-apply` increment to record this public-safe
  evidence in docs and manager memory.
- Merged `6529reviewbot` PR #55 as `775dc07` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/install-central-workflows` increment:
  - install `.github/workflows/review-job.yml` from the central worker
    template;
  - install `.github/workflows/spend-alerts.yml` with an hourly schedule that
    remains dormant unless `REVIEWBOT_ALERTS_ENABLED=true`;
  - add the same alert enablement guard to the template;
  - update deployment, alerting, release-readiness, v0, roadmap, changelog, and
    manager-memory docs.
- Merged `6529reviewbot` PR #56 as `7de5779` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/release-gate-status` increment:
  - `npm run v0:gates` accepts an optional `--status-file`;
  - release gate status files can mark gates `pending`, `complete`,
    `deferred`, or `blocked` with evidence/notes;
  - release checks validate the example status file;
  - README, release process, v0 plan, release notes template, changelog,
    roadmap, and manager memory document the workflow.
- Merged `6529reviewbot` PR #57 as `8933a01` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Ran a live run-control smoke against the isolated ledger with a synthetic
  operator job:
  - first claim returned `run_control_claimed`;
  - second claim with the same run key returned `duplicate_run`;
  - status update to `completed` succeeded;
  - aggregate status verification showed one completed synthetic claim and no
    active stuck claims;
  - no exact run key, live resource identifier, prompt, payload, provider data,
    or secret was committed to the public repo.
- Started `codex/record-run-control-smoke` increment to record the public-safe
  evidence in run-control docs, release readiness, roadmap, changelog, and
  manager memory.
- Merged `6529reviewbot` PR #58 as `9fdd374` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Ran the spend-alert checker against the isolated ledger with `--dry-run` and
  `--force`:
  - ledger reads completed for the default 35-day alert window;
  - enabled central budget policies were evaluated;
  - zero alerts were generated for the current empty-usage dogfood ledger;
  - notification delivery stayed in dry-run mode.
- Started `codex/record-alert-dry-run` increment to record this public-safe
  alert evidence in docs and manager memory.
- Merged `6529reviewbot` PR #59 as `6590b79` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/github-app-registration-packet` increment:
  - add an operator-facing GitHub App registration packet for `6529bot`;
  - document registration roles, manifest review, GitHub-generated secret
    custody, post-registration acceptance checks, permission changes,
    rotation, rollback, and public-safe evidence;
  - link the packet from README, installation, GitHub App, deployment, release,
    release readiness, security checklist, operator evidence, v0 gates,
    roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #60 as `e67840d` after CI and Dependency Review
  passed; CodeRabbit had no actionable review threads, and the normal merge
  path allowed the merge.
- Started `codex/github-app-manifest-conversion` increment:
  - add an operator CLI for exchanging GitHub's temporary manifest code;
  - require explicit private output for the one-time generated credential
    response;
  - print only redacted summaries and refuse public-repo output by default;
  - document the conversion step in README, install, GitHub App, deployment,
    release, release readiness, v0 plan, roadmap, changelog, and manager
    memory.
- Merged `6529reviewbot` PR #61 as `8ed1478` after CI and Dependency Review
  passed; CodeRabbit had no actionable review threads, and the normal merge
  path allowed the merge.
- Started `codex/worker-capacity-runbook` increment:
  - add a worker capacity and backpressure runbook for conservative live
    scaling;
  - document starting caps, scale-up order, stuck-job checks, provider limits,
    alert prerequisites, backpressure controls, and public/private evidence;
  - link the runbook from README, worker adapters, deployment, operations,
    release, release readiness, v0 plan, roadmap, security checklist, operator
    evidence, changelog, and manager memory.
- Merged `6529reviewbot` PR #62 as `5c4583d` after CI and Dependency Review
  passed; there were no actionable review threads.
- Started `codex/explicit-reusable-workflow-secrets` increment:
  - declare the provider secrets accepted by the reusable workflow;
  - replace caller-template `secrets: inherit` with explicit provider-secret
    mapping;
  - add reusable workflow compatibility docs explaining that the central App
    remains the preferred production path;
  - link the secret-boundary guidance from README, architecture, security,
    AWS ledger, release, release readiness, security checklist, roadmap,
    changelog, and manager memory.
- Merged `6529reviewbot` PR #63 as `19f7943` after CI and Dependency Review
  passed; CodeRabbit had no actionable review threads, and the normal merge
  path allowed the merge.
- Started `codex/github-app-operator-routes` increment:
  - add public-safe JSON guidance routes for GitHub App manifest completion,
    setup, and callback redirects;
  - avoid echoing manifest codes or generated credentials in route responses;
  - smoke-test that manifest completion detects a code without returning the
    code value;
  - update GitHub App, install, deployment, release readiness, security
    checklist, roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #64 as `8c77d41` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/release-gate-readiness-summary` increment:
  - add release-gate completion/deferred/pending/blocked summaries;
  - add a `--require-ready` CLI gate that fails when status files still have
    pending or blocked gates;
  - keep deferrals allowed only with documented notes so pre-v1 releases can
    be explicit about accepted risk;
  - update release docs, roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #65 as `cf01360` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/public-artifact-secret-scan` increment:
  - add a release-check scanner for public docs, configs, workflows, examples,
    and durable manager memory;
  - flag live-looking AWS account ids/ARNs, GitHub tokens, provider keys, AWS
    access keys, and private key blocks while redacting values in output;
  - allow placeholder account ids and avoid source test fixtures so fake
    fixture secrets do not hide real public-artifact leaks;
  - update release/security/support docs, roadmap, changelog, and manager
    memory.
- Merged `6529reviewbot` PR #66 as `a8e8a61` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/docs-link-check` increment:
  - add a local Markdown link checker for repository docs;
  - skip fenced code blocks and external URLs while checking local targets;
  - wire the checker into release checks;
  - update release-readiness docs, roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #67 as `93c738b` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Started `codex/ci-release-check` increment:
  - switch the default CI workflow from separate `check`/`test` commands to
    the full `npm run release:check`;
  - document that PR CI now covers docs links, public artifact scanning,
    workflow pins, API contracts, model catalog, and templates;
  - update release docs, roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #68 as `392fb07` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Investigated failing OpenSSF Scorecard on `main` after PR #67/#68:
  - current CI passed, but Scorecard failed in the publishing step;
  - logs reported workflow verification failure because workflow-level
    `security-events: write` and `id-token: write` were set;
  - official Scorecard docs require no workflow-level write permissions when
    publishing results, with `id-token: write` only on the Scorecard job.
- Started `codex/fix-scorecard-permissions` increment:
  - move Scorecard `security-events: write` and `id-token: write` permissions
    from workflow level to the `scorecard` job;
  - keep workflow-level permissions read-only;
  - update release docs, roadmap, changelog, and manager memory.
- Merged `6529reviewbot` PR #69 as `0b56a84` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no review
  threads, and the normal merge path allowed the merge.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow-level permission verification passed;
  - publishing still failed because `actions/checkout@v6.0.3` was pinned to
    annotated tag object `9f698171...`, which Scorecard reported as an
    imposter commit that does not belong to `actions/checkout`;
  - GitHub's tag API resolved the tag object to peeled commit
    `df4cb1c069e1874edd31b4311f1884172cec0e10`.
- Started `codex/peel-checkout-action-pin` increment:
  - replace every installed/template `actions/checkout` pin with the peeled
    `v6.0.3` commit SHA;
  - document that annotated action tags must be peeled before pinning;
  - update release docs, security checklist, roadmap, changelog, and manager
    memory.
- Merged `6529reviewbot` PR #70 as `d709bef` after CI and Dependency Review
  passed.
- Rechecked the post-merge OpenSSF Scorecard run:
  - the Scorecard analysis itself passed the pinned-dependency and token
    permission checks;
  - publishing still failed because the optional
    `github/codeql-action/upload-sarif` step was rejected by the Scorecard
    workflow verifier even though it used an action-repository commit ref;
  - first-party Scorecard result publishing through `publish_results: true`
    remains enabled.
- Started `codex/remove-scorecard-sarif-upload` increment:
  - remove the optional SARIF upload step from the Scorecard workflow;
  - remove the now-unused `security-events: write` job permission;
  - document that SARIF upload stays disabled until the verifier-safe action
    path is re-reviewed.
- Merged `6529reviewbot` PR #71 as `6dfa0d2` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27413184306`;
  - job `scorecard` completed successfully;
  - the workflow now publishes results through `ossf/scorecard-action` without
    the optional SARIF upload step.
- Started `codex/job-health-alerts` increment:
  - add job-health alert evaluation for failed jobs and stale active
    run-control claims;
  - extend bounded ledger readers for recent job events and run-claim rows;
  - wire the central scheduled alert workflow to pass opt-in job-health
    thresholds;
  - update alerting, operations, job-ledger, worker-capacity, release, and
    manager-memory docs.
- Merged `6529reviewbot` PR #72 as `a78f874` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27413929619`;
  - job `scorecard` completed successfully.
- Rechecked frontend PRs #2605 and #2606:
  - all automated checks are green;
  - both remain blocked only by required human review.
- Started `codex/model-price-zero-guard` increment:
  - reject zero-rate model price rows during `--apply` by default;
  - add `--allow-zero-price` for provider-documented free rates;
  - update model-pricing, install, release, security, changelog, and manager
    docs.
- Merged `6529reviewbot` PR #73 as `3c91725` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27414334834`;
  - job `scorecard` completed successfully.
- Started `codex/v0-status-bootstrap` increment:
  - add `--init-status <path>` to `npm run v0:gates` for operator-owned
    release gate status skeletons;
  - refuse to overwrite existing status files unless `--force` is supplied;
  - document the release-candidate evidence bootstrap flow.
- Merged `6529reviewbot` PR #74 as `7de7a4d` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27414690610`;
  - job `scorecard` completed successfully.
- Started `codex/container-deployment-packaging` increment:
  - wire the production `bin/server.cjs` entrypoint to the configured worker
    adapter instead of the generic no-queue fallback;
  - add runtime-only container packaging for the central App server;
  - document build, secret injection, worker dispatch, health checks, and
    rollback;
  - extend env examples for job-health alert controls;
  - update release, security, roadmap, changelog, and manager-memory docs.
- Merged `6529reviewbot` PR #75 as `31f0f6f` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27415706144`;
  - job `scorecard` completed successfully.
- Started `codex/native-github-actions-dispatch` increment:
  - add native GitHub REST API dispatch for central `github_actions` worker
    jobs when a bot-owned dispatch token is configured;
  - keep the `gh` CLI path as compatibility fallback;
  - make preflight fail closed for API dispatch without a token;
  - slim the central App server container image so it no longer needs bundled
    GitHub CLI state for production dispatch;
  - update configuration, worker, container, security, release, and support
    docs.
- Merged `6529reviewbot` PR #76 as `e145528` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge OpenSSF Scorecard run:
  - workflow `OpenSSF Scorecard`, run `27416485221`;
  - job `scorecard` completed successfully.
- Started `codex/github-app-dispatch-token` increment:
  - let the production server mint a short-lived GitHub App installation token
    for the central bot repository when
    `REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID` is configured;
  - keep explicit dispatch tokens and `gh` CLI dispatch as fallback paths;
  - make preflight treat App installation id plus App credentials as a valid
    API dispatch token source;
  - update worker, configuration, deployment, container, security, support, and
    release docs.
- Hardened `codex/github-app-dispatch-token` before PR:
  - documented the preferred dispatch-only GitHub App boundary so the
    target-repository App manifest stays least-privilege and does not silently
    gain `Actions: write`;
  - added smoke coverage for both split dispatch-App credentials and the
    explicitly reviewed main-App fallback;
  - verified `npm test`, `npm run check`, `npm run check:docs`,
    `npm run check:public-artifacts`, `npm run release:check`, and
    `git diff --check`;
  - built `6529reviewbot:codex-dispatch-token` and verified `/healthz` returned
    `{"ok":true}` with no-op runtime settings.
- Merged `6529reviewbot` PR #77 as `6f50666` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder/release-note summary
  and no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27417858533`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27417858550`, completed successfully.
- Started `codex/github-app-token-cli-profile` increment:
  - add `--profile main|worker-dispatch` to the installation-token CLI;
  - keep existing main-App behavior as the default;
  - document testing the dispatch-only App token path from a private operator
    environment.
- Merged `6529reviewbot` PR #78 as `1ccb5e2` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27418288556`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27418288537`, completed successfully.
- Started `codex/harden-admin-auth-headers` increment:
  - accept standard `Headers` objects in the admin auth bridge;
  - reject malformed HMAC actor and role headers before signature comparison;
  - document the 6529.io signer value contract.
- Merged `6529reviewbot` PR #79 as `3fa71dc` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27418709413`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27418709355`, completed successfully.
- Started `codex/harden-webhook-preflight` increment:
  - accept standard `Headers` objects for GitHub webhook header parsing;
  - warn during preflight when the webhook secret is shorter than the
    production minimum;
  - document the high-entropy webhook secret expectation.
- Merged `6529reviewbot` PR #80 as `583a044` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27419177111`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27419177107`, completed successfully.
- Started `codex/unify-usage-data-api` increment:
  - refactor `usage-ledger.cjs` onto the shared Data API execution helper;
  - preserve exported `awsCliBin` and `shouldUseShellForAwsCli` compatibility;
  - add smoke coverage for usage write SQL/parameters without touching AWS.
- Merged `6529reviewbot` PR #81 as `54c893d` after CI and Dependency Review
  passed; CodeRabbit had only its in-progress placeholder and no actionable
  review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27419596591`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27419596595`, completed successfully.
- Started `codex/harden-alert-sns-runner` increment:
  - keep default Windows AWS CLI shell compatibility;
  - avoid shell mode when notifier settings carry an explicit AWS CLI binary;
  - add smoke coverage for the custom runner path.
- Merged `6529reviewbot` PR #82 as `b856029` after CI and Dependency Review
  passed; CodeRabbit completed without actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27419966713`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27419966666`, completed successfully.
- Started `codex/cover-dispatch-exceptions` increment:
  - add smoke coverage that thrown dispatch failures, including
    dispatch-token mint failures, update run claims as `dispatch_error`;
  - verify the job-event ledger also receives `dispatch_error` entries for
    the dispatch stage.
- Merged `6529reviewbot` PR #83 as `09e27a5` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's test-hardening comment before
  merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27420806013`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27420805994`, completed successfully.
- Started `codex/fail-empty-provider-output` increment:
  - fail closed when provider calls return empty visible review text;
  - keep dry-run behavior intact while avoiding misleading live no-finding
    comments;
  - document the operator-facing failure mode.
- Merged `6529reviewbot` PR #84 as `d4df15e` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27421392624`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27421392627`, completed successfully.
- Started `codex/redact-worker-diagnostics` increment:
  - sanitize worker adapter diagnostics before returning queue results;
  - cover local stdout/stderr summaries and GitHub API dispatch error bodies;
  - document redacted diagnostics as helpful but not public-log-safe.
- Merged `6529reviewbot` PR #85 as `acadad7` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27422064280`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27422064412`, completed successfully.
- Started `codex/docs-runtime-hardening-sweep` increment:
  - align README, changelog, release readiness, and security model with
    empty-provider-output fail-closed behavior;
  - document worker diagnostic redaction in the top-level public narrative.
- Merged `6529reviewbot` PR #86 as `dfe24ca` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27422585207`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27422585170`, completed successfully.
- Started `codex/docs-security-checklist-hardening` increment:
  - add manual security checklist items for empty provider output fail-closed
    behavior and worker diagnostic redaction;
  - prompt release notes to describe evidence for those controls.
- Merged `6529reviewbot` PR #87 as `958b2ae` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's release-template nit before
  merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27423183591`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27423183558`, completed successfully.
- Started `codex/scan-alert-webhook-urls` increment:
  - add public artifact scanner detection for common Slack and Discord alert
    webhook URL secrets;
  - document the expanded scanner coverage in the support playbook.
- Merged `6529reviewbot` PR #88 as `36ecf97` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27423816671`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27423816809`, completed successfully.
- Started `codex/release-preflight-fixtures` increment:
  - found that enabled usage-ledger preflight imports
    `assertUsageLedgerConfigured`, but `src/usage-ledger.cjs` did not export
    it;
  - add a release-time no-network preflight fixture check for central App
    server and worker postures.
- Merged `6529reviewbot` PR #89 as `018281c` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27424485515`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27424485444`, completed successfully.
- Started `codex/support-bundle-privacy` increment:
  - move `REVIEWBOT_WORKER_GITHUB_REPO` from safe support-bundle output to
    presence-only reporting;
  - redact absolute `*_PATH` safe values so public bundles do not reveal local
    filesystem detail.
- Merged `6529reviewbot` PR #90 as `fae8322` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's Windows path sanitizer comment
  before merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27425340037`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27425340032`, completed successfully.
- Started `codex/model-price-source-checked-at` increment:
  - require model price rows to include when the provider pricing source was
    checked;
  - store `source_checked_at` in the ledger so operator price evidence is
    auditable without committing current price rows to the public repo.
- Merged `6529reviewbot` PR #91 as `cd3a987` after CI, Dependency Review, and
  CodeRabbit passed with no actionable review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27426138045`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27426138066`, completed successfully.
- Started `codex/price-staleness-preflight` increment:
  - reject stale or future-dated `sourceCheckedAt` model price evidence during
    apply unless an operator passes `--allow-stale-source`;
  - add optional preflight validation for `REVIEWBOT_MODEL_PRICE_FILE` without
    exposing the configured file path in status output;
  - document the price-evidence freshness policy in the README, release gates,
    security checklist, and operator runbooks.
- Merged `6529reviewbot` PR #92 as `d8ec89e` after CI and Dependency Review
  passed. CodeRabbit initially stayed pending, then completed successfully
  after merge with no inline comments and only its generic docstring-coverage
  warning.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27427475018`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27427475455`, completed successfully.
- Started `codex/operator-checks-price-evidence` increment:
  - align machine-readable v0 release gate wording with the new fresh
    source-check requirement;
  - update the sample release-gate status and roadmap progress list.
- Merged `6529reviewbot` PR #93 as `17bd42e` after CI and Dependency Review
  passed. CodeRabbit completed successfully after merge with no actionable
  comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27427922979`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27427923015`, completed successfully.
- Started `codex/release-notes-price-evidence` increment:
  - add model price source freshness and accepted override fields to the
    release notes template;
  - add model price dry-run/apply checks and override evidence to the release
    checklist and operations runbook;
  - make provider setup require fresh `sourceCheckedAt` evidence before relying
    on local cost estimates.
- Merged `6529reviewbot` PR #94 as `82627cd` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27428316250`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27428316266`, completed successfully.
- Started `codex/container-image-release-gate` increment:
  - add the missing machine-readable v0 `container-image` gate from the prose
    release plan;
  - add smoke-test assertions for the container-image gate and model-price
    freshness wording.
- Merged `6529reviewbot` PR #95 as `ce616e1` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27428697897`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27428697926`, completed successfully.
- Started `codex/release-gate-parity-check` increment:
  - add a release-check script that compares `config/v0-release-gates.json`
    count with the numbered required-gates list in `docs/v0-release-plan.md`;
  - wire the parity script into `npm run release:check` and release docs.
- Merged `6529reviewbot` PR #96 as `8cc28de` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's path-specific diagnostic comment
  before merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27429492824`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27429492819`, completed successfully.
- Started `codex/release-status-completeness` increment:
  - make the final `npm run v0:gates -- -- --status-file <file>
    --require-ready` check fail when a status file omits any current gate;
  - add smoke coverage for missing status ids and complete status files;
  - document the need to refresh private evidence when public gates change.
- Merged `6529reviewbot` PR #97 as `a081839` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27430221092`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27430221140`, completed successfully.
- Started `codex/scan-root-env-example` increment:
  - include the tracked root `.env.example` in the public artifact scanner;
  - add smoke coverage for `.env.example` scanner scope;
  - document that release/support leak scans cover `.env.example`.
- Merged `6529reviewbot` PR #98 as `78b9a03` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27430631422`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27430631489`, completed successfully.
- Started `codex/redact-app-dispatch-errors` increment:
  - redact App server dispatch exception messages before they enter run-claim
    status metadata or job-event reasons;
  - add smoke coverage with bearer/provider-key shaped failure text;
  - document the App server diagnostic boundary in security and job-ledger
    docs.
- Merged `6529reviewbot` PR #99 as `705799a` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's non-string stack guard before
  merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27431657762`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27431657742`, completed successfully.
- Started `codex/redact-ledger-diagnostics` increment:
  - apply shared diagnostic redaction to alert, preflight, job-ledger,
    run-control-ledger, usage-ledger, and worker lifecycle error summaries;
  - redact job-event reasons, job-event metadata strings, and run-claim
    metadata strings before persistence;
  - add smoke coverage for job-event and run-claim metadata redaction.
- Merged `6529reviewbot` PR #100 as `a13a3ad` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27432328666`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27432328178`, completed successfully.
- Started `codex/redact-repository-config-reasons` increment:
  - shorten and redact repository config invalid/unavailable reasons through
    the normalized load-result path and public summary boundary;
  - add smoke coverage for a secret-shaped unsupported config key and
    multiline public-summary reason redaction;
  - update README, changelog, repository config docs, and the security model.
- Local validation for `codex/redact-repository-config-reasons`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #101 as `e61d08f` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27433003716`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27433003709`, completed successfully.
- Started `codex/release-readiness-next-hardening` increment:
  - validate and deduplicate `REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES` using the
    same role format as incoming HMAC assertions;
  - add smoke coverage for invalid and duplicate required-role config;
  - update admin-auth bridge docs, configuration docs, changelog, and manager
    memory.
- Local validation for `codex/release-readiness-next-hardening`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- CodeRabbit reviewed PR #102 and suggested adding the 1-80 character role
  length to `docs/configuration.md`; accepted the nitpick for consistency with
  `docs/admin-auth-bridge.md`.
- Merged `6529reviewbot` PR #102 as `f3792a3` after CI, Dependency Review, and
  CodeRabbit passed; addressed CodeRabbit's docs quick win before merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27433865691`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27433865775`, completed successfully.
- Started `codex/redact-review-runner-errors` increment:
  - move review-runner provider error summaries and one-line warning helpers
    onto the shared diagnostic redaction path;
  - make all five review-mode CLI entrypoints print a bounded redacted fatal
    error line instead of a raw stack;
  - add smoke coverage for provider error redaction of bearer, GitHub,
    provider-key, and private-key shapes;
  - update the changelog, security model, and manager memory.
- Local validation for `codex/redact-review-runner-errors`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #103 as `b02b32e` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27434450173`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27434450251`, completed successfully.
- Started `codex/redact-utility-cli-errors` increment:
  - move remaining `bin/` fatal error handlers onto `safeErrorLine`;
  - redact secret-shaped validator path prefixes in model-catalog and
    repository-config validators;
  - add smoke coverage for CLI fatal redaction and validator path/error
    redaction.
- Local validation for `codex/redact-utility-cli-errors`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed;
  - targeted scan found no remaining raw stack/error-message fatal printing in
    `bin/`.
- Merged `6529reviewbot` PR #104 as `3337d1a` after CI, Dependency Review, and
  CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27435143416`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27435143456`, completed successfully.
- Started `codex/redact-manifest-conversion-errors` increment:
  - redact GitHub App manifest conversion HTTP error response bodies;
  - redact common secret shapes in manifest conversion summaries, including
    output paths and GitHub-owned strings;
  - add smoke coverage for failed conversion response redaction and summary
    redaction.
- Local validation for `codex/redact-manifest-conversion-errors`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #105 as `6fe47d2` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27435569801`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27435569612`, completed successfully.
- Started `codex/redact-support-git-status` increment:
  - redact support-bundle git branch/status output through the shared
    diagnostic redaction helper before JSON or Markdown output;
  - add smoke coverage for token-shaped branch names and
    `git status --short` file names;
  - update the support playbook, changelog, security model, and manager
    memory.
- Local validation for `codex/redact-support-git-status`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #106 as `5ca19e8` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27436153293`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27436153312`, completed successfully.
- Started `codex/redact-support-bundle-values` increment:
  - defensively redact selected safe support-bundle environment values;
  - defensively redact support-bundle preflight error and warning messages;
  - sanitize Markdown rendering as a second output boundary;
  - update the support playbook, changelog, security model, and manager
    memory.
- Local validation for `codex/redact-support-bundle-values`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #107 as `5c315ca` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27436722350`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27436722166`, completed successfully.
- Started `codex/redact-release-gate-status` increment:
  - redact release-gate status notes and evidence before normalized JSON or
    Markdown output;
  - add smoke coverage for token-shaped complete evidence, deferred notes, and
    rendered release-gate Markdown;
  - update release docs, operator evidence guidance, changelog, security model,
    and manager memory.
- Local validation for `codex/redact-release-gate-status`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit's test-coverage nitpick on PR #108 by pinning the
  1000-character release-gate status evidence/notes truncation contract in
  smoke tests; `npm test`, `npm run release:check`, and `git diff --check`
  passed again.
- Merged `6529reviewbot` PR #108 as `03e4c0f` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no remaining actionable
  comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27437738432`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27437738451`, completed successfully.
- Started `codex/redact-policy-price-notes` increment:
  - redact and cap model-price `notes` before dry-run SQL output or DB apply;
  - redact and cap central budget-policy `notes` before dry-run SQL output or
    DB apply;
  - add smoke coverage for token-shaped notes and rendered SQL output;
  - update model-pricing, budget-policy, security, changelog, and manager
    memory.
- Local validation for `codex/redact-policy-price-notes`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #109 as `92c1636` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27438312984`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27438312999`, completed successfully.
- Started `codex/scan-local-private-paths` increment:
  - flag common local private filesystem paths in public artifacts;
  - replace concrete GitHub App conversion output paths with placeholders;
  - add smoke coverage for Windows private paths, Unix home paths, and allowed
    repository checkout breadcrumbs;
  - update support/security docs, changelog, and manager memory.
- Local validation for `codex/scan-local-private-paths`:
  - `npm run check:public-artifacts` passed;
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #110 by extending the Windows private
  path scanner to detect JSON-escaped backslashes and slash-style drive paths;
  targeted `npm run check:public-artifacts` and `npm test` passed.
- Merged `6529reviewbot` PR #110 as `360a7e9` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with the prior review thread marked
  addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27439016597`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27439016601`, completed successfully.
- Started `codex/redact-alert-aws-diagnostics` increment:
  - add AWS access-key id and Slack/Discord alert webhook URL patterns to the
    shared diagnostic redactor;
  - add smoke coverage for worker output redaction and safe error-line
    redaction;
  - update README, diagnostic safety docs, security checklist, changelog, and
    manager memory.
- Local validation for `codex/redact-alert-aws-diagnostics`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #111 as `ba7f63c` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27439789624`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27439789639`, completed successfully.
- Started `codex/worker-dispatch-app-preflight` increment:
  - prevent partial `REVIEWBOT_WORKER_GITHUB_APP_*` credential overrides from
    silently mixing worker App ids with main App private keys;
  - add a preflight warning when central workflow dispatch reuses the main
    GitHub App credentials instead of a dispatch-only App;
  - update worker/deployment/security docs, changelog, and manager memory.
- Local validation for `codex/worker-dispatch-app-preflight`:
  - `npm run check:preflight` passed;
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #112 as `e0a62cc` after CI, Dependency Review,
  OpenSSF Scorecard, and CodeRabbit passed with no actionable comments.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27440518581`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27440518580`, completed successfully.
- Started `codex/public-usage-repo-allowlist` increment:
  - enforce `REVIEWBOT_USAGE_API_PUBLIC_REPOS` and
    `REVIEWBOT_USAGE_API_PUBLIC_ORGS` in the public usage summarizer itself,
    not only in the Aurora loader;
  - share the repo disclosure helper with the ledger adapter;
  - add smoke coverage for direct summaries and HTTP route responses with and
    without allowlists;
  - update usage/security/release-readiness docs, changelog, and manager
    memory.
- Local validation for `codex/public-usage-repo-allowlist`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #113 by requiring exact `owner/repo`
  shape before a repo name can match a public org allowlist; malformed repo
  names now collapse in public summaries. `npm test`, `npm run release:check`,
  and `git diff --check` passed again.
- Merged `6529reviewbot` PR #113 as `c8adf86` after CI, Dependency Review,
  and CodeRabbit passed with the prior review thread marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27441492889`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27441492875`, completed successfully.
- Started `codex/sanitize-admin-api-diagnostics` increment:
  - sanitize admin job-event response strings and metadata at the usage API
    boundary, even when custom loaders bypass ledger-write normalization;
  - sanitize admin runtime-status diagnostic payloads before returning them to
    6529.io;
  - redact loader unavailable reasons before they become `503` JSON errors;
  - update usage, job-ledger, security, OpenAPI, changelog, and manager docs.
- Local validation for `codex/sanitize-admin-api-diagnostics`:
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #114 by coercing sanitized admin
  runtime-status `preflight` output to `object | null` so strict clients keep
  the OpenAPI contract even when custom loaders return scalar diagnostics.
  `npm test`, `npm run release:check`, and `git diff --check` passed again.
- Merged `6529reviewbot` PR #114 as `cbb9388` after CI, Dependency Review,
  and CodeRabbit passed with the prior review thread marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27442589521`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27442589528`, completed successfully.
- Started `codex/sanitize-alert-payloads` increment:
  - sanitize scheduled alert payloads at the notifier boundary before dry-run,
    stdout, webhook, or SNS delivery;
  - sanitize scheduled-check returned alerts so operator dry-run summaries and
    delivery payloads share the same output shape;
  - add smoke coverage for secret-shaped alert titles, messages, scope values,
    nested values, webhook URLs, and custom keys;
  - update alerting, security, release-readiness, changelog, and manager docs.
- Local validation for `codex/sanitize-alert-payloads`:
  - `npm run check:public-artifacts` passed after replacing a complete
    Slack-webhook-shaped test literal with a runtime-assembled fixture;
  - `npm test` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #115 by naming dry-run summaries in the
  security model and adding mocked webhook-delivery coverage for unsafe alert
  payload sanitization. `npm run check:public-artifacts`, `npm test`,
  `npm run release:check`, and `git diff --check` passed again.
- Merged `6529reviewbot` PR #115 as `aba63a5` after CI, Dependency Review,
  and CodeRabbit passed with the prior review threads addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27443472827`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27443472823`, completed successfully.
- Started `codex/admin-run-claims-api` increment:
  - add admin-only `GET /api/admin/run-claims/recent` for recent, active, and
    stale run-control claim triage;
  - wire the route through the existing usage API settings, admin auth, App
    server, and Aurora usage/run-control ledger loaders;
  - sanitize run-claim strings and scalar metadata at the response boundary;
  - update OpenAPI, usage, job-ledger, run-control, install, deployment,
    operations, worker-capacity, security-review, release-readiness, README,
    changelog, and manager memory.
- Local focused validation for `codex/admin-run-claims-api`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #116 by making `active=true` reject
  terminal `status` filters, documenting that rule, and ordering recent
  run-claim ledger reads newest-first. `npm test`, `npm run check:docs`,
  `npm run release:check`, and `git diff --check` passed again.
- Merged `6529reviewbot` PR #116 as `076a02f` after CI, Dependency Review,
  and CodeRabbit passed with the prior review thread marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27444700213`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27444700230`, completed successfully.
- Local clean-main validation after PR #116 merge:
  - `npm run release:check` passed.
- Started `codex/admin-usage-events-api` increment:
  - add admin-only `GET /api/admin/usage/events/recent` for bounded recent raw
    usage-event triage without direct browser-side Aurora access;
  - reuse the existing usage event loader with an endpoint-specific `limit`;
  - sanitize raw usage-event strings and scalar metadata at the response
    boundary;
  - update OpenAPI, usage, configuration, install, deployment, operations,
    GitHub App, security-review, release-readiness, README, changelog, and
    manager memory.
- Local validation for `codex/admin-usage-events-api`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Self-review tightened the Aurora usage-event reader so direct internal
  callers also get a positive bounded `limit` before Data API execution.
- Final pre-PR validation for `codex/admin-usage-events-api`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #117 by adding
  `REVIEWBOT_USAGE_API_MAX_ITEMS` to `.env.example`, enforcing
  `REVIEWBOT_USAGE_API_MAX_EVENTS` at the direct ledger-reader boundary, and
  adding smoke coverage for oversized internal usage-event limits. `npm test`,
  `npm run check:docs`, `npm run release:check`, and `git diff --check` passed
  again.
- Addressed follow-up CodeRabbit feedback on PR #117 by making the admin
  usage-events HTTP parser and ledger reader share one hard raw-row cap:
  `REVIEWBOT_USAGE_API_MAX_EVENTS`; `REVIEWBOT_USAGE_API_MAX_ITEMS` remains the
  small default page-size knob when lower. Updated docs, OpenAPI, and smoke
  coverage. `npm test`, `npm run validate:api-contract`,
  `npm run release:check`, and `git diff --check` passed again.
- Merged `6529reviewbot` PR #117 as `be45716` after CI, Dependency Review, and
  CodeRabbit passed with the prior review threads marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27446316101`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27446316103`, completed successfully.
- Local clean-main validation after PR #117 merge:
  - `npm run release:check` passed.
- Started `codex/production-evidence-checks` increment:
  - inspect existing release/evidence tooling for gaps;
  - add public-safe production evidence validation or rendering support where
    it can reduce operator ambiguity without storing secrets or live resource
    identifiers in the public repo;
  - update release/readiness docs and manager memory.
- Implemented local production evidence checker:
  - added `src/operator-evidence.cjs` and `bin/operator-evidence.cjs`;
  - added `config/production-evidence.example.json`;
  - added `npm run operator:evidence` and release-check validation of the
    example evidence file;
  - rendered Markdown and JSON outputs redact common token shapes, AWS account
    ids, and AWS ARNs before public copy/paste;
  - updated README, release, v0, release-readiness, operator-evidence, and
    changelog docs.
- Local validation for `codex/production-evidence-checks`:
  - `npm test` passed;
  - `node bin\operator-evidence.cjs --file config\production-evidence.example.json --summary` passed;
  - `node bin\operator-evidence.cjs --file config\production-evidence.example.json --json` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #118:
  - explicit empty operator-evidence statuses now fail validation instead of
    defaulting to `pending`;
  - only evidence objects validated by `src/operator-evidence.cjs` can skip
    the full schema path in downstream summary/readiness helpers;
  - smoke coverage now asserts both regressions.
- Local validation after the PR #118 hardening pass:
  - `npm test` passed;
  - `node bin\operator-evidence.cjs --file config\production-evidence.example.json --summary` passed;
  - `node bin\operator-evidence.cjs --file config\production-evidence.example.json --json` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #118 as `ed604f9` after CI, Dependency Review,
  and CodeRabbit passed with the prior review threads marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27447351646`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27447351620`, completed successfully.
- Local clean-main validation after PR #118 merge:
  - `npm run release:check` passed.
- Started `codex/release-candidate-bundle` increment:
  - add one public-safe release candidate bundle command around release gates,
    operator evidence, git/package metadata, and no-network preflight;
  - harden release-gate status validation so explicit empty statuses no longer
    default to `pending`;
  - normalize npm script option examples to the repo-compatible
    `npm run <script> -- -- --flag` form;
  - update release docs and manager memory.
- Local validation for `codex/release-candidate-bundle`:
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `node bin\release-candidate.cjs --json --quiet` passed;
  - `node bin\release-candidate.cjs --status-file config\v0-release-status.example.json --operator-evidence-file config\production-evidence.example.json --json --quiet` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Addressed CodeRabbit feedback on PR #119:
  - touched CLI parsers now tolerate a standalone `--`, so npm-forwarded and
    direct `node bin\*.cjs -- --flag` examples both work;
  - release-candidate docs now explicitly call out preflight message
    sanitization;
  - release-readiness and release-notes template now identify
    `release:candidate --require-ready` as the full tag/no-tag readiness gate.
- Local validation after the PR #119 feedback pass:
  - `node bin\operator-evidence.cjs -- --file config\production-evidence.example.json --summary --quiet` passed;
  - `node bin\support-bundle.cjs -- --json --quiet` passed;
  - `node bin\release-candidate.cjs -- --json --quiet` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #119 as `8b96e77` after CI, Dependency Review,
  and CodeRabbit passed with the prior review threads marked addressed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27448713252`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27448713256`, completed successfully.
- Local clean-main validation after PR #119 merge:
  - `npm run release:check` passed.
- Started `codex/admin-budget-status` increment:
  - add an admin-only `GET /api/admin/budget/status` endpoint for current
    daily, weekly, and monthly utilization per enabled central budget policy;
  - add a grouped Aurora usage ledger reader so dashboards do not duplicate
    budget scope logic or read Aurora directly;
  - update OpenAPI, configuration docs, usage API docs, release readiness,
    roadmap, changelog, and manager memory.
- Focused local validation for `codex/admin-budget-status`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run check:docs` passed;
  - `git diff --check` passed.
- Final local validation for `codex/admin-budget-status`:
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #120 as `ebedc1e` after CI and Dependency Review
  passed; CodeRabbit remained in its processing placeholder with no review
  threads, and the normal merge path allowed the merge.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27449490416`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27449490446`, completed successfully.
- Local clean-main validation after PR #120 merge:
  - `npm run release:check` passed.
- Started `codex/admin-alert-status` increment:
  - add an admin-only `GET /api/admin/alerts/status` endpoint for alert
    thresholds, schedule caps, and notifier posture;
  - add a public-safe alert status helper that reports notifier presence only,
    not webhook URLs, SNS topic ARNs, AWS account ids, or alert payload bodies;
  - update OpenAPI, configuration docs, usage API docs, release readiness,
    roadmap, changelog, and manager memory.
- Focused local validation for `codex/admin-alert-status`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run check:docs` passed;
  - `git diff --check` passed.
- Final local validation for `codex/admin-alert-status`:
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #121 as `103d4b8` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27449932488`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27449932485`, completed successfully.
- Local clean-main validation after PR #121 merge:
  - `npm run release:check` passed.
- Started `codex/admin-model-price-status` increment:
  - add an admin-only `GET /api/admin/model-prices/status` endpoint for active
    model price rows, token-class rate coverage, and source freshness;
  - add an Aurora reader that returns admin-safe price posture without operator
    notes or full source URLs;
  - wire the production server loader through the existing usage-ledger
    settings and shared model-price freshness policy;
  - update OpenAPI, configuration docs, usage API docs, release readiness,
    roadmap, changelog, and manager memory.
- Focused local validation for `codex/admin-model-price-status`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `git diff --check` passed.
- Final local validation for `codex/admin-model-price-status`:
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #122 as `34f1ef9` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27450498582`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27450498576`, completed successfully.
- Local clean-main validation after PR #122 merge:
  - `npm run release:check` passed.
- Started `codex/admin-api-client-contract` increment:
  - add a server-side usage API client helper for 6529.io admin integration;
  - sign HMAC admin requests with the existing admin-auth canonical payload;
  - build only relative API paths, inject request timeouts, and redact API
    error text before throwing;
  - add a 6529.io integration guide and cross-links from usage/admin-auth docs;
  - update configuration docs, release readiness, roadmap, changelog, security
    model, and manager memory.
- Local validation for `codex/admin-api-client-contract`:
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #123 as `d76a02e` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27450861094`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27450861103`, completed successfully.
- Local clean-main validation after PR #123 merge:
  - `npm run release:check` passed.
- Started `codex/admin-snapshot-client` increment:
  - add an admin snapshot reducer and CLI that calls the server-side usage API
    client and summarizes endpoint posture;
  - keep output to counts, posture flags, and redacted errors instead of raw
    admin rows or private scope values;
  - add release/evidence docs so operators can use the command for private
    dashboard bring-up and release validation.
- Local validation for `codex/admin-snapshot-client`:
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #124 as `ddf81f1` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27451191556`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27451191558`, completed successfully.
- Local clean-main validation after PR #124 merge:
  - `npm run release:check` passed.
- Started `codex/production-cutover-checklist` increment:
  - add a public-safe production cutover checklist artifact that enumerates
    operator go/no-go steps without live resource identifiers;
  - add a validator/renderer so cutover evidence can be summarized in PRs,
    release notes, or private operator runbooks without drifting from docs;
  - wire the check into release validation and align README, deployment,
    release, readiness, roadmap, changelog, and manager memory.
- Local validation for `codex/production-cutover-checklist`:
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run production:cutover -- -- --status-file config/production-cutover-status.example.json --summary` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #125 as `0d9a91d` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27451765258`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27451765279`, completed successfully.
- Local clean-main validation after PR #125 merge:
  - `npm run release:check` passed.
- Started `codex/release-candidate-cutover-summary` increment:
  - add optional production cutover status summary support to the
    release-candidate bundle;
  - keep cutover evidence public-safe and redacted, while the real status file
    remains private operator-owned state;
  - update release docs, smoke tests, release checks, changelog, roadmap, and
    manager memory.
- Local validation for `codex/release-candidate-cutover-summary`:
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:candidate -- -- --cutover-status-file config/production-cutover-status.example.json --json --quiet` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #126 as `ad77def` after CI and Dependency Review
  passed; the normal protected merge path allowed the merge while CodeRabbit
  remained in its processing placeholder with no review threads.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27452012603`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27452012605`, completed successfully.
- Local clean-main validation after PR #126 merge:
  - `npm run release:check` passed.
- Started `codex/ses-alert-notifier` increment:
  - add `ses` as a scheduled alert notify mode using AWS CLI `sesv2 send-email`;
  - keep alert email bodies on the already sanitized notifier payload;
  - extend preflight, admin alert status, env docs, alerting docs, release
    readiness, roadmap, changelog, smoke tests, and manager memory.
- Local validation for `codex/ses-alert-notifier`:
  - `npm test` passed;
  - `npm run validate:api-contract` passed;
  - `npm run check:docs` passed;
  - `npm run check:workflow-actions` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #127 as `8ae2e69` after CI and OpenSSF Scorecard
  passed.
- Rechecked the post-merge main workflows:
  - workflow `CI`, run `27452378228`, completed successfully;
  - workflow `OpenSSF Scorecard`, run `27452378237`, completed successfully.
- Started frontend branch `codex/reviewbot-admin-dashboard` in
  `D:\repos\6529seize-frontend-reviewbot`, stacked on
  `codex/reviewbot-usage-dashboard`.
- Opened frontend PR #2632:
  `https://github.com/6529-Collections/6529seize-frontend/pull/2632`.
  It adds `/tools/6529bot/admin`, a server-only admin API client, the
  operator dashboard UI, env placeholders, tests, and docs for the private
  6529.io admin surface.
- Frontend validation for PR #2632:
  - `pnpm run format:changed` passed;
  - `pnpm run test:no-coverage -- __tests__/services/reviewbot-admin-api.test.ts __tests__/services/reviewbot-usage-api.test.ts --runInBand` passed with 13 tests;
  - `pnpm run lint:changed` passed;
  - `pnpm run typecheck:changed` passed;
  - `pnpm run base-build` passed and confirmed `/tools/6529bot/admin` is
    dynamic server-rendered;
  - `git diff --cached --check` passed;
  - Playwright smoke against `http://localhost:3101/tools/6529bot/admin`
    returned HTTP 200 with the expected fail-closed `Admin Not Configured`
    state and no rendered secret-like admin terms.
- Local note: the frontend repo-local `6529` wrapper failed in this Windows
  worktree due the wrapper path/script-shell issue, so equivalent underlying
  scripts were run with `SEIZE_6529_COMMAND=1` and the result was documented in
  PR #2632.
- Started `codex/dogfood-readiness-check` increment:
  - add a public-safe `dogfood:readiness` command that composes target repo
    config validation, dogfood budget policy validation, model catalog
    validation, and optional no-network preflight;
  - wire the command into release checks and smoke coverage;
  - update README, dogfood, operations, release, release-readiness, roadmap,
    changelog, and manager memory.
- Local validation for `codex/dogfood-readiness-check`:
  - `npm run dogfood:readiness` passed and rendered the public-safe Markdown
    report;
  - `npm run dogfood:readiness -- -- --json --quiet --require-ready` passed;
  - `npm run dogfood:readiness -- -- --preflight --json` passed and reported
    missing private runtime config without failing;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #129 as `81b1e08` after CI and Dependency Review
  passed.
- Started `codex/6529-io-env-template` increment:
  - add `templates/6529-io-reviewbot-env.example` as the public-safe env-name
    source for 6529.io public and private dashboard routes;
  - add `scripts/check-6529-io-env-template.cjs` so release checks keep live
    secrets blank in the public template and verify every configured dashboard
    path exists in `docs/usage-api.openapi.json`;
  - update install, deployment, configuration, admin integration, release,
    readiness, roadmap, README, changelog, and manager memory.
- Local validation for `codex/6529-io-env-template`:
  - `npm run check:6529-io-env` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #130 as `5015b66` after CI and Dependency Review
  passed.
- Started `codex/dogfood-status-checklist` increment:
  - add a canonical dogfood execution checklist and public example status
    file;
  - add `npm run dogfood:status` for Markdown/JSON rendering, private status
    overlays, status skeleton initialization, and `--require-ready` checks;
  - wire the example into smoke tests and release checks;
  - harden docs link and public artifact checks to include non-ignored
    untracked files before staging;
  - update README, dogfood, install, release, readiness, v0 plan, roadmap,
    changelog, and manager memory.
- Local validation for `codex/dogfood-status-checklist`:
  - `npm run dogfood:status -- -- --json --quiet` passed;
  - `npm run dogfood:status -- -- --status-file config/dogfood-status.example.json --summary --json --quiet` passed;
  - `npm test` passed;
  - `npm run check:docs` passed and checked the new untracked docs file;
  - `npm run check:public-artifacts` passed and checked the new untracked
    public config/docs files;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #131 as `1a7915a` after CI and Dependency Review
  passed.
- Started `codex/release-candidate-dogfood-status` increment:
  - add optional `--dogfood-status-file` support to `release:candidate`;
  - include dogfood complete/deferred/pending/blocked counts and missing item
    ids in JSON and Markdown bundles;
  - enforce dogfood status readiness under `--require-ready` when supplied;
  - update release docs, README, v0 plan, roadmap, changelog, smoke tests,
    release checks, and manager memory.
- Local validation for `codex/release-candidate-dogfood-status`:
  - `npm run release:candidate -- -- --dogfood-status-file config/dogfood-status.example.json --json --quiet` passed;
  - `npm run release:candidate -- -- --dogfood-status-file config/dogfood-status.example.json --cutover-status-file config/production-cutover-status.example.json --json --quiet` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #132 as `5aa39b1` after CI and Dependency Review
  passed.
- Started `codex/check-env-templates` increment:
  - add `npm run check:env-templates`;
  - validate `.env.example`, `templates/dogfood-central-env.example`, and
    `templates/6529-io-reviewbot-env.example` for syntax, duplicate keys,
    blank secret placeholders, and conservative dogfood defaults;
  - wire the check into smoke tests and release checks;
  - update README, configuration, release, readiness, roadmap, changelog, and
    manager memory.
- Local validation for `codex/check-env-templates`:
  - `npm run check:env-templates` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #133 as `559c449` after CI and Dependency Review
  passed.
- Started `codex/security-review-status` increment:
  - add a canonical security review checklist and public example status file;
  - add `npm run security:review` for Markdown/JSON rendering, private status
    overlays, status skeleton initialization, and `--require-ready` checks;
  - wire the example into smoke tests and release checks;
  - add security review follow-up commands to the release-candidate bundle;
  - update README, security review docs, release docs, readiness, v0 plan,
    roadmap, changelog, and manager memory.
- Local validation for `codex/security-review-status`:
  - `npm run security:review -- -- --json --quiet` passed;
  - `npm run security:review -- -- --status-file config/security-review-status.example.json --summary --json --quiet` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #134 as `5884263` after CI and Dependency Review
  passed.
- Started `codex/release-candidate-security-status` increment:
  - add optional `--security-review-status-file` support to
    `release:candidate`;
  - include security-review complete/deferred/pending/blocked counts and
    missing item ids in JSON and Markdown bundles;
  - enforce security-review readiness under `--require-ready` when supplied;
  - update release docs, README, v0 plan, roadmap, changelog, smoke tests,
    release checks, and manager memory.
- Local validation for `codex/release-candidate-security-status`:
  - `npm run release:candidate -- -- --security-review-status-file config/security-review-status.example.json --json --quiet` passed;
  - `npm run release:candidate -- -- --dogfood-status-file config/dogfood-status.example.json --security-review-status-file config/security-review-status.example.json --cutover-status-file config/production-cutover-status.example.json --json --quiet` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #135 as `a74dbeb` after CI and Dependency Review
  passed.
- Started `codex/release-operations-map` increment:
  - add a public-safe release operations map under `config/`;
  - add `npm run release:operations` to render the map as Markdown or JSON;
  - add `npm run check:release-operations` and include it in release checks;
  - update README, release docs, readiness docs, v0 plan, roadmap, changelog,
    smoke tests, and manager memory.
- Local validation for `codex/release-operations-map`:
  - `npm run release:operations -- -- --phase release-candidate` passed and
    rendered repo-compatible npm flag-forwarding examples;
  - `npm run release:operations -- -- --summary --json` passed;
  - `npm run check:release-operations` passed;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #136 as `cfd807d` after CI and Dependency Review
  passed. CodeRabbit added generated release notes to the PR body and did not
  create review threads before merge.
- Started `codex/operator-workspace-bootstrap` increment:
  - add `npm run operator:workspace` to create private release-gate,
    dogfood, security-review, production-cutover, and operator-evidence
    skeleton files in one operator-owned directory;
  - refuse public-repo output directories by default;
  - add operator evidence skeleton/write helpers;
  - update README, operations, release, readiness, v0 plan, roadmap,
    changelog, release operations map, smoke tests, and manager memory.
- Local validation for `codex/operator-workspace-bootstrap`:
  - `npm run operator:workspace -- -- --dir <temp-dir> --json` passed and
    created the expected six private workspace files outside the repo;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check:release-operations` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #137 as `00d4737` after CI and Dependency Review
  passed. CodeRabbit added generated release notes to the PR body and did not
  create review threads before merge.
- Started `codex/operator-workspace-check` increment:
  - add `--check` mode to `npm run operator:workspace` for validating all
    private workspace overlays together;
  - add `--require-ready` to fail final decisions when any overlay is pending,
    blocked, or missing current checklist ids;
  - update operator workspace docs, release docs, release operations map,
    smoke tests, and manager memory.
- Local validation for `codex/operator-workspace-check`:
  - `npm run operator:workspace -- -- --dir <temp-dir> --json` passed;
  - `npm run operator:workspace -- -- --dir <temp-dir> --check --json`
    passed;
  - `npm run operator:workspace -- -- --dir <temp-dir> --check --require-ready`
    failed as expected on pending release gates;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run check:release-operations` passed;
  - `npm run check` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #138 as `14f0015` after CI and Dependency Review
  passed. CodeRabbit added generated release notes to the PR body and did not
  create review threads before merge.
- Started `codex/release-candidate-workspace` increment:
  - add `--operator-workspace` to `npm run release:candidate`;
  - map standard private workspace files to release gates, operator evidence,
    dogfood status, security-review status, and production cutover status;
  - keep explicit per-file flags as overrides for unusual operator layouts;
  - update release-candidate docs, operator workspace docs, README, release
    readiness, release process, release operations map, smoke tests, and
    manager memory.
- Local validation for `codex/release-candidate-workspace`:
  - `npm run operator:workspace -- -- --dir <temp-dir> --quiet` passed;
  - `npm run release:candidate -- -- --operator-workspace <temp-dir> --json --quiet`
    passed;
  - `npm run release:candidate -- -- --operator-workspace <temp-dir> --require-ready --quiet`
    failed as expected on pending release gates;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #139 as `b215432` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/dogfood-readiness-workspace` increment:
  - add `--operator-workspace` to `npm run dogfood:readiness`;
  - include a redacted private operator workspace parse check in dogfood
    readiness reports;
  - keep normal pre-traffic readiness separate from evidence-complete
    expansion gates through `--require-operator-workspace-ready`;
  - update release operations map, dogfood docs, install/release docs, README,
    roadmap, changelog, smoke tests, release checks, and manager memory.
- Local validation for `codex/dogfood-readiness-workspace`:
  - `npm run operator:workspace -- -- --dir <temp-dir> --quiet` passed;
  - `npm run dogfood:readiness -- -- --operator-workspace <temp-dir> --json --quiet`
    passed;
  - `npm run dogfood:readiness -- -- --operator-workspace <temp-dir> --require-operator-workspace-ready --require-ready --quiet`
    failed as expected on pending release gates;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run check:release-operations` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #140 as `f0aaea9` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/checklist-runbook-links` increment:
  - add missing `docs/review-comment-format.md` for the public comment,
    hidden metadata, and budget-skip contract;
  - add `npm run check:checklist-runbooks` to validate runbook links in
    dogfood, security-review, and production-cutover JSON checklists;
  - include the new checker in `npm run release:check`;
  - update README, review-workflows, release docs, release-readiness, roadmap,
    changelog, and manager memory.
- Local validation for `codex/checklist-runbook-links`:
  - `npm run check:checklist-runbooks` passed with 85 links in 3 files;
  - `npm run check:docs` passed;
  - `npm run check` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #141 as `5f613fb` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/release-gate-evidence-links` increment:
  - strengthen `npm run check:release-gates` so v0 release gate evidence
    references must resolve to public repo paths or existing package scripts;
  - keep the existing gate-count parity check;
  - update release docs, release-readiness, roadmap, changelog, and manager
    memory.
- Local validation for `codex/release-gate-evidence-links`:
  - `npm run check:release-gates` passed with 19 gates and 19 evidence refs;
  - `npm run check:docs` passed;
  - `npm run check` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #142 as `4fa25c6` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/release-candidate-workspace-redaction` increment:
  - fix `npm run release:candidate -- -- --operator-workspace <dir>` bundle
    inputs so JSON and Markdown output redact private operator workspace paths;
  - preserve useful file names as `[operator-workspace]/<file>`;
  - update release-candidate docs, operator workspace docs, release docs,
    release-readiness, v0 release plan, release operations docs, README,
    changelog, roadmap, smoke tests, and manager memory;
  - document `npm --silent run` and `--out <public-file> --quiet` for public
    bundle capture from commands containing private paths.
- Local validation for `codex/release-candidate-workspace-redaction`:
  - direct Node `release:candidate --operator-workspace <temp-dir>` Markdown
    output did not contain the private workspace path;
  - direct Node `release:candidate --operator-workspace <temp-dir> --json`
    output did not contain the private workspace path;
  - `npm --silent run release:candidate -- -- --operator-workspace <temp-dir> --quiet`
    output did not contain the private workspace path;
  - `npm test` passed;
  - `npm run check:docs` passed;
  - `npm run release:check` passed.
- Merged `6529reviewbot` PR #143 as `59a8c2e` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/dogfood-readiness-silent-capture` increment:
  - document `npm --silent run dogfood:readiness` for public evidence capture
    from commands that contain private operator workspace paths;
  - add matching `bin/dogfood-readiness.cjs --help` examples;
  - update README, dogfood, operations, release-readiness, operator workspace,
    changelog, and manager memory;
  - initial leak check before edits showed direct Node output and
    `npm --silent run dogfood:readiness` output did not contain the private
    workspace path, while normal `npm run` echoed the command path before the
    script ran.
- Local validation for `codex/dogfood-readiness-silent-capture`:
  - direct Node `dogfood-readiness --operator-workspace <temp-dir>` Markdown
    output did not contain the private workspace path;
  - `npm --silent run dogfood:readiness -- -- --operator-workspace <temp-dir>`
    Markdown output did not contain the private workspace path;
  - `npm --silent run dogfood:readiness -- -- --operator-workspace <temp-dir> --json`
    JSON output did not contain the private workspace path;
  - normal `npm run dogfood:readiness -- -- --operator-workspace <temp-dir>`
    echoed the private path before script output, confirming the documented
    capture risk;
  - `npm test` passed;
  - `npm run check` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #144 as `a64c022` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/dogfood-target-packet` increment:
  - add `npm run dogfood:target` as a public-safe target-repository config PR
    packet/checker;
  - validate command-only and limited-initial dogfood posture before target
    repo PRs are opened or updated;
  - redact external config paths as `[external-config]/<file>`;
  - update package scripts, release checks, release operations map, README,
    dogfood/operations/release-readiness docs, roadmap, changelog, smoke
    tests, and manager memory.
- Local validation for `codex/dogfood-target-packet`:
  - `npm run dogfood:target` passed for command-only mode;
  - `npm run dogfood:target -- -- --mode limited-initial --require-ready`
    passed for limited-initial mode;
  - `npm run dogfood:target -- -- --mode auto --repository-config templates/dogfood-repository-config.yml --json`
    inferred limited-initial mode and reported ready;
  - smoke tests covered command-only, limited-initial, auto-inferred,
    mismatched mode, CLI parsing, external config path redaction, and missing
    external config file errors without private path leakage;
  - `npm test` passed;
  - `npm run check` passed;
  - `npm run check:docs` passed;
  - `npm run check:release-operations` passed with 33 tools;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #145 as `d0ad359` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/self-dogfood-config` increment:
  - add `.github/6529bot.yml` in command-only mode for the bot repository
    itself;
  - keep automatic initial and follow-up reviews disabled;
  - require trusted public-repo actors, draft skips, one Anthropic Opus lane,
    low max jobs per delivery, and enforced daily repo/requestor/PR/review-kind
    caps;
  - include the new config in `npm run check` and `npm run release:check`
    repository-config validation;
  - update README, dogfood docs, release-readiness, roadmap, changelog, and
    manager memory.
- Local validation for `codex/self-dogfood-config`:
  - `npm run dogfood:target -- -- --repository-config .github/6529bot.yml --mode command-only --require-ready`
    passed and reported command-only self-dogfood ready;
  - `npm run validate:repo-config -- .github/6529bot.yml` passed;
  - `npm test` passed;
  - `npm run check` passed;
  - `npm run check:docs` passed;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed and validated `.github/6529bot.yml`;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #146 as `4125cff` after CI and Dependency Review
  passed. CodeRabbit added a release-note summary and did not create review
  threads before merge.
- Started `codex/self-dogfood-replay-check` increment:
  - add synthetic public payload fixtures for a self-dogfood PR-open event and
    trusted maintainer `/6529bot security` comment command;
  - add `npm run check:self-dogfood-replay` to replay both payloads through
    the App pipeline in dry-run mode;
  - assert the PR-open event creates no jobs under the command-only config;
  - assert the trusted comment command admits one dry-run security job without
    dispatching workers;
  - include the check in `npm run release:check`, release operations map,
    README, dogfood, operations, release-readiness, release, roadmap,
    changelog, and manager memory.
- Local validation for `codex/self-dogfood-replay-check`:
  - `npm run check:self-dogfood-replay` passed;
  - replay check proved self-dogfood PR-open creates no jobs under the
    command-only config;
  - replay check proved trusted maintainer `/6529bot security` creates one
    dry-run Anthropic Opus security job without worker dispatch;
  - `npm test` passed;
  - `npm run check` passed;
  - `npm run check:docs` passed;
  - `npm run check:release-operations` passed with 34 tools;
  - `npm run check:public-artifacts` passed;
  - `npm run release:check` passed and ran the self-dogfood replay gate;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #147 as `cb95ec9` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/release-notes-contract-check` increment:
  - add `npm run check:release-notes`;
  - validate that the pre-v1 release notes template still includes required
    tested configuration, safety, known-gap, deferral, rollback, and validation
    fields;
  - make the checker whitespace-tolerant so Markdown prose can wrap naturally;
  - wire the check into `npm run release:check` and the release operations map;
  - update the release notes template, release process, release readiness,
    roadmap, README, changelog, and manager memory.
- Local validation for `codex/release-notes-contract-check`:
  - `npm run check:release-notes` passed;
  - `npm run check:release-operations` passed with 35 tools;
  - `npm run release:check` passed and ran the release notes template gate;
  - `git diff --check` passed.
- Merged `6529reviewbot` PR #148 as `be9b620` after CI and Dependency Review
  passed. CodeRabbit only had a processing placeholder and did not create
  review threads before merge.
- Started `codex/self-dogfood-command-matrix` increment:
  - extend `npm run check:self-dogfood-replay` from one comment-command case
    to an eight-case trusted maintainer command matrix;
  - generate per-command synthetic issue-comment payloads under ignored `tmp/`
    during the check and delete them afterwards;
  - keep the PR-open replay proving automatic jobs stay disabled under the
    self command-only config;
  - update dogfood, release-readiness, release, roadmap, changelog, and
    manager memory.
- Local validation for `codex/self-dogfood-command-matrix`:
  - `npm run check:self-dogfood-replay` passed for 8 command cases;
  - `npm run release:check` passed and ran the 8-case self-dogfood replay
    gate;
  - `git diff --check` passed.
