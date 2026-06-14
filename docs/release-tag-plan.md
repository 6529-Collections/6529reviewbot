# Release Tag Plan

The release tag plan is the final dry-run check before an operator creates a
pre-v1 tag or GitHub Release.

It checks:

- the requested release version and normalized tag name;
- that the local checkout is on clean, synced `main`;
- that completed release notes pass the publication guard;
- that the release notes title matches the requested release tag;
- the exact tag and GitHub Release steps the operator should run.

It does not create tags or GitHub Releases.

## Commands

Run the planner after `npm run release:check`, v0 gates, release-candidate
evidence, and completed release notes have passed:

```bash
npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md>
```

Use `--require-ready` for the final pre-tag gate. This exits non-zero unless
the working tree is clean, the branch is `main`, the local branch is neither
ahead nor behind its upstream, and completed release notes are supplied,
publishable, and titled for the planned release:

```bash
npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready
```

For automation that wants JSON instead of Markdown:

```bash
npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready --json
```

The planner redacts the release-notes file path in its structured output. If
copying console output into a public issue or release PR, review the surrounding
shell command line too, because package managers may echo invoked commands.

## Contract

The maintenance check is:

```bash
npm run check:release-tag-plan
```

It verifies the dry-run behavior, clean-main readiness gate, release-notes
publication integration, CLI flags, release operations map entries, smoke-test
wiring, and public docs.

The check is included in `npm run release:check`.
