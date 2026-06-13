# Release Candidate Bundle

The release-candidate bundle collects the public-safe evidence an operator
needs while preparing release notes or a tag/no-tag decision.

It is intentionally no-network. It reads local release gate definitions,
optional private release-gate status, optional private operator evidence, git
metadata, package metadata, and the same preflight checks used by the runtime.
It does not replace `npm run release:check`, CI, Dependency Review, OpenSSF
Scorecard, or private operator evidence.
It also does not replace the [Production Cutover](production-cutover.md)
checklist, which is the go/no-go layer for live dogfood or production traffic.

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
```

Fail unless the candidate is ready:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready
```

Write the bundle to a file:

```bash
npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --out <public-bundle-file.md>
```

## Ready Criteria

`--require-ready` fails unless all of these are true:

- every current v0 release gate is present in the status file;
- release gates have no `pending` or `blocked` entries;
- operator evidence has no `pending` or `blocked` sections;
- preflight passes, with warnings treated as failures when
  `--strict-preflight` is set.

Deferred release gates or operator evidence sections are allowed, but release
notes must name the risk and follow-up owner.

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

## What It Includes

- package name and version;
- current git branch and commit when available;
- release-gate complete/deferred/pending/blocked counts;
- missing release-gate status ids;
- operator-evidence complete/deferred/pending/blocked counts;
- preflight error and warning summaries;
- redacted operator evidence sections;
- the follow-up release commands the operator should run.
