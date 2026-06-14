# Release Candidate Bundle

The release-candidate bundle collects the public-safe evidence an operator
needs while preparing release notes or a tag/no-tag decision.

It is intentionally no-network. It reads local release gate definitions,
optional private release-gate status, optional private operator evidence, git
metadata, package metadata, optional dogfood status, optional security-review
status, optional production cutover status, optional broad community-release
status, and the same preflight checks used by the runtime.
It does not replace `npm run release:check`, CI, Dependency Review, OpenSSF
Scorecard, or private operator evidence.
Run the v0 release gate checker after changing release-gate status readiness,
missing-id handling, deferral semantics, or public gate Markdown because the
bundle can include release-gate counts and missing status ids.
It also does not replace the [Production Cutover](production-cutover.md)
checklist, which is the go/no-go layer for live dogfood or production traffic.
It can include [Dogfood Status](dogfood-status.md) when the release decision
depends on command-only or limited initial-review dogfood evidence.
Run the dogfood status checker after changing dogfood status readiness
behavior, missing-id handling, deferral semantics, or public dogfood Markdown
because release-candidate bundles can include those counts and deferrals.
It can include [Security Review Status](security-review-status.md) when the
release decision depends on a private manual security review status file.
Run the security review status checker after changing manual review readiness
behavior, deferral semantics, or public security-review Markdown because
release-candidate bundles can include those counts and deferrals.
Run the operator evidence checker after changing evidence readiness behavior,
section semantics, or public evidence Markdown because release-candidate
bundles always include operator-evidence counts and redacted sections.

## Command

Render a Markdown bundle from the public examples:

```bash
npm run release:candidate
```

Render JSON:

```bash
npm run release:candidate -- -- --json
```

Render from private operator files:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file>
npm run release:candidate -- -- --status-file <operator-status-file> --community-status-file <operator-community-status-file> --operator-evidence-file <private-evidence-file>
```

Render from a private operator workspace created by
`npm run operator:workspace`:

```bash
npm run release:candidate -- -- --operator-workspace <private-workspace-dir>
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir>
```

Include dogfood status in the same public-safe bundle:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file>
```

Include security-review status in the same public-safe bundle:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file>
```

Include production cutover status in the same public-safe bundle:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file>
```

Fail unless the candidate is ready:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready
```

When `--community-status-file`, `--dogfood-status-file`,
`--security-review-status-file`, or `--cutover-status-file` is provided,
`--require-ready` also fails unless that status lists every current checklist
item and no provided community-release, dogfood, security review, or cutover
item is pending or blocked.
When `--operator-workspace` is provided, the bundle reads the standard
workspace files for release gates, community-release gates, operator evidence,
dogfood status, security-review status, and production cutover status.
Explicit file flags can still override individual workspace paths.

Write the bundle to a file:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --out <public-bundle-file.md>
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet
```

Use `npm --silent run` or `--out <public-bundle-file.md> --quiet` when a
command includes private file paths and the rendered output will be copied into
public PRs, issues, release notes, or durable manager memory. Normal `npm run`
prints the invoked command before the script output, which can include private
operator paths even when the release-candidate bundle itself redacts those
paths.

## Ready Criteria

`--require-ready` fails unless all of these are true:

- every current v0 release gate is present in the status file;
- release gates have no `pending` or `blocked` entries;
- if provided, community-release status has no missing, `pending`, or
  `blocked` gates;
- operator evidence has no `pending` or `blocked` sections;
- if provided, dogfood status has no missing, `pending`, or `blocked` items;
- if provided, security-review status has no missing, `pending`, or `blocked`
  items;
- if provided, production cutover status has no missing, `pending`, or
  `blocked` items;
- preflight passes, with warnings treated as failures when
  `--strict-preflight` is set.

Deferred release gates, community-release gates, operator evidence sections,
dogfood items, or production cutover items are allowed, but release notes must
name the risk and follow-up owner.

Run the production cutover checker after changing cutover readiness behavior,
deferral semantics, or public cutover Markdown because release-candidate
bundles can include those counts and deferrals.

## Public-Safe Output

The bundle is suitable for public PRs, issues, releases, and durable manager
memory after operator review. It redacts common bearer, GitHub, provider API
key, alert webhook, AWS access-key id, private-key, AWS ARN, and AWS account id
shapes.

Preflight error and warning summaries are sanitized before inclusion, including
embedded tokens, secrets, external file paths, and other accidental private
diagnostic content.

The bundle reports external private file paths as `[external-path-set]`. Keep
the source operator evidence and release-gate status files in the private
operator runbook, not in this public repository.

Run the release-candidate contract check after changing bundle formatting,
operator workspace mapping, preflight summaries, or release docs:

```bash
npm run check:release-candidate
```

The release-candidate contract check verifies redaction of common secret,
provider-key, alert-webhook, AWS ARN, and AWS account-id shapes. It also keeps
private workspace paths rendered as `[operator-workspace]`, external private
paths rendered as `[external-path-set]`, CLI workspace defaults, source
invariants, and the public docs synchronized.

## What It Includes

- package name and version;
- current git branch and commit when available;
- release-gate complete/deferred/pending/blocked counts;
- missing release-gate status ids;
- broad community-release complete/deferred/pending/blocked counts when a
  community status file is provided;
- missing community-release status ids when a community status file is
  provided;
- operator-evidence complete/deferred/pending/blocked counts;
- dogfood complete/deferred/pending/blocked counts when a dogfood status file
  is provided;
- security-review complete/deferred/pending/blocked counts when a security
  review status file is provided;
- production cutover complete/deferred/pending/blocked counts when a cutover
  status file is provided;
- preflight error and warning summaries;
- redacted operator evidence sections, including the container publish,
  production deployment plan, worker dispatch credential, public dashboard
  disclosure, and private admin auth evidence sections when present;
- the follow-up release commands the operator should run.
