# Review Workflows

The bot supports five review modes.

In the central GitHub App, a trigger becomes one or more review jobs. Each job
has one review mode and one provider/model lane. See
[review-jobs.md](review-jobs.md).

Maintainer comment triggers are documented in
[comment-commands.md](comment-commands.md).

## General PR Review

Entrypoint:

```bash
node bin/general-pr-review.cjs
```

Focus:

- correctness regressions;
- production bugs;
- auth, injection, or secret exposure;
- data integrity;
- missing error handling;
- meaningful test gaps.

## Follow-Up Commit Review

Entrypoint:

```bash
node bin/followup-commit-review.cjs
```

Focus:

- newest commit set;
- prior human and bot review comments;
- prior same-kind/same-provider/model 6529bot marker;
- whether prior findings were fixed, ignored, or regressed;
- new issues introduced by follow-up fixes.

## WCAG 2.2 AA Analysis

Entrypoint:

```bash
node bin/wcag-aa-analysis.cjs
```

Focus:

- keyboard access;
- focus order and focus visibility;
- accessible names and labels;
- semantic structure;
- dialogs, live regions, and ARIA correctness;
- contrast, target size, reduced motion, and responsive layout risks.

## i18n Analysis

Entrypoint:

```bash
node bin/i18n-analysis.cjs
```

Focus:

- hardcoded strings;
- translated labels, aria labels, alt text, and validation messages;
- pluralization and interpolation;
- locale-sensitive dates, numbers, currencies, addresses, and wallet labels;
- RTL assumptions.

## Crypto Security Analysis

Entrypoint:

```bash
node bin/security-analysis.cjs
```

Focus:

- signature replay;
- domain separation;
- nonce handling;
- chain-id confusion;
- wallet identity binding;
- JWT and session handling;
- transaction integrity;
- XSS, SSRF, redirects, injection, and untrusted media.

## Comment Format

Visible comments should begin with:

```md
**Verdict**: <allowed verdict>
```

Findings should be grouped only when needed:

```md
### Critical
### Important
### Nice-to-have
### Resolved since last review
```

The bot omits empty sections.

See [Review Comment Format](review-comment-format.md) for the full visible
comment, hidden metadata, and budget-skip contract.
