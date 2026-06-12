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
- Worker capacity and backpressure runbook for conservative live scaling.
- Reusable workflow secret contract now maps only explicit provider secrets
  instead of inheriting all caller secrets.
- Public/admin usage API contracts and read-only Aurora usage readers.
- Validated OpenAPI contract for 6529.io usage/admin API integration.
- Admin-only recent job-events API for queue and worker diagnostics.
- Admin-only runtime status API backed by no-network preflight checks.
- 6529.io admin auth bridge contract.
- Scheduled spend alerts for budget utilization and unusual spend spikes.
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
- Installed central review-job and dormant-by-default spend-alert workflows in
  the bot repository.
- v0 release gate renderer can merge an operator-owned status/evidence file.
- Run-control ledger claim, duplicate-denial, and completion-update path
  verified against the isolated dogfood ledger.
- Spend-alert read/evaluation path verified against the isolated dogfood
  ledger in dry-run mode.
- Operator evidence template for redacted release, dogfood, and production
  deployment proof.
- Dry-run-by-default budget policy CLI for reviewed central spend caps.
- Quiet budget policy validation mode for CI/release checks.
- Conservative dogfood budget policy example validated by release checks.
- Dry-run-by-default model pricing CLI for reviewed price-row updates.
- Example AWS IAM/OIDC templates for central GitHub Actions, Aurora Data API,
  Secrets Manager, and SNS access.
- Reviewable GitHub App manifest template for production `6529bot`
  registration.
- GitHub App manifest renderer for host-specific validation and local
  registration-form output.
- GitHub App manifest conversion CLI for one-time generated credentials with
  explicit private output and redacted summaries.
- GitHub App registration packet for operator roles, credential custody,
  post-registration checks, permission changes, rotation, and rollback.
- Pinned central worker and alert workflow template actions plus a
  release-check guard for step-level action refs.
- Production server loading of enabled central DB budget policy rows during
  admission.
- Usage-write cost estimation from active provider/model price rows.
- Provider setup guide for Anthropic, OpenAI, and OpenRouter.
- Sanitized support bundle CLI and support playbook.
- No-network production preflight CLI for runtime configuration validation.
- Incident response runbook for operator containment and recovery.
- Dogfood runbook, conservative dogfood templates, and repository config
  validation tooling.
- Comment-command contract documentation for maintainer-triggered reviews.
- Installation and onboarding guide for conservative central App dogfood.
- Production deployment runbook for GitHub App, worker, usage API, and 6529.io
  wiring.
- Release check script and manual security review checklist for dogfood and
  pre-v1 release gates.
- Machine-readable v0 release gates and checklist renderer.
- v0 release plan and release notes template for pre-v1 dogfood/community
  release discipline.
- Pull request and security-review templates for API contract, admin/privacy,
  runtime-control, budget, and release-validation review.
- Documentation for architecture, configuration, operations, release readiness,
  security model, AWS usage ledger, repository config, worker adapters, and
  alerting.
