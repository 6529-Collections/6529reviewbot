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
`npm run check:dependabot` keeps weekly npm and GitHub Actions dependency
update coverage present.
`npm run check:workflow-permissions` keeps committed workflow and template
permission blocks explicit and least-privilege.
`npm run check:review-workflows` keeps review-kind constants, worker bins,
workflow dispatch choices, reusable defaults, and workflow routing aligned.
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
`npm run check:model-defaults` keeps model-catalog defaults, reusable workflow
fallbacks, provider-default docs, and conservative starter lanes aligned.
`npm run check:providers` keeps supported provider constants, preflight key
requirements, workflow dispatch choices, and provider docs aligned.
`npm run check:budget-scopes` keeps central budget scope validation, ledger
schema constraints, public docs, and dogfood examples aligned.
`npm run check:run-control-scopes` keeps run-control concurrency scopes, env
parsing, claim SQL, docs, and env examples aligned.
`npm run check:alert-dimensions` keeps scheduled spend-spike alert dimensions,
env parsing, docs, and env examples aligned.
`npm run check:alert-notifier-modes` keeps scheduled alert delivery modes, env
parsing, docs, and env examples aligned.

The local quality gate command inventory is:

- `npm run check`
- `npm run check:docs`
- `npm run check:doc-index`
- `npm run check:governance`
- `npm run check:dependabot`
- `npm run check:container-image`
- `npm run check:comment-commands`
- `npm run check:review-workflows`
- `npm run check:review-bins`
- `npm run check:review-comment-format`
- `npm run check:admission-policy`
- `npm run check:repository-config-boundary`
- `npm run check:model-defaults`
- `npm run check:providers`
- `npm run check:budget-scopes`
- `npm run check:run-control-scopes`
- `npm run check:alert-dimensions`
- `npm run check:alert-notifier-modes`
- `npm run check:public-artifacts`
- `npm run check:env-templates`
- `npm run check:workflow-actions`
- `npm run check:workflow-permissions`
- `npm run validate:api-contract`

## How To Read It

- Local quality gates are public-safe and should run before each PR update.
- Operator input preparation is where private credentials, live environment
  variables, and reviewed budget/model-price files enter the process.
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
