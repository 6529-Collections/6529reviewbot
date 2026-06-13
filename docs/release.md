# Release Process

This repository ships the central `6529bot` App/worker implementation and
keeps workflow scaffolds for dogfood and compatibility.

## Versioning

Before `v1`, downstream repositories and dogfood workflows should pin to a
reviewed commit SHA or explicit pre-release tag.

After stabilization:

- `v1` should be a moving major tag for compatible updates;
- minor/patch tags may be added for auditability;
- high-risk adopters may continue pinning exact SHAs.

## Release Checklist

- [Release readiness](release-readiness.md) reviewed
- [Release operations map](release-operations-map.md) reviewed when deciding
  which public check, private evidence overlay, or release-bundle command is
  next
- [v0 release plan](v0-release-plan.md) reviewed before any pre-v1 tag
- [Operator evidence template](operator-evidence-template.md) completed or
  linked from the private operator runbook
- [Operator workspace](operator-workspace.md) created or an equivalent private
  runbook location exists for release-gate, dogfood, security-review, cutover,
  and operator-evidence overlays
- `npm run operator:workspace -- -- --dir <private-workspace-dir> --check`
  reviewed before final release-candidate bundling
- `npm --silent run operator:drill -- -- --dir <private-workspace-dir>`
  reviewed as the public-safe operator drill before final release-candidate,
  dogfood promotion, or go-live `--require-ready` commands
- `npm run check:operator-drill` confirms the operator drill contract keeps
  temporary workspace cleanup, private path redaction, release-candidate,
  dogfood readiness, promotion, go-live summaries, production deployment plan
  handoff, next commands, and docs synchronized
- `npm run release:candidate -- -- --operator-workspace <private-workspace-dir>`
  reviewed as the public-safe workspace bundle
- `npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet`
  used when capturing public release-candidate output from private paths
- [Release candidate bundle](release-candidate.md) rendered from the private
  release-gate status and operator evidence files
- [Production cutover checklist](production-cutover.md) reviewed before live
  dogfood or production traffic
- `npm run operator:evidence -- -- --file <private-evidence-file> --summary`
  reviewed before copying deployment evidence into public release notes
- `npm run operator:evidence -- -- --file <private-evidence-file> --require-ready`
  passes before tagging unless release notes intentionally mark the release as
  dogfood-only or local-only
- `npm run check:operator-evidence` confirms the operator evidence contract
  stays synchronized with section readiness, required evidence, deferral
  semantics, public-summary redaction, and docs
- [GitHub App registration packet](github-app-registration.md) completed or
  explicitly deferred in the release notes
- `npm run v0:gates -- -- --init-status <operator-status-file>` used when
  starting a new release-candidate evidence pass
- `npm run v0:gates` rendered, or rendered with
  `--status-file <operator-status-file>`, with deferred gates documented
- `npm run v0:gates -- -- --status-file <operator-status-file> --summary`
  reviewed for the final complete/deferred/pending/blocked counts
- `npm run v0:gates -- -- --status-file <operator-status-file> --require-ready`
  passes before tagging; every current gate must be present in the status file,
  and deferred gates remain allowed only when release notes name the risk and
  follow-up owner
- `npm run check:v0-gates` confirms the v0 release gate contract stays
  synchronized with status readiness, missing-id checks, deferral semantics,
  public Markdown redaction, and docs
- release-gate status notes/evidence are public-safe before copying them into
  issues, PRs, release notes, or durable manager memory; the CLI redacts common
  secret-shaped values, but private evidence remains operator-owned
- structured operator evidence summaries are public-safe before copying them
  into issues, PRs, release notes, or durable manager memory
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight`
  reviewed as the public-safe release evidence bundle
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file> --strict-preflight`
  reviewed when the release decision also covers command-only or limited
  initial-review dogfood evidence
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file> --strict-preflight`
  reviewed when the release decision also covers manual security review
  evidence
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file> --strict-preflight`
  reviewed when the release decision also covers live dogfood or production
  traffic
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready`
  passes before tagging unless release notes intentionally mark the release as
  dogfood-only or local-only
- `npm run production:cutover -- -- --init-status <operator-cutover-status-file>`
  used when starting a new production cutover pass
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary`
  reviewed before enabling live dogfood traffic
- `npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready`
  passes before broad community traffic unless release notes intentionally mark
  the release as dogfood-only and name every cutover deferral
- `npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0 --require-ready`
  reviewed as the ordered dry-run handoff before live App, registry, runtime,
  cutover, or dogfood actions
- `npm run dogfood:target -- -- --repository-config <target-repo>/.github/6529bot.yml --mode auto --require-ready`
  passes before opening or updating the target repository config PR
- `npm run check:self-dogfood-replay`
  passes before using this repository as the first command-only dogfood target,
  including the trusted maintainer command matrix, deliberate multi-lane fanout,
  max-fanout rejection, and untrusted command denial
- `npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready`
  passes before first live dogfood traffic, using the operator-reviewed target
  repo config, budget policy, and private workspace when they differ from the
  public examples
- `npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready`
  passes as the final composed pre-traffic go/no-go packet before command-only
  live dogfood traffic
- `npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready`
  passes as the final cross-check that release-candidate, promotion,
  production-cutover, and operator-workspace evidence all agree before
  command-only live dogfood traffic
- `npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary`
  reviewed after command-only and limited initial-review dogfood runs
- `npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --require-ready`
  passes before expanding dogfood, unless release notes name every deferral
- `npm run admin:snapshot -- -- --base-url <production-bot-origin> --require-ok`
  passes from a private operator environment when validating the 6529.io admin
  surface; keep the detailed snapshot private unless release notes only copy
  public-safe counts
- `npm run release:check`
- `npm run check:6529-io-env` confirms the public-safe 6529.io dashboard env
  template still points only at reviewed usage/admin API contract paths
- `npm run check:env-templates` confirms public env examples have valid syntax,
  blank secret placeholders, and conservative dogfood defaults
- `npm run check:release-gates` confirms the machine-readable v0 gates match
  the numbered required-gates list and that evidence paths or commands resolve
- `npm run check:v0-gates` confirms the v0 release gate contract stays
  synchronized with status readiness, missing-id checks, deferral semantics,
  public Markdown redaction, and docs
- `npm run check:release-notes` confirms the pre-v1 release notes template
  still names required evidence, known gaps, deferrals, compatibility, and
  validation fields
- `npm run release:notes` drafts public-safe pre-v1 release notes from a
  release-candidate JSON bundle and model catalog defaults, with
  `TODO(operator)` markers for private evidence
- `npm run check:release-notes-draft` confirms the release notes draft command
  keeps release-candidate summaries, model defaults, redaction, TODO markers,
  CLI flags, and docs synchronized
- `npm run release:notes:check -- -- --file <release-notes.md>` checks
  completed pre-v1 release notes before publishing a tag or GitHub Release
- `npm run check:release-notes-publication` confirms the publication guard
  rejects unfinished TODO markers, missing evidence fields, incomplete
  deferrals, and public-safety leaks
- `npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready`
  builds the final dry-run tag plan from clean `main` and completed release
  notes; it does not create tags
- `npm run check:release-tag-plan` confirms the release tag plan stays dry-run
  and synchronized with the release operations map, smoke tests, and public docs
- `npm run check:release-operations` confirms the release operations map only
  references existing package scripts and public documentation paths
- `npm run check:install-guide` confirms the installation guide contract keeps
  the conservative dogfood path, GitHub App validation commands, runtime
  defaults, command-only target posture, and rollback controls synchronized
- `npm run check:deployment-runbook` confirms the deployment runbook contract
  keeps GitHub App registration, central runtime, worker, 6529.io wiring,
  verification, and rollback guidance synchronized
- `npm run check:configuration-reference` confirms the configuration reference
  keeps central App env, provider defaults, budget controls, worker dispatch,
  usage/admin APIs, admin auth, alerting, review limits, env templates, and
  source parser anchors synchronized
- `npm run check:aws-iam-templates` confirms AWS IAM/OIDC examples stay
  least-privilege, placeholder-only, scoped to the bot repository or protected
  environment, and linked from production cutover evidence
- `npm run check:security-model` confirms the security model and checklist
  stay synchronized with first-principles trust boundaries, prompt/path/
  metadata safety, fail-closed controls, diagnostic redaction, admin/AWS/alert
  boundaries, and source anchors
- `npm run check:operations-runbook` confirms the operations runbook contract
  keeps routine checks and triage paths for replay, spend, ledgers, workers,
  dashboards, and bot comments synchronized
- `npm run check:dependabot` confirms weekly npm and GitHub Actions dependency
  update coverage is still configured
- `npm run check:container-image` confirms the central App server Dockerfile
  and `.dockerignore` keep the image runtime-only, non-root, health-checked,
  and free of private repo artifacts
- `npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0 --require-ready`
  builds the dry-run build, push, digest capture, vulnerability scan, and
  private evidence plan before operator-owned registry work
- `npm run check:container-publish-plan` confirms the container publish plan
  stays dry-run and synchronized with release docs, smoke tests, and the
  release operations map
- `npm run check:comment-commands` confirms the public comment-command docs
  stay synchronized with the parser and review-kind constants
- `npm run check:review-workflows` confirms review-kind constants stay
  synchronized with worker bins, workflow dispatch choices, reusable workflow
  defaults, and workflow routing
- `npm run check:review-context-boundary` confirms review context path safety,
  trusted metadata handling, prompt hygiene, hard caps, and source-boundary
  docs stay synchronized
- `npm run check:review-bins` confirms review-kind prompt configs, bin
  entrypoints, package scripts, and review workflow docs stay synchronized
- `npm run check:review-comment-format` confirms generated PR comments,
  hidden markers, review labels, verdict lines, and budget-skip wording stay
  synchronized with the public comment-format docs
- `npm run check:admission-policy` confirms trusted-actor admission defaults,
  repo visibility modes, draft handling, trusted permission levels, public
  examples, and admission docs stay synchronized
- `npm run check:repository-config-boundary` confirms repository config remains
  a narrowing layer for lanes, max jobs, admission, budget caps, default cost,
  and base-ref loading
- `npm run check:worker-adapter-contract` confirms worker adapter modes,
  GitHub dispatch fields, local worker env, redacted diagnostics, workflow
  template inputs, and worker docs stay synchronized
- `npm run check:worker-capacity` confirms worker capacity and backpressure
  guidance keeps starting caps, scale-up rules, stuck-job triage, provider
  limits, alert evidence, and release blockers synchronized
- `npm run check:admin-auth` confirms private admin auth modes, shared-secret
  behavior, HMAC headers, TTL and role checks, 6529.io bridge docs, and public
  env templates stay synchronized
- `npm run check:usage-api-routes` confirms usage/admin API paths, server
  defaults, OpenAPI paths, 6529.io client methods, env templates, and docs stay
  synchronized
- `npm run check:admin-snapshot` confirms admin snapshot check names, default
  policy, warning posture, redaction behavior, CLI flags, and docs stay
  synchronized
- `npm run check:support-bundle` confirms sanitized support-bundle safe env
  keys, presence-only secret keys, local path redaction, CLI flags, and docs
  stay synchronized
- `npm run check:support-runbooks` confirms the support and incident playbooks
  keep public/private reporting boundaries, maintainer triage, containment,
  recovery, and public follow-up guidance synchronized
- `npm run check:diagnostics-redaction` confirms shared diagnostic redaction
  for tokens, alert webhooks, AWS access-key ids, private keys, error lines,
  and diagnostic tails
- `npm run check:model-defaults` confirms model-catalog defaults stay
  synchronized with reusable workflow fallbacks, provider-default docs, and
  conservative starter lanes
- `npm run check:model-pricing-runbook` confirms model pricing guidance keeps
  price-file shape, source-checked evidence, stale/zero overrides, apply
  behavior, and estimation semantics synchronized
- `npm run check:providers` confirms supported provider constants stay
  synchronized with model catalog providers, preflight key requirements,
  workflow dispatch choices, and provider docs
- `npm run check:provider-adapters` confirms Anthropic, OpenAI, and OpenRouter
  request shapes, option gating, usage normalization, error redaction, and docs
  stay synchronized
- `npm run check:ledger-privacy` confirms usage, job, and run-control ledger
  metadata normalization, usage API event visibility, schema omissions, and
  docs stay synchronized
- `npm run check:budget-scopes` confirms canonical budget scopes stay
  synchronized with central policy validation, ledger schema constraints,
  public docs, and dogfood examples
- `npm run check:budget-policies-runbook` confirms budget policies guidance
  keeps policy-file shape, dry-run/apply behavior, central DB caps, admission
  precedence, fail-closed policy reads, and review requirements synchronized
- `npm run check:run-control-scopes` confirms run-control concurrency scopes
  stay synchronized with budget scopes, env parsing, claim SQL, docs, and env
  examples
- `npm run check:alert-dimensions` confirms scheduled spend-spike alert
  dimensions stay synchronized across alert defaults, env parsing, docs, and
  env examples
- `npm run check:alert-notifier-modes` confirms scheduled alert delivery modes
  stay synchronized across notifier constants, env parsing, docs, and env
  examples
- `npm run check:alerting-runbook` confirms the scheduled alert runner keeps
  no-provider behavior, private delivery routing, dogfood evidence, payload
  privacy, and central-workflow posture synchronized
- `npm run check:checklist-runbooks` confirms dogfood, security-review, and
  production-cutover checklist runbooks point at existing public repo files
- `npm run check:docs` passes before publishing docs-heavy release notes
- `npm run check:public-artifacts` passes before publishing release notes or
  public operator evidence, including the tracked root `.env.example`
- `npm run release:notes:check -- -- --file <release-notes.md>` passes before
  publishing a GitHub Release or announcing a release tag
- `npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready`
  passes before creating the annotated tag
- `npm run check:preflight` passes against the synthetic central App server
  and worker fixtures
- `npm run check:preflight-contract` confirms the preflight check order,
  strict/profile behavior, CLI flags, redacted diagnostics, and docs stay
  synchronized
- `npm run check:webhook-replay` confirms saved webhook replay stays dry-run by
  default, explicit before dispatch, locally signed, payload-safe, and
  documented
- `npm run check:dogfood-target` confirms the dogfood target packet contract
  stays synchronized with mode inference, external config path markers,
  Markdown redaction, and docs
- `npm run check:dogfood-status` confirms the dogfood status contract stays
  synchronized with readiness, missing-id checks, deferral semantics, Markdown
  redaction, and docs
- `npm run check:dogfood-readiness` confirms the dogfood readiness report
  contract stays synchronized with static defaults, workspace path markers,
  preflight state, Markdown redaction, and docs
- `npm run check:dogfood-promotion` confirms the dogfood promotion packet
  contract stays synchronized with strict-preflight readiness, workspace path
  markers, Markdown redaction, and docs
- `npm run check:dogfood-go-live` confirms the dogfood go-live packet contract
  stays synchronized with strict-preflight readiness, workspace path markers,
  Markdown redaction, and docs
- `npm run check:operator-workspace` confirms the operator workspace contract
  stays synchronized with creation/check behavior, private path markers,
  Markdown redaction, and docs
- `npm run check:operator-evidence` confirms the operator evidence contract
  stays synchronized with section readiness, required evidence, deferral
  semantics, public-summary redaction, and docs
- `npm run check:production-cutover` confirms the production cutover contract
  stays synchronized with checklist/status readiness, deferral semantics,
  Markdown redaction, and docs
- `npm run check:security-review-status` confirms the security review status
  contract stays synchronized with readiness, deferral semantics, Markdown
  redaction, and docs
- `npm run check:release-candidate` confirms the public-safe
  release-candidate bundle contract stays synchronized with redaction,
  workspace path markers, CLI defaults, and docs
- `npm run github-app:manifest -- -- --host <production-bot-origin> --quiet`
- `npm run check:github-app-manifest` confirms the GitHub App manifest
  contract stays synchronized with target App permissions/events, the
  no-Actions-write boundary, private conversion behavior, redacted summaries,
  and docs
- `npm run check:github-app-auth` confirms the GitHub App auth contract stays
  synchronized with env parsing, JWT shape, installation-token caching, CLI
  profiles, GitHub Actions token output masking, source invariants, and docs
- `npm run check:github-app-routes` confirms the GitHub App route contract
  keeps browser handoff endpoints GET-only, public-safe, non-work-triggering,
  and free of echoed manifest codes or generated credentials
- `npm run github-app:convert -- -- --code <manifest-code> --output <private-json-path>`
  when using GitHub's manifest flow for the release App
- [Container deployment](container-deployment.md) reviewed when shipping the
  App server image; image digest, builder identity, and vulnerability scan are
  captured in private operator evidence
- [Container Publish Plan](container-publish-plan.md) run before operator-owned
  registry publish and vulnerability scan work
- `npm run check:workflow-actions`
- `npm run check:workflow-permissions`
- GitHub CI runs `npm run release:check` on the release PR
- `npm run validate:api-contract` if public or admin usage API contracts
  changed
- `npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>` when
  central budget rows changed, plus `--apply` from the operator environment
- `npm run model-prices -- -- --file <reviewed-model-price-file.json>` when
  provider/model price rows changed, plus `--apply` from the operator
  environment unless the release keeps conservative default estimates
- release notes name any accepted model-price `--allow-stale-source` or
  `--allow-zero-price` override and its operator evidence
- `npm run preflight -- -- --strict` in the release candidate environment
- [Worker capacity and backpressure](worker-capacity.md) reviewed for live
  worker releases
- docs updated
- pull request template security, cost, and contract questions answered
- workflow pins reviewed
- annotated GitHub Action tags pinned to their peeled commit SHA, not the
  tag-object SHA
- `actions/checkout` steps set `persist-credentials: false`
- reusable workflow caller-secret mapping reviewed when compatibility workflow
  changes
- security model reviewed for trust-boundary changes
- AWS/IAM changes documented
- AWS IAM/OIDC templates reviewed when AWS trust or permissions changed
- ledger schema changes captured in `npm run ledger:schema`, including
  additive table migrations, managed constraint refreshes, and managed view
  recreation behavior
- comment contract changes documented
- configuration changes documented
- alerting and admin-auth changes documented
- release-readiness checklist reviewed
- [Security review checklist](security-review-checklist.md) completed
- `npm run security:review -- -- --status-file <operator-security-status-file> --summary`
  reviewed for the candidate
- `npm run security:review -- -- --status-file <operator-security-status-file> --require-ready`
  passes before tagging unless release notes name every security deferral
- CodeRabbit or equivalent review feedback resolved
- CI, Dependency Review, and OpenSSF Scorecard reviewed
- OpenSSF Scorecard workflow-level permissions remain read-only; job-level
  write capability is limited to `id-token: write` for Scorecard result
  publishing

## Breaking Changes

Treat these as breaking:

- changing hidden metadata format;
- changing required provider config;
- changing AWS ledger schema without updating the schema CLI and migration docs;
- changing central budget policy file shape or DB admission loading;
- changing workflow permissions;
- changing default review fan-out;
- changing skip behavior;
- changing admin auth canonical signing payloads;
- changing alert payload shape or delivery guarantees.

## Pre-v1 Release Notes

Every pre-v1 release should say:

- whether it is safe only for dogfood or for broader community testing;
- which worker path is supported;
- which providers and model defaults were tested;
- which budget and admission defaults are recommended;
- which known production gaps remain.

Use [Release Notes Template](release-notes-template.md) as the starting point
for GitHub Releases.
Use [Release Tag Plan](release-tag-plan.md) after completed release notes pass
and before creating the annotated tag.
