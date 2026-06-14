# Changelog

All notable changes to this project will be documented here.

This project follows a lightweight changelog format inspired by Keep a
Changelog. Versioning will become formal once the reusable workflow API is
stabilized.

## Unreleased

- Aligned production deployment, dashboard deployment, and alert delivery CLI
  help examples with placeholder-safe `--require-ready` inputs.
- Rejected documentation, example, local, or reserved hosts from GitHub App
  manifest rendering.
- Rejected documentation, example, local, or reserved container registries from
  final container publish and production deployment ready gates.
- Rejected documentation, example, local, or reserved origin hosts from final
  production deployment, dashboard deployment, and alert delivery ready gates.
- Rejected placeholder model price source URL hosts before applying pricing
  rows to the ledger.
- Required model price source URLs to use HTTPS before pricing evidence can be
  applied or used for catalog coverage.
- Hardened release notes publication to reject Git-ref-unsafe title versions
  before tag or GitHub Release text can be published.
- Hardened release tag planning to reject Git-ref-unsafe tag names before
  rendering tag commands.
- Made `release:tag-plan --require-ready` promote release-note recommendation
  warnings to blockers before final tag planning.
- Expanded release notes publication recommendation warnings for base-ref target
  config and operator-owned alert routing safety language.
- Added run-control enforcement to release notes publication recommendation
  warnings.
- Hardened release notes publication checks for accepted model-price override
  disclosure.
- Strengthened the model pricing runbook contract to pin catalog coverage
  section ordering and guidance.
- Aligned release evidence, deployment, and cutover dogfood gate commands with
  reviewed model price file coverage.
- Added reviewed model price file flags to generated operator drill and
  workspace dogfood gate commands.
- Added optional model price coverage to dogfood go-live packets.
- Added optional model price coverage to dogfood promotion packets.
- Added optional model price coverage to the dogfood readiness report.
- Added the model price catalog coverage audit to generated operator
  workspace guidance.
- Added a model price catalog coverage audit so operator-owned price files can
  be checked against configured default lanes before relying on estimates.
- Added production deployment, dashboard deployment, and alert delivery
  `--require-ready` dry-run plans to the release check.
- Added `dogfood:readiness --require-ready` to the release check so the
  release gate exercises the ready-mode dogfood readiness CLI path.
- Pinned image repository contracts to reject tag-like colons inside
  repository path segments before rendering commands.
- Hardened image repository planning to allow numeric registry ports while
  rejecting non-numeric registry port inputs before rendering commands.
- Shared container and production image repository validation to keep dry-run
  command guards consistent across operator handoff paths.
- Hardened container and production image repository planning to reject
  uppercase repository characters before rendering commands.
- Hardened container and production image repository planning to reject empty
  path segments before rendering Docker or operator handoff commands.
- Hardened the production deployment plan to reject image repository inputs
  with URL schemes before rendering operator handoff commands.
- Hardened the container publish plan to reject image repository inputs with
  URL schemes before rendering Docker commands.
- Hardened the release tag plan to reject locally existing release tags before
  rendering ready tag commands.
- Hardened the release tag plan to reject completed release notes whose title
  version does not match the planned tag.
- Aligned the release operations map with the stricter release-notes validation
  evidence publication guard.
- Hardened release notes publication checks to reject vague validation fields
  that do not report passed, ready, reviewed, or accepted evidence.
- Hardened release notes publication checks to reject failed, pending,
  blocked, not-ready, or negated readiness validation evidence unless
  explicitly accepted.
- Aligned reusable workflow public-repo alert guidance with the reviewed alert
  delivery plan evidence requirement.
- Aligned release-note safety language with the reviewed alert delivery plan
  evidence requirement.
- Made the admin auth HMAC TTL contract check deterministic on CI runners.
- Required reviewed alert delivery plan evidence for the v0 scheduled alerts
  release gate.
- Added alert delivery plan fields to the operator evidence template.
- Added alert delivery-plan evidence to production cutover before scheduled
  alert delivery can be marked ready.
- Added alert delivery plan evidence to release notes draft, template, and
  publication checks.
- Added alert delivery plan guidance to generated operator workspaces and
  operator drill next commands.
- Added an alert delivery plan command and contract check for dry-run
  production alert routing handoff across webhook/SNS/SES mode, private
  channel evidence, alert dry-run/status checks, cutover evidence, and release
  notes.
- Strengthened the v0 gate and production cutover contract checks to pin
  dashboard deployment-plan evidence targets and ordering.
- Added dashboard deployment-plan evidence to v0 dashboard gates and production
  cutover before public/private 6529.io dashboard exposure.
- Added the dashboard deployment plan handoff to operator drill next commands.
- Added dashboard deployment plan guidance to generated operator workspaces.
- Added dashboard deployment plan evidence to release notes draft, template,
  and publication checks.
- Added a dashboard deployment plan guard and contract check for dry-run
  6529.io dashboard handoff across frontend env, bot public disclosure, HMAC
  admin auth, route verification, cutover evidence, and release notes.
- Recorded the merged 6529.io public usage and private admin dashboard PRs in
  release roadmap docs.
- Added production deployment plan evidence to release notes draft, template,
  and publication checks.
- Added the production deployment plan handoff to operator drill next commands.
- Added production deployment plan guidance to generated operator workspaces.
- Added a production deployment plan guard and contract check for dry-run
  operator handoff across GitHub App registration, container publish,
  operator workspace, preflight, admin snapshot, cutover, and dogfood gates.
- Added a container publish plan guard and contract check for dry-run
  build/push/scan/evidence commands before operator-owned registry work.
- Added a release tag plan guard and contract check for clean-main,
  completed-notes, dry-run tag planning before operator-created releases.
- Added a release notes publication guard and contract check for completed
  release notes before pre-v1 tags or GitHub Releases.
- Strengthened the synthetic self-dogfood replay gate to prove deliberate
  multi-lane review fanout, distinct run keys, and max-fanout rejection before
  dogfood traffic.
- Added a release notes draft command and contract check for public-safe pre-v1
  release notes generated from release-candidate evidence and model catalog
  defaults.
- Added a manager memory contract check so active context, run-log state,
  release checks, smoke tests, and public docs stay synchronized during the
  autonomous release workstream.
- Added an operator drill command and contract check for public-safe rehearsal
  of release-candidate, dogfood readiness, promotion, and go-live summaries.
- Added a security model contract release check for first-principles trust
  boundaries, manual checklist coverage, workflow secret mapping, fail-closed
  controls, and implementation anchors.
- Added an AWS IAM/OIDC template contract release check for least-privilege
  placeholder examples, exact allowed actions, and production cutover links.
- Added a configuration reference contract release check for runtime env docs,
  env templates, deployment guidance, and source parser anchors.
- Added a budget policies runbook contract release check for central DB caps,
  dry-run/apply behavior, fail-closed admission precedence, and review
  requirements.
- Added a model pricing runbook contract release check for source-checked price
  evidence, stale/zero-price overrides, apply behavior, and estimation
  semantics.
- Added an alerting runbook contract release check for scheduled alert runner
  posture, private notification routing, dogfood evidence, and alert payload
  privacy.
- Added a worker capacity contract release check for starting caps, scale-up
  rules, backpressure controls, stuck-job triage, provider limits, alert
  evidence, and release blockers.
- Added a support runbooks contract release check for public support,
  maintainer triage, incident containment, recovery, and sanitized public
  follow-up guidance.
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
- v0 release gate contract checker verifies status readiness, missing-id
  handling, complete-gate evidence requirements, deferral semantics, public
  Markdown redaction, source invariants, and docs.
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
  drift or when the operations-map doc omits a local quality command.
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
- Operator evidence contract checker verifies section readiness semantics,
  complete-section evidence requirements, deferred/blocked notes, public
  summary redaction, source invariants, and docs.
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
- Added a comment-command release check that validates the public trigger docs
  against the parser and review-kind constants.
- Added a review-workflow kind release check that validates review-kind
  constants against worker bins, central workflow dispatch options, reusable
  workflow defaults, and workflow routing.
- Added a review-context boundary release check that validates path safety,
  trusted metadata handling, prompt hygiene, hard caps, and source-boundary
  docs.
- Added a review-bin entrypoint release check that validates review-kind prompt
  configs, CLI entrypoints, package scripts, and review workflow docs.
- Added a review-comment format release check that validates generated PR
  comment headings, hidden markers, review labels, verdict lines, and
  budget-skip wording against the public comment-format docs.
- Added an admission-policy release check that validates trusted-actor
  defaults, repo visibility modes, draft handling, trusted permission levels,
  public examples, and admission docs.
- Added a repository-config boundary release check that validates target repo
  config remains a narrowing layer for lanes, max jobs, admission, budget caps,
  default cost, and base-ref loading.
- Added a worker-adapter contract release check that validates worker modes,
  dispatch fields, local worker env, diagnostic redaction, workflow template
  inputs, and worker docs.
- Added an admin-auth contract release check that validates private admin auth
  modes, shared-secret behavior, HMAC headers, TTL and role checks, 6529.io
  bridge docs, and public env templates.
- Added a usage-api route contract release check that validates usage/admin API
  paths, server defaults, OpenAPI paths, 6529.io client methods, env templates,
  and docs.
- Added an admin-snapshot contract release check that validates private
  operator snapshot names, default policy, warning posture, redaction behavior,
  CLI flags, and docs.
- Added a support-bundle contract release check that validates safe env keys,
  presence-only secret keys, local path redaction, CLI flags, and docs.
- Added a diagnostics-redaction contract release check that validates shared
  token, alert webhook, AWS access-key id, private-key, error-line, and
  diagnostic-tail redaction behavior.
- Added a preflight contract release check that validates no-network preflight
  check order, strict/profile behavior, CLI flags, redacted diagnostics, and
  docs.
- Added a webhook-replay contract release check that validates dry-run default
  behavior, explicit dispatch, local payload signing, raw-payload omission, and
  docs.
- Added a dogfood target contract release check that validates target packet
  modes, external config path markers, Markdown redaction, source invariants,
  and docs.
- Added a dogfood-status contract release check that validates dogfood status
  readiness, missing-id checks, deferral semantics, Markdown redaction, source
  invariants, and docs.
- Added a dogfood readiness contract release check that validates static input
  defaults, private workspace path markers, preflight state, Markdown
  redaction, source invariants, and docs.
- Added a dogfood promotion contract release check that validates strict
  preflight readiness, private workspace path markers, Markdown redaction,
  source invariants, and docs.
- Added a dogfood go-live contract release check that validates strict
  preflight readiness, private workspace path markers, Markdown redaction,
  source invariants, and docs.
- Added an operator-workspace contract release check that validates workspace
  creation, check-mode readiness failures, private path markers, Markdown
  redaction, source invariants, and docs.
- Added a production-cutover contract release check that validates checklist
  and status readiness, deferral semantics, Markdown redaction, source
  invariants, and docs.
- Added a security-review-status contract release check that validates manual
  review status readiness, deferral semantics, Markdown redaction, source
  invariants, and docs.
- Added a release-candidate contract release check that validates public bundle
  redaction, private workspace path markers, CLI defaults, source invariants,
  and docs.
- Added a GitHub App auth contract release check that validates env parsing,
  JWT shape, installation-token caching, CLI profiles, GitHub Actions token
  output masking, source invariants, and docs.
- Added a GitHub App browser handoff route contract release check that
  validates setup, callback, and manifest-complete routes stay GET-only,
  public-safe, non-work-triggering, and free of echoed codes or credentials.
- Added an installation guide contract release check that validates the
  conservative dogfood onboarding path, GitHub App validation commands,
  runtime defaults, command-only target posture, and rollback controls.
- Added a deployment runbook contract release check that validates production
  GitHub App registration, central runtime, worker, 6529.io wiring,
  verification, and rollback guidance.
- Added an operations runbook contract release check that validates routine
  checks and triage paths for replay, spend, ledgers, workers, dashboards, and
  bot comments.
- Added a model-default release check that validates model-catalog defaults
  against reusable workflow fallbacks, provider-default docs, and conservative
  starter lanes.
- Added a provider-contract release check that validates supported provider
  constants against model catalog providers, preflight key requirements,
  workflow dispatch options, and provider docs.
- Added a provider-adapter release check that validates Anthropic, OpenAI, and
  OpenRouter request shapes, option gating, usage normalization, error
  redaction, and docs.
- Added shared ledger metadata normalization plus a ledger-privacy release
  check for usage, job, and run-control metadata, usage API event visibility,
  schema omissions, and docs.
- Added a budget-scope release check that validates canonical budget scopes
  across central policy validation, ledger schema constraints, public docs, and
  dogfood examples.
- Added a run-control scope release check that validates concurrency scopes
  against budget scopes, env parsing, claim SQL, docs, and env examples.
- Added an alert-dimension release check that validates scheduled spend-spike
  dimensions across alert defaults, env parsing, docs, and env examples.
- Added an alert notifier mode release check that validates scheduled delivery
  modes across notifier constants, env parsing, docs, and env examples.
- Updated the v0 release gate and release notes contract to require explicit
  container-image contract-check evidence when an App server image is used.
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
- `npm run check:workflow-actions` now requires `actions/checkout` steps to
  set `persist-credentials: false`; CI and Dependency Review now do so.
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
- GitHub App manifest contract checker verifies target App permissions/events,
  no Actions write permission, registration form rendering, private manifest
  conversion behavior, redacted summaries, source invariants, and docs.
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
