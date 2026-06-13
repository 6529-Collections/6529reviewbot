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
- Release-candidate bundle CLI combines release-gate status, operator evidence,
  git metadata, and no-network preflight into one public-safe readiness
  summary.
- Production cutover CLI validates and renders a public-safe go/no-go checklist
  plus private status overlay before live dogfood traffic.
- Dogfood readiness CLI validates repository config, central budget policy,
  model catalog, and optional no-network preflight before first dogfood
  traffic.
- Dogfood execution status checklist and CLI for tracking command-only,
  limited initial-review, visibility, alert, and rollback evidence with a
  private operator status overlay.
- Security review status checklist and CLI for private manual-review evidence
  before dogfood expansion or public pre-v1 tags.
- Release-candidate bundles can optionally include production cutover status
  counts and enforce cutover readiness when a cutover status file is supplied.
- Release-candidate bundles can optionally include dogfood execution status
  counts and enforce dogfood readiness when a dogfood status file is supplied.
- Release-candidate bundles can optionally include security-review status
  counts and enforce security-review readiness when a security status file is
  supplied.
- Release operations map CLI and checker index recurring release commands and
  evidence boundaries, and fail release checks when mapped scripts or docs
  drift.
- Checklist runbook validation now fails release checks when public dogfood,
  security-review, or production-cutover checklist items point at missing
  runbook docs.
- Release-gate parity validation now also verifies that v0 gate evidence paths
  exist or that evidence commands reference package scripts.
- Review comment format documentation now covers the visible comment shape,
  hidden metadata marker, and budget-skip comment contract.
- Operator workspace bootstrap creates private release status and evidence
  skeletons in one operator-owned directory, with check mode for validating the
  workspace as a set and generated guidance for promotion/go-live packets.
- Release-candidate bundles can read standard private operator workspace files
  with one `--operator-workspace` flag.
- Release-candidate bundles redact private operator workspace paths in JSON and
  Markdown output, and docs now recommend `npm --silent run` or `--out --quiet`
  when capturing public bundles from private paths.
- Operator docs and the PR template now keep the dogfood go-live packet in the
  release, promotion, production cutover, and evidence-review path before live
  dogfood traffic.
- Added a canonical `docs/README.md` documentation index plus release and
  operations-map checks that fail when tracked docs are missing from the index.
- Added a public-governance release check for MIT license metadata, community
  files, issue templates, and root README governance links.
- Added a workflow-permissions release check for explicit least-privilege
  GitHub Actions permission blocks.
- Added a Dependabot release check for weekly npm and GitHub Actions dependency
  update coverage.
- Added a container-image release check for the central App server Dockerfile
  and `.dockerignore` runtime boundary.
- Strengthened the public-governance check to verify issue templates keep
  secret/private-data warnings, support-bundle guidance, disabled blank issues,
  and private security-report routing.
- Refreshed the public roadmap to distinguish completed bot implementation
  work from remaining operator-owned deployment and dogfood evidence.
- Release notes template validation keeps pre-v1 release notes explicit about
  tested configuration, dogfood promotion/go-live evidence, production cutover,
  deferrals, known gaps, compatibility, and validation.
- Dogfood readiness docs and CLI help now recommend `npm --silent run` when
  capturing public evidence from commands that include private workspace paths.
- Dogfood target packet CLI validates target-repo config PR posture before
  command-only or limited-initial dogfood rollout.
- Added a command-only `.github/6529bot.yml` config so this repository can be
  used as a first trusted-maintainer dogfood target after App installation.
- Added synthetic self-dogfood replay fixtures and check coverage for the
  command-only PR-open skip and trusted maintainer comment-command path.
- Self-dogfood replay now covers the trusted maintainer command-only command
  matrix before live delivery.
- Self-dogfood replay now proves untrusted public commands deny before budget
  or queue work.
- Dogfood readiness can include a redacted private operator workspace parse
  check before first live traffic, with an optional stricter evidence-ready
  mode for expansion gates.
- Dogfood promotion packet CLI composes target config readiness, central
  dogfood inputs, synthetic self-dogfood replay, private workspace parsing,
  and preflight into one final pre-traffic go/no-go report.
- Dogfood go-live packet CLI cross-checks release-candidate, promotion,
  production-cutover, and operator-workspace evidence before command-only live
  dogfood traffic, and `--require-ready` fails unless strict preflight is
  included.
- v0 release gates now require the dogfood promotion packet before first live
  dogfood traffic.
- Production cutover checklist now requires the dogfood promotion packet before
  first live dogfood traffic.
- npm script examples now use the repo-compatible
  `npm run <script> -- -- --flag` form when passing CLI options.
- Public artifact leak scanning now includes the tracked root `.env.example`.
- Documentation link checks and public artifact scanning now include
  non-ignored untracked files during local runs, so new docs/config examples
  are checked before staging.
- Env template validation now checks public env examples for duplicate or
  malformed keys, nonblank secret placeholders, and conservative dogfood
  defaults before release.
- GitHub Actions worker dispatch supports `auto`, native API, and `gh`
  compatibility modes, with API mode failing closed when the dispatch token is
  missing.
- Worker diagnostics redact common bearer, GitHub, provider API key, alert
  webhook URL, AWS access-key id, and private-key shapes before optional output
  tails or GitHub API dispatch failures are returned.
- Review runner provider error summaries and fatal CLI output use the shared
  diagnostic redaction path.
- Utility CLI fatal errors now use the shared diagnostic redaction path, and
  validator path prefixes redact common secret shapes.
- GitHub App manifest conversion error bodies and summary strings redact
  common secret shapes before operator-facing output.
- Support bundle git branch/status output redacts common secret shapes before
  JSON or Markdown support output is generated.
- Support bundle selected safe environment values and preflight messages are
  defensively redacted before support output is generated.
- Release-gate status notes and evidence redact common secret shapes before
  JSON or Markdown output.
- Operator-maintained model-price and budget-policy notes redact common secret
  shapes and are capped before dry-run SQL output or DB apply.
- Public artifact scanning now flags common local private paths, and GitHub App
  conversion examples use placeholders instead of concrete private paths.
- App server dispatch exception diagnostics are redacted before they are
  written to run-claim metadata or job-event reasons.
- Ledger, preflight, alert, and worker lifecycle diagnostic helpers use the
  shared redaction path, and job/run-claim metadata string fields redact common
  secret shapes before persistence.
- Admin usage API job-event, runtime-status, and unavailable responses now
  sanitize custom loader diagnostics before returning JSON to 6529.io.
- Scheduled alert payloads now redact common secret-shaped strings and unsafe
  custom keys before dry-run, stdout, webhook, or SNS output.
- Scheduled operator alerts support SES email delivery through the same
  sanitized payload boundary used by stdout, webhook, and SNS.
- Repository config load reasons are bounded and redacted before webhook or
  admin summaries expose invalid or unavailable config diagnostics.
- Live provider calls fail closed when the provider returns empty visible
  review text instead of posting a generic no-finding comment.
- The production server can mint a short-lived GitHub App installation token
  for central workflow dispatch when `REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID`
  is configured.
- Worker-dispatch preflight now fails partial `REVIEWBOT_WORKER_GITHUB_APP_*`
  credential overrides and warns when dispatch reuses the main GitHub App
  credentials instead of a dispatch-only App.
- Worker capacity and backpressure runbook for conservative live scaling.
- Reusable workflow secret contract now maps only explicit provider secrets
  instead of inheriting all caller secrets.
- Public/admin usage API contracts and read-only Aurora usage readers.
- Public usage summaries now enforce repo/org allowlists before showing repo
  names, even when custom loaders provide non-private public repo events.
- Validated OpenAPI contract for 6529.io usage/admin API integration.
- Public-safe 6529.io dashboard environment template with release-check
  validation against the OpenAPI contract.
- Admin-only recent usage-events API for private raw usage diagnostics.
- Admin-only budget-status API for current daily, weekly, and monthly budget
  utilization diagnostics.
- Admin-only model-price status API for active price rows, token-class rate
  coverage, and source-evidence freshness without exposing operator notes.
- Admin-only alert-status API for alert thresholds, schedule caps, and
  notifier posture without exposing delivery secrets.
- Structured operator evidence validation and redacted public-summary rendering
  for production readiness proof.
- Admin-only recent job-events API for queue and worker diagnostics.
- Admin-only recent run-claims API for stale active claim triage.
- Admin-only runtime status API backed by no-network preflight checks.
- 6529.io admin auth bridge contract.
- Admin auth bridge required-role configuration is validated before the bridge
  accepts signed 6529.io admin assertions.
- Server-side 6529.io usage API client helper for signed admin requests,
  endpoint path building, timeouts, and redacted API failures.
- Admin snapshot CLI for private dashboard bring-up and release evidence
  without dumping raw usage rows or private scope values.
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
