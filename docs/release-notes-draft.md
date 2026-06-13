# Release Notes Draft

`npm run release:notes` builds a public-safe pre-v1 release notes draft from
the current release-candidate evidence and model catalog defaults. It is a
starting point for operator review, not an automatic publisher.

The draft intentionally leaves operator-owned facts as `TODO(operator)`:
production App deployment, dashboard status, alert delivery, provider pricing,
dogfood repositories, production deployment plan evidence, manual security
review, CI links, and accepted deferrals. Complete those fields from the
private operator workspace before creating a GitHub Release. Before publishing,
run
[Release Notes Publication](release-notes-publication.md) or
`npm run release:notes:check -- -- --file <release-notes.md>` to reject
unfinished markers and obvious private-data leaks.

## Commands

Build a draft from public-safe default inputs:

```bash
npm run release:notes
```

Build a draft from a saved release-candidate JSON bundle:

```bash
npm --silent run release:notes -- -- --candidate-file <release-candidate.json>
```

Write the draft without echoing private command paths:

```bash
npm --silent run release:notes -- -- --candidate-file <release-candidate.json> --out <release-notes.md> --quiet
```

Render JSON for tooling:

```bash
npm run release:notes -- -- --json
```

## Public Safety

The draft uses the same public text redaction boundary as the
[Release Candidate Bundle](release-candidate.md), including common token,
alert webhook, AWS access-key id, private-key, AWS ARN, and AWS account-id
shapes. A human operator should still review the final Markdown before
publishing it.

Keep raw private release-gate, dogfood, security-review, cutover, and operator
evidence files out of release notes. Generate a release-candidate JSON bundle
or Markdown bundle first, review it, then use the draft command as the public
notes starting point.

## Contract Check

Run:

```bash
npm run check:release-notes-draft
```

The check verifies the draft command keeps release-candidate summaries, model
catalog defaults, OpenRouter explicit routing, `TODO(operator)` markers,
production deployment plan evidence, redaction, CLI flags, release-check
wiring, smoke coverage, operations map entries, and docs synchronized.
