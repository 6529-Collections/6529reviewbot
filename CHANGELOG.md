# Changelog

All notable changes to this project will be documented here.

This project follows a lightweight changelog format inspired by Keep a
Changelog. Versioning will become formal once the reusable workflow API is
stabilized.

## Unreleased

- Initial public MIT repository structure, governance, security, support, and
  contribution docs.
- Standalone review engine for general, follow-up, WCAG 2.2 AA, i18n, and
  crypto/security review modes.
- Provider configuration for Anthropic, OpenAI, and OpenRouter.
- Validated model catalog for provider defaults and model-update workflow.
- GitHub App webhook skeleton with signature verification and normalized PR
  and comment-command events.
- GitHub App installation-token handling for repository config reads and actor
  permission resolution.
- Timeout handling and fail-closed hardening for GitHub App API calls.
- Short-lived GitHub App installation-token minting for central worker jobs.
- Trusted-actor admission for public repositories.
- Budget admission against the isolated AWS usage ledger.
- Production server wiring for budget spend snapshots from the usage ledger.
- Review job fanout across review kinds and provider/model lanes.
- Central runtime pause controls for global, org, repo, provider, model, and
  review-kind stops before budget or worker dispatch.
- Run-control contract and Aurora-backed claimer for duplicate delivery claims
  and concurrency caps.
- Run-control claim status updates after dispatch attempts and worker
  completion.
- Durable job lifecycle ledger for budget and dispatch audit events.
- Base-ref repository config loading and restrictive policy merge.
- Local and central GitHub Actions worker adapters.
- Production server entrypoint now wires the configured worker adapter instead
  of falling back to the generic no-queue handler.
- Container packaging for the central App server with a non-root runtime,
  `/healthz` health check, native GitHub Actions API dispatch support, and
  runtime-only secret injection guidance.
- v0 release gate status files now fail the final `--require-ready` check when
  private evidence omits any current public release gate.
- Public artifact leak scanning now includes the tracked root `.env.example`.
- GitHub Actions worker dispatch supports `auto`, native API, and `gh`
  compatibility modes, with API mode failing closed when the dispatch token is
  missing.
- Worker diagnostics redact common bearer, GitHub, provider API key, and
  private-key shapes before optional output tails or GitHub API dispatch
  failures are returned.
- Review runner provider error summaries and fatal CLI output use the shared
  diagnostic redaction path.
- App server dispatch exception diagnostics are redacted before they are
  written to run-claim metadata or job-event reasons.
- Ledger, preflight, alert, and worker lifecycle diagnostic helpers use the
  shared redaction path, and job/run-claim metadata string fields redact common
  secret shapes before persistence.
- Repository config load reasons are bounded and redacted before webhook or
  admin summaries expose invalid or unavailable config diagnostics.
- Live provider calls fail closed when the provider returns empty visible
  review text instead of posting a generic no-finding comment.
- The production server can mint a short-lived GitHub App installation token
  for central workflow dispatch when `REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID`
  is configured.
- Worker capacity and backpressure runbook for conservative live scaling.
- Reusable workflow secret contract now maps only explicit provider secrets
  instead of inheriting all caller secrets.
- Public/admin usage API contracts and read-only Aurora usage readers.
- Validated OpenAPI contract for 6529.io usage/admin API integration.
- Admin-only recent job-events API for queue and worker diagnostics.
- Admin-only runtime status API backed by no-network preflight checks.
- 6529.io admin auth bridge contract.
- Admin auth bridge required-role configuration is validated before the bridge
  accepts signed 6529.io admin assertions.
- Scheduled operator alerts for budget utilization, unusual spend spikes,
  failed jobs, and stale run-control claims.
- Dry-run webhook replay CLI for GitHub delivery, admission, budget, and job
  fanout diagnostics.
- Dry-run-by-default ledger schema CLI for Aurora setup and repair.
- Ledger schema re-apply recreates bot-managed daily aggregate views before
  view definition updates.
- Ledger schema re-apply adds missing managed columns for older dogfood
  databases.
- Ledger schema re-apply refreshes the managed budget-scope check constraint
  for older dogfood databases.
- Conservative dogfood budget policy apply path verified against the isolated
  ledger with aggregate scope-count checks.
- Installed central review-job and dormant-by-default operator-alert workflows
  in the bot repository.
- CI now runs the full release check on pull requests and pushes to `main`.
- OpenSSF Scorecard write permissions are scoped to the Scorecard job instead
  of the workflow level.
- OpenSSF Scorecard result publishing now avoids the optional SARIF upload step
  until that verifier path accepts the pinned upload action cleanly.
- `actions/checkout` pins now use the peeled `v6.0.3` commit SHA instead of
  the annotated tag object SHA.
- v0 release gate renderer can merge an operator-owned status/evidence file.
- Release checks validate that machine-readable v0 gates match the numbered
  required-gates list in the release plan.
- Run-control ledger claim, duplicate-denial, and completion-update path
  verified against the isolated dogfood ledger.
- Spend-alert read/evaluation path verified against the isolated dogfood
  ledger in dry-run mode.
- Job-health alert evaluation for failed jobs and stale active run-control
  claims.
- Operator evidence template for redacted release, dogfood, and production
  deployment proof.
- Dry-run-by-default budget policy CLI for reviewed central spend caps.
- Quiet budget policy validation mode for CI/release checks.
- Conservative dogfood budget policy example validated by release checks.
- Dry-run-by-default model pricing CLI for reviewed price-row updates.
- Model pricing rows now carry a required source-checked timestamp for
  auditable operator price verification.
- Model price apply and preflight can reject stale or future-dated
  source-checked timestamps before cost estimates rely on bad provider pricing
  evidence.
- Model price apply rejects zero-rate placeholder rows unless explicitly
  allowed for documented free prices.
- Example AWS IAM/OIDC templates for central GitHub Actions, Aurora Data API,
  Secrets Manager, and SNS access.
- Reviewable GitHub App manifest template for production `6529bot`
  registration.
- GitHub App manifest renderer for host-specific validation and local
  registration-form output.
- GitHub App manifest conversion CLI for one-time generated credentials with
  explicit private output and redacted summaries.
- Public-safe GitHub App registration/setup/callback guidance routes that do
  not echo manifest codes or generated credentials.
- GitHub App registration packet for operator roles, credential custody,
  post-registration checks, permission changes, rotation, and rollback.
- Pinned central worker and alert workflow template actions plus a
  release-check guard for step-level action refs.
- Production server loading of enabled central DB budget policy rows during
  admission.
- Usage-write cost estimation from active provider/model price rows.
- Provider setup guide for Anthropic, OpenAI, and OpenRouter.
- Sanitized support bundle CLI and support playbook.
- Support bundles report central worker repository names only as presence and
  redact absolute local config paths.
- No-network production preflight CLI for runtime configuration validation.
- Release checks now run no-network preflight fixtures for central App server
  and worker configuration postures.
- Incident response runbook for operator containment and recovery.
- Dogfood runbook, conservative dogfood templates, and repository config
  validation tooling.
- Comment-command contract documentation for maintainer-triggered reviews.
- Installation and onboarding guide for conservative central App dogfood.
- Production deployment runbook for GitHub App, worker, usage API, and 6529.io
  wiring.
- Release check script and manual security review checklist for dogfood and
  pre-v1 release gates.
- Documentation link check for local Markdown links.
- Public artifact leak scan for docs, examples, workflows, and durable manager
  memory.
- Machine-readable v0 release gates and checklist renderer.
- v0 release gate readiness summaries and `--require-ready` tag/no-tag checks.
- v0 release gate status bootstrap for operator-owned release evidence files.
- v0 release plan and release notes template for pre-v1 dogfood/community
  release discipline.
- Pull request and security-review templates for API contract, admin/privacy,
  runtime-control, budget, and release-validation review.
- Documentation for architecture, configuration, operations, release readiness,
  security model, AWS usage ledger, repository config, worker adapters, and
  alerting.
