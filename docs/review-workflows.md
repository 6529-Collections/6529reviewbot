# Review Workflows

The bot supports six review modes.

In the central GitHub App, a trigger becomes one or more review jobs. Each job
has one review mode and one lane. Model-backed jobs use provider/model lanes;
the responsiveness job uses the deterministic `github:actions-ubuntu-latest`
lane for GitHub Actions budget accounting. See
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

- 6529 frontend progressive i18n policy;
- `en-US` source/default locale with `en-GB`, `fr-FR`, `es-ES`, and `de-DE`
  fallback dictionaries;
- message-backed visible copy and accessible names through
  `i18n/messages.ts` and `t(locale, key, params)`;
- product-meaning message keys, interpolation, and no translated sentence
  concatenation;
- locale-aware helpers from `i18n/format.ts` and `i18n/locales.ts`, including
  `normalizeLocale`, number/date/percent/relative-time formatting, and
  `compareLocalized`;
- no broad `app/[lang]` migration request during component-level migration;
- no user-generated content translation unless a feature explicitly adds it;
- fallback-debt notes for touched surfaces that are not fully migrated.

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

## Responsiveness Review

Entrypoint:

```bash
node bin/responsiveness-review.cjs
```

The central worker dispatches responsiveness jobs to
`.github/workflows/responsiveness-review.yml`. The benchmark job runs target PR
frontend code on GitHub-hosted `ubuntu-latest` without model provider keys. A
separate comment job posts the 6529bot result with provider `github`, model
`actions-ubuntu-latest`, and zero token usage.

Focus:

- changed-route web desktop and mobile viewport regressions;
- native mobile shell behavior under Capacitor shims;
- Electron desktop shell behavior under Electron user-agent shims;
- horizontal overflow, visible framework error overlays, navigation failures,
  and fatal console errors;
- deterministic runner findings only.

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
