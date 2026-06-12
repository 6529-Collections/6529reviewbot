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
- Worker dispatch fails before provider calls when installation id, target repo,
  PR number, provider, model, or review kind are missing.
- Central worker jobs mint short-lived GitHub App installation tokens.
- Long-lived target repository bot tokens are not required for central workers.
- Workflow permissions are minimal and third-party actions are pinned by SHA.
- AWS access uses OIDC or Data API configuration scoped to the reviewbot ledger.
- Ledger schema changes are reflected in `npm run ledger:schema` and reviewed
  before applying to Aurora.
- Usage ledger failures have an explicit fail-open or fail-closed mode.
- Budget admission happens before queueing model jobs.
- Run-control claims happen before worker dispatch when enabled.
- Run-control dedupe keys include provider and model so multi-model lanes do
  not block each other.
- Public usage summaries redact private repo names unless allowlisted.
- Admin usage routes fail closed unless the 6529.io auth bridge authorizes the
  request.
- Alerting paths do not include secrets or raw prompts in messages.
- Incident response docs cover spend spikes, secret exposure, provider
  outages, webhook abuse, ledger outages, and bad bot comments.
- Documentation does not include live secrets, private PR data, provider
  diagnostics, or AWS account details beyond intended public ARNs/examples.

## Required Evidence

- `npm run release:check`
- `npm run preflight -- -- --strict` in the release candidate environment, or a
  documented acceptance of each warning.
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
