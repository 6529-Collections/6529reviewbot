# Release Operations Map

The release operations map is the quick index for the public checks, private
operator evidence overlays, and release-candidate commands used by
`6529reviewbot`.

Use it when deciding what to run next:

```bash
npm run release:operations
npm run release:operations -- -- --phase release-candidate
npm run release:operations -- -- --summary --json
```

The source of truth is
[config/release-operations-map.json](../config/release-operations-map.json).
`npm run check:release-operations` validates that every mapped command exists
in `package.json` and that every linked document is present. The check is
included in `npm run release:check`.
The canonical documentation index is [Docs Index](README.md), and
`npm run check:doc-index` fails release checks when a public docs page is not
linked there.
`npm run check:governance` keeps the public MIT license, community files, issue
templates, and README governance links present.
`npm run check:install-guide` keeps the conservative central App dogfood
installation path, GitHub App validation commands, runtime defaults,
command-only target posture, and rollback controls synchronized.
`npm run check:deployment-runbook` keeps the production deployment runbook's
GitHub App registration, central runtime, worker, 6529.io wiring,
verification, and rollback guidance synchronized.
`npm run check:configuration-reference` keeps the configuration reference
aligned across central App env, provider defaults, budget controls, worker
dispatch, usage/admin APIs, admin auth, alerting, review limits, env templates,
and source parser anchors.
`npm run check:aws-iam-templates` keeps AWS IAM/OIDC examples least-privilege,
placeholder-only, scoped to the bot repository or protected environment, and
linked from production cutover evidence.
`npm run check:security-model` keeps the security model and checklist aligned
with first-principles trust boundaries, prompt/path/metadata safety,
fail-closed controls, diagnostic redaction, admin/AWS/alert boundaries, and
source anchors.
`npm run check:operations-runbook` keeps the operations runbook's routine
checks and triage paths for replay, spend, ledgers, workers, dashboards, and
bot comments synchronized.
`npm run check:dependabot` keeps weekly npm and GitHub Actions dependency
update coverage present.
`npm run check:workflow-permissions` keeps committed workflow and template
permission blocks explicit and least-privilege.
`npm run check:review-workflows` keeps review-kind constants, worker bins,
workflow dispatch choices, reusable defaults, and workflow routing aligned.
`npm run check:review-context-boundary` keeps review context path safety,
trusted metadata handling, prompt hygiene, hard caps, and source-boundary docs
aligned.
`npm run check:review-bins` keeps review-kind prompt configs, bin
entrypoints, package scripts, and review workflow docs aligned.
`npm run check:review-comment-format` keeps generated public comment headings,
verdict lines, hidden markers, review labels, and budget-skip wording aligned
with the documented PR comment contract.
`npm run check:admission-policy` keeps trusted-actor admission defaults, repo
visibility modes, draft handling, trusted permission levels, public examples,
and admission docs aligned.
`npm run check:repository-config-boundary` keeps repository configuration a
narrowing layer for lanes, max jobs, admission, budget caps, default cost, and
base-ref loading.
`npm run check:worker-adapter-contract` keeps worker adapter modes, GitHub
dispatch fields, local worker environment, redacted diagnostics, the workflow
template, and worker docs aligned.
`npm run check:worker-capacity` keeps worker capacity and backpressure
guidance aligned across starting caps, scale-up rules, stuck-job triage,
provider limits, alert evidence, and release blockers.
`npm run check:admin-auth` keeps private admin auth modes, shared-secret
behavior, HMAC headers, TTL and role checks, 6529.io bridge docs, and public
env templates aligned.
`npm run check:usage-api-routes` keeps usage/admin API paths, server defaults,
OpenAPI paths, 6529.io client methods, env templates, and docs aligned.
`npm run check:admin-snapshot` keeps admin snapshot check names, default
policy, warning posture, redaction behavior, CLI flags, and docs aligned.
`npm run check:support-bundle` keeps sanitized support-bundle safe env keys,
presence-only secret keys, local path redaction, CLI flags, and docs aligned.
`npm run check:support-runbooks` keeps the support and incident playbooks'
public/private reporting boundaries, maintainer triage, containment, recovery,
and public follow-up guidance aligned.
`npm run check:diagnostics-redaction` keeps shared diagnostic redaction for
tokens, alert webhooks, AWS access-key ids, private keys, error lines, and
diagnostic tails aligned.
`npm run check:model-defaults` keeps model-catalog defaults, reusable workflow
fallbacks, provider-default docs, and conservative starter lanes aligned.
`npm run check:model-pricing-runbook` keeps model pricing guidance aligned
across price-file shape, source-checked evidence, stale/zero overrides, apply
behavior, and estimation semantics.
`npm run check:providers` keeps supported provider constants, preflight key
requirements, workflow dispatch choices, and provider docs aligned.
`npm run check:provider-adapters` keeps Anthropic, OpenAI, and OpenRouter
request shapes, option gating, usage normalization, error redaction, and docs
aligned.
`npm run check:ledger-privacy` keeps usage, job, and run-control ledger
metadata normalization, usage API event visibility, schema omissions, and docs
aligned.
`npm run check:budget-scopes` keeps central budget scope validation, ledger
schema constraints, public docs, and dogfood examples aligned.
`npm run check:budget-policies-runbook` keeps budget policies guidance aligned
across policy-file shape, dry-run/apply behavior, central DB caps, admission
precedence, fail-closed policy reads, and review requirements.
`npm run check:run-control-scopes` keeps run-control concurrency scopes, env
parsing, claim SQL, docs, and env examples aligned.
`npm run check:alert-dimensions` keeps scheduled spend-spike alert dimensions,
env parsing, docs, and env examples aligned.
`npm run check:alert-notifier-modes` keeps scheduled alert delivery modes, env
parsing, docs, and env examples aligned.
`npm run check:alerting-runbook` keeps the scheduled alert runner's
no-provider behavior, private delivery routing, dogfood evidence, payload
privacy, and central-workflow posture aligned.
`npm run check:github-app-manifest` keeps the target GitHub App
permissions/events, no-Actions-write boundary, private manifest conversion,
redacted summaries, and docs aligned.
`npm run check:github-app-auth` keeps GitHub App auth env parsing, JWT shape,
installation-token caching, CLI profiles, GitHub Actions token output masking,
source invariants, and docs aligned.
`npm run check:github-app-routes` keeps GitHub App browser handoff routes
GET-only public-safe guidance surfaces that do not echo manifest codes,
generated credentials, private repo details, or trigger review work.
`npm run check:preflight` runs no-network central App server and worker
preflight fixtures.
`npm run check:preflight-contract` keeps the no-network preflight check order,
strict/profile behavior, CLI flags, redacted diagnostics, and docs aligned.
`npm run check:release-gates` keeps the machine-readable v0 release gates in
parity with the release plan and public evidence references.
`npm run check:v0-gates` keeps v0 release-gate status readiness, missing-id
checks, deferral semantics, Markdown redaction, source invariants, and docs
aligned.
`npm run check:webhook-replay` keeps saved webhook replay dry-run by default,
requires explicit dispatch for worker queueing, checks local payload signing,
avoids raw payload echo, and keeps replay docs aligned.
`npm run check:dogfood-target` keeps dogfood target packet modes, external
config path redaction, Markdown sanitization, source invariants, and docs
aligned.
`npm run check:dogfood-status` keeps dogfood status readiness, missing-id
checks, deferral semantics, Markdown redaction, source invariants, and docs
aligned.
`npm run check:dogfood-readiness` keeps dogfood readiness static defaults,
private workspace markers, preflight state, Markdown redaction, source
invariants, and docs aligned.
`npm run check:dogfood-promotion` keeps the pre-traffic promotion packet's
strict-preflight gate, private workspace markers, Markdown redaction, source
invariants, and docs aligned.
`npm run check:dogfood-go-live` keeps the final dogfood traffic packet's
strict-preflight gate, private workspace markers, Markdown redaction, source
invariants, and docs aligned.
`npm run check:operator-workspace` keeps operator workspace creation,
check-mode readiness failures, private path redaction, Markdown sanitization,
source invariants, and docs aligned.
`npm run check:operator-drill` keeps the operator drill's temporary workspace
cleanup, private path redaction, release-candidate, dogfood readiness,
promotion, go-live summaries, next commands, and docs aligned.
`npm run check:operator-evidence` keeps operator evidence sections,
readiness semantics, public-summary redaction, source invariants, and docs
aligned.
`npm run check:production-cutover` keeps production cutover checklist/status
readiness, deferral semantics, Markdown redaction, source invariants, and docs
aligned.
`npm run check:security-review-status` keeps security review status readiness,
deferral semantics, Markdown redaction, source invariants, and docs aligned.
`npm run check:release-candidate` keeps release-candidate bundle redaction,
private workspace path markers, CLI defaults, source invariants, and docs
aligned.

The local quality gate command inventory is:

- `npm run check`
- `npm run check:docs`
- `npm run check:doc-index`
- `npm run check:governance`
- `npm run check:install-guide`
- `npm run check:deployment-runbook`
- `npm run check:configuration-reference`
- `npm run check:aws-iam-templates`
- `npm run check:security-model`
- `npm run check:operations-runbook`
- `npm run check:dependabot`
- `npm run check:container-image`
- `npm run check:comment-commands`
- `npm run check:review-workflows`
- `npm run check:review-context-boundary`
- `npm run check:review-bins`
- `npm run check:review-comment-format`
- `npm run check:admission-policy`
- `npm run check:repository-config-boundary`
- `npm run check:worker-adapter-contract`
- `npm run check:admin-auth`
- `npm run check:usage-api-routes`
- `npm run check:admin-snapshot`
- `npm run check:support-bundle`
- `npm run check:diagnostics-redaction`
- `npm run check:model-defaults`
- `npm run check:providers`
- `npm run check:provider-adapters`
- `npm run check:ledger-privacy`
- `npm run check:budget-scopes`
- `npm run check:budget-policies-runbook`
- `npm run check:run-control-scopes`
- `npm run check:alert-dimensions`
- `npm run check:alert-notifier-modes`
- `npm run check:public-artifacts`
- `npm run check:github-app-manifest`
- `npm run check:github-app-auth`
- `npm run check:github-app-routes`
- `npm run check:preflight`
- `npm run check:preflight-contract`
- `npm run check:release-gates`
- `npm run check:v0-gates`
- `npm run check:webhook-replay`
- `npm run check:dogfood-target`
- `npm run check:dogfood-status`
- `npm run check:dogfood-readiness`
- `npm run check:dogfood-promotion`
- `npm run check:dogfood-go-live`
- `npm run check:operator-workspace`
- `npm run check:operator-drill`
- `npm run check:operator-evidence`
- `npm run check:production-cutover`
- `npm run check:security-review-status`
- `npm run check:release-candidate`
- `npm run check:env-templates`
- `npm run check:workflow-actions`
- `npm run check:workflow-permissions`
- `npm run validate:api-contract`

## How To Read It

- Local quality gates are public-safe and should run before each PR update.
- Operator input preparation is where private credentials, live environment
  variables, and reviewed budget/model-price files enter the process.
- Use `npm run operator:drill -- -- --dir <private-workspace-dir>` as the
  public-safe rehearsal before final release-candidate, dogfood promotion, and
  go-live `--require-ready` commands.
- Dogfood, security review, and production cutover each use a public checklist
  plus a private status overlay. The raw overlay files stay in the operator
  workspace.
- The dogfood promotion packet is the final composed go/no-go report before
  live dogfood traffic; it should include the private operator workspace and
  no-network preflight when used as a real traffic gate.
- The dogfood go-live packet is the final cross-check that release-candidate,
  dogfood promotion, production cutover, and operator workspace evidence agree
  before command-only live dogfood traffic.
- The release-candidate phase is the public-safe packaging layer. It reads the
  private overlays, redacts sensitive shapes, and produces the evidence bundle
  intended for release PRs, tag decisions, or public release notes.
- Support and incident commands can still contain operational posture even
  after sanitization, so a human should review those artifacts before public
  posting.

## Evidence Boundaries

The map is deliberately explicit about what can be copied into public spaces.
The public repository owns:

- command names and examples;
- checklists and validators;
- placeholder templates;
- redacted summaries and release bundles.

The operator workspace owns:

- provider keys, GitHub App credentials, AWS settings, HMAC secrets, alert
  delivery targets, and exact deployment identifiers;
- private release-gate, dogfood, security-review, and cutover status files;
- private webhook payloads, provider responses, admin snapshots, and raw
  support evidence.

When in doubt, publish the `release:candidate` bundle or a CLI summary count,
not the source evidence file.

When a command includes private file paths and the output is intended for
public copy/paste, prefer `npm --silent run ...` or `--out <public-file>
--quiet`. Normal `npm run` may print the invoked command before script output,
including private operator paths that the script output itself redacts.

## Maintenance

Update [config/release-operations-map.json](../config/release-operations-map.json)
when adding or renaming a recurring release command. Update the linked doc at
the same time so the command has a human explanation, not just an executable
entry.

The maintenance gate is:

```bash
npm run check:release-operations
```
