# Release Notes Publication

Use `npm run release:notes:check` on completed pre-v1 release notes before
publishing a GitHub Release, announcing a tag, or copying release text into a
public issue or PR.

Drafts from `npm run release:notes` intentionally include `TODO(operator)`
markers for private facts. Publication checks are the opposite: they fail until
those markers are gone, required evidence fields are filled, deferrals are
named, and the text is public-safe.

## Command

Check a completed Markdown file:

```bash
npm run release:notes:check -- -- --file <release-notes.md>
```

Render JSON for an operator workflow:

```bash
npm run release:notes:check -- -- --file <release-notes.md> --json
```

Treat recommendation warnings as errors:

```bash
npm run release:notes:check -- -- --file <release-notes.md> --require-no-warnings
```

## What It Checks

The publication guard verifies:

- the expected pre-v1 release note headings are present;
- the title looks like `# 6529reviewbot v0.1.0`;
- the title version is Git ref-safe for the constrained release-version
  format;
- the status line is filled;
- `TODO(operator)`, `TODO`, `TBD`, and similar placeholders are gone;
- tested configuration fields are filled;
- known-gap fields are filled;
- validation fields are filled;
- production deployment plan evidence is filled before tag or GitHub Release
  publication;
- dashboard deployment plan evidence is filled before tag or GitHub Release
  publication;
- public dashboard disclosure allowlist evidence is filled before tag or
  GitHub Release publication;
- private admin auth-check URL and wallet allowlist evidence is filled before
  tag or GitHub Release publication;
- alert delivery plan evidence is filled before tag or GitHub Release
  publication;
- accepted model-price overrides either state `none` or name
  `--allow-stale-source`/`--allow-zero-price` plus accepted risk and operator
  evidence;
- every validation field reports passed, ready, reviewed, or accepted evidence
  rather than vague run status;
- failed, pending, blocked, not-ready, or negated readiness evidence is
  rejected unless it is explicitly accepted, explicitly deferred, or
  dogfood-only;
- deferrals either include Gate, Risk accepted, Follow-up owner,
  Follow-up trigger/date, and Public-safe evidence, or the section states
  `No accepted deferrals`;
- token-shaped, key-shaped, raw AWS ARN/account-id, and local absolute path
  strings are not present.

Warnings remind operators to keep the standard safety language about
trusted-actor admission, budget enforcement, run-control enforcement,
bot-owned infrastructure, base-ref target repository configuration,
public dashboard disclosure allowlists, private admin auth evidence,
operator-owned alert routing, exact tag/commit pinning, and emergency rollback.

## Relationship To Drafts

Use [Release Notes Draft](release-notes-draft.md) to create the first
public-safe draft from release-candidate evidence:

```bash
npm --silent run release:notes -- -- --candidate-file <release-candidate.json> --out <release-notes.md> --quiet
```

Then complete every private operator-owned field from the private workspace.
Run the publication guard only after the release notes are meant to be
publishable.

`release:notes:check` does not read private operator workspaces and does not
prove that private evidence is true. It only checks that the public release
notes are complete enough to publish and do not contain obvious private data.

## Contract Check

Run the contract check after changing the publication guard, release notes
template, draft workflow, or release docs:

```bash
npm run check:release-notes-publication
```

The contract check validates a complete notes fixture, rejects Git ref-unsafe
title versions, rejects unfinished drafts, rejects sensitive text, rejects
failed or vague validation evidence, exercises the CLI, and keeps package
scripts, release checks, smoke tests, operations map entries, and docs
synchronized.
