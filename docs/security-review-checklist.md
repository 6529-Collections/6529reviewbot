# Security Review Checklist

Use this checklist before a dogfood expansion, a public pre-v1 tag, or a change
that touches provider calls, GitHub permissions, AWS access, prompt
construction, hidden metadata, budget admission, or run control.

## Scope

Record:

```text
Review date:
Reviewer:
Commit or tag:
Target deployment:
```

## Trust Boundaries

- Target repository PR content is treated as untrusted.
- Target repository code is read as text and not executed.
- Provider keys, GitHub App credentials, AWS credentials, and admin auth
  secrets remain outside target repositories and browser runtime.
- GitHub identity and permissions are resolved from GitHub APIs, not from
  prompt text, comments, or files controlled by a PR author.

## Checklist

- Webhooks require a valid `X-Hub-Signature-256` before parsing.
- Production GitHub App settings match the reviewed manifest template or an
  explicitly reviewed manual equivalent.
- The production GitHub App manifest was rendered with the final HTTPS bot
  origin and contains no `<bot-host>` placeholders.
- The [GitHub App Registration Packet](github-app-registration.md) acceptance
  and credential-custody checks are complete or explicitly deferred.
- GitHub App browser handoff routes do not echo manifest codes, generated
  credentials, webhook payloads, or private repository details.
- Public repositories require trusted actors or are disabled.
- Comment-command requestor attribution points to the comment author.
- Hidden bot metadata is trusted only from configured bot accounts.
- Repository config is read from the base ref, not the PR head.
- Repository config can narrow central policy but cannot add lanes or raise
  budgets.
- Path reads reject absolute paths, parent traversal, `.git`, directories, and
  symlinks.
- Provider prompts clearly treat diffs, files, commit text, and comments as
  untrusted.
- Provider calls have bounded input, output, timeout, and changed-file limits.
- Provider errors are sanitized before logs and comments.
- Runtime pause controls are evaluated before budget admission, run-control
  claims, worker dispatch, and provider calls.
- Scoped pauses for org, repo, provider, model, and review kind cannot be
  bypassed by repository config, comment commands, or multi-model lanes.
- Worker dispatch fails before provider calls when installation id, target repo,
  PR number, provider, model, or review kind are missing.
- Central worker jobs mint short-lived GitHub App installation tokens.
- Long-lived target repository bot tokens are not required for central workers.
- Workflow permissions are minimal and third-party actions are pinned by SHA.
- `npm run check:workflow-actions` passes for committed workflow templates.
- Reusable workflow callers map only declared provider secrets and do not use
  `secrets: inherit`.
- Worker capacity caps and backpressure controls are reviewed before live
  provider traffic scales beyond command-only dogfood.
- AWS access uses OIDC or Data API configuration scoped to the reviewbot ledger.
- AWS IAM/OIDC policies are rendered from reviewed templates or equivalent
  least-privilege documents, with trust scoped to the bot repo/environment.
- Ledger schema changes are reflected in `npm run ledger:schema` and reviewed
  before applying to Aurora.
- Managed daily aggregate views can be re-applied without hand-dropping stale
  view definitions in production.
- Additive table migrations preserve existing ledger data and do not require
  operators to hand-edit Aurora columns.
- Managed budget-scope constraints match the canonical app scopes, including
  `org`, `requestor`, and `pr`.
- Usage ledger failures have an explicit fail-open or fail-closed mode.
- Budget admission happens before queueing model jobs.
- Central DB budget policy rows are reviewed, applied from operator-owned
  files, and loaded into admission before worker dispatch.
- Model pricing rows, if used, include source URLs and have been checked
  against current provider pricing.
- Run-control claims happen before worker dispatch when enabled.
- Run-control dedupe keys include provider and model so multi-model lanes do
  not block each other.
- Public usage summaries redact private repo names unless allowlisted.
- Admin usage routes fail closed unless the 6529.io auth bridge authorizes the
  request.
- Admin job-events and runtime-status routes fail closed, expose only bounded
  operational fields, and do not return secrets, raw prompts, provider payloads,
  or raw webhook bodies.
- Machine-readable API contracts are updated when usage/admin response shapes
  change, and `npm run validate:api-contract` passes.
- Preflight, admin runtime status, and support bundles report secret presence
  or missing configuration only, never secret values.
- Alerting paths do not include secrets or raw prompts in messages.
- Incident response docs cover spend spikes, secret exposure, provider
  outages, webhook abuse, ledger outages, and bad bot comments.
- Documentation does not include live secrets, private PR data, provider
  diagnostics, or AWS account details beyond intended public ARNs/examples.

## Required Evidence

- `npm run release:check`
- `npm run validate:api-contract` when public or admin API contracts changed.
- `npm run preflight -- -- --strict` in the release candidate environment, or a
  documented acceptance of each warning.
- Completed [Operator Evidence Template](operator-evidence-template.md) with
  public-safe redactions.
- CI passed on the release PR or tag.
- Dependency Review passed.
- OpenSSF Scorecard completed and findings were reviewed.
- CodeRabbit or equivalent review feedback was addressed or explicitly
  accepted as non-blocking.
- Manual review notes are captured in the release issue or PR.

## Release Decision

```text
Decision: approve / approve with follow-up / block
Follow-ups:
```
