# Review Comment Format

`6529bot` posts one pull request comment per admitted review job. The visible
comment is meant for maintainers and contributors. The hidden metadata marker
is meant only for bot history, dedupe, and follow-up review state.

## Visible Shape

Successful model-backed comments use this shape:

```md
## 6529bot <review label> - <short-sha>

**Verdict**: <allowed verdict>

<concise findings and supporting detail>
```

The review label and allowed verdicts are tied to the review kind:

| Review kind | Review label | Allowed verdicts |
| --- | --- | --- |
| `general` | `general PR review` | `Good to merge`, `Needs changes`, `Blocking issues` |
| `followup` | `follow-up commit review` | `No new findings`, `Needs changes`, `Blocking issues` |
| `wcag` | `WCAG 2.2 AA analysis` | `No WCAG findings`, `Needs changes`, `Blocking issues` |
| `i18n` | `i18n analysis` | `No i18n findings`, `Needs changes`, `Blocking issues` |
| `security` | `crypto security analysis` | `No security findings`, `Needs changes`, `Blocking issues` |

The first visible body line should be a verdict and should use one of the
allowed verdicts for the review kind.

Findings may be grouped when it improves scanning:

```md
### Critical
### Important
### Nice-to-have
### Resolved since last review
```

Empty sections should be omitted. Findings should cite concrete files, lines,
behaviors, or test gaps where possible, and should avoid copying private
diagnostics, raw prompts, provider payloads, secrets, tokens, or hidden
metadata.

## Hidden Metadata

Every posted bot comment begins with an HTML comment:

```md
<!-- 6529-review-bot:{"version":1,"marker":"..."} -->
```

This marker records bounded operational metadata such as review kind, provider,
model, lane, head SHA, repository, PR number, changed-file count, changed-line
count, and creation time.

Hidden metadata is not a user-facing API. Follow-up reviews trust metadata only
from configured bot authors, and hidden bot markers are stripped before prior
comments are added to model prompt context. Users and PR authors can write text
that looks like a marker, but it must not be trusted unless GitHub identifies
the comment author as a configured bot account.

## Budget-Skip Comments

If budget admission denies a review before any provider call, the bot posts a
bounded skip comment instead of a model-backed review:

```md
## 6529bot <review label> skipped - <short-sha>

**Verdict**: Review skipped due to configured budget.

<redacted budget reason>

No model provider was called. Adjust the review-bot budget variables or run a
narrower review if this PR still needs AI review.
```

Budget-skip comments also include hidden metadata, but `kind` is
`budget-skip` and the original review kind is recorded separately as
`reviewKind`.

## Compatibility

Pre-v1 releases may still adjust headings, hidden metadata fields, or budget
skip wording. Any change to hidden metadata, visible heading shape, verdict
contract, or budget-skip wording should be called out in release notes because
it can affect follow-up review behavior, dashboards, and operator support.

Related docs:

- [Comment Commands](comment-commands.md)
- [Review Workflows](review-workflows.md)
- [Security Model](security-model.md)
- [Architecture](architecture.md)
