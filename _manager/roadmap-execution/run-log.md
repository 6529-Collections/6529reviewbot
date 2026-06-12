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
