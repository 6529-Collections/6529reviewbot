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
