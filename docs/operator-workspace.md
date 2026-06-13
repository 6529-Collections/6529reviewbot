# Operator Workspace

The operator workspace command creates the private files needed to track a
release candidate without committing live evidence to this public repository.

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir>
```

The command writes:

- `v0-release-status.json`
- `dogfood-status.json`
- `security-review-status.json`
- `production-cutover-status.json`
- `operator-evidence.json`
- `README.md`

By default, the command refuses to write inside the public repository. Use a
private operator runbook directory, encrypted workspace, or another
access-controlled location.

## Typical Flow

Create the workspace:

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir>
```

Review initial status counts:

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir> --check
npm run v0:gates -- -- --status-file <private-workspace-dir>/v0-release-status.json --summary
npm run dogfood:status -- -- --status-file <private-workspace-dir>/dogfood-status.json --summary
npm run security:review -- -- --status-file <private-workspace-dir>/security-review-status.json --summary
npm run production:cutover -- -- --status-file <private-workspace-dir>/production-cutover-status.json --summary
npm run operator:evidence -- -- --file <private-workspace-dir>/operator-evidence.json --summary
```

Build a public-safe candidate bundle from the private files:

```bash
npm run release:candidate -- -- --operator-workspace <private-workspace-dir>
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet
```

Validate dogfood readiness against the same private workspace before first
traffic:

```bash
npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir>
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --quiet
npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready
npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready
```

Equivalent explicit file flags are still available for non-standard private
workspace layouts:

```bash
npm run release:candidate -- -- --status-file <private-workspace-dir>/v0-release-status.json --operator-evidence-file <private-workspace-dir>/operator-evidence.json --dogfood-status-file <private-workspace-dir>/dogfood-status.json --security-review-status-file <private-workspace-dir>/security-review-status.json --cutover-status-file <private-workspace-dir>/production-cutover-status.json --strict-preflight
```

Require the workspace to be ready before a final tag/no-tag or broad-traffic
decision:

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir> --check --require-ready
```

Use `--require-ready` only when making the final tag/no-tag decision.

## Public Boundary

The generated files are private operator artifacts. They can contain live
deployment details once filled in:

- App ids and setup evidence;
- AWS account, cluster, secret, and role references;
- private dogfood run keys or payload evidence;
- admin snapshot details;
- reviewer notes and release decision evidence.

Copy the redacted `release:candidate` output, `dogfood:promotion` packet,
`dogfood:go-live` packet, or individual CLI summaries into public PRs, issues,
releases, or durable manager memory. Do not copy the raw workspace files unless
they have been reviewed and intentionally redacted.
When the command line contains a private workspace path, prefer
`npm --silent run` or a command-specific `--out <public-file> --quiet` option
before copying terminal output into public artifacts.
