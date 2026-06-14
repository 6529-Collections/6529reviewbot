# Operator Workspace

The operator workspace command creates the private files needed to track a
release candidate without committing live evidence to this public repository.

```bash
npm run operator:workspace -- -- --dir <private-workspace-dir>
```

The command writes:

- `community-release-status.json`
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
npm run community:gates -- -- --status-file <private-workspace-dir>/community-release-status.json --summary
npm run v0:gates -- -- --status-file <private-workspace-dir>/v0-release-status.json --summary
npm run dogfood:status -- -- --status-file <private-workspace-dir>/dogfood-status.json --summary
npm run security:review -- -- --status-file <private-workspace-dir>/security-review-status.json --summary
npm run production:cutover -- -- --status-file <private-workspace-dir>/production-cutover-status.json --summary
npm run operator:evidence -- -- --file <private-workspace-dir>/operator-evidence.json --summary
```

Audit the reviewed model price file before relying on local cost estimates:

```bash
npm run model-prices -- -- --file <reviewed-model-price-file.json> --require-catalog-coverage
```

Review the production deployment handoff against the same workspace before
running live App, registry, runtime, cutover, or dogfood actions:

```bash
npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --worker-dispatch-installation-id <central-repo-installation-id> --release v0.1.0 --require-ready
```

Review the 6529.io dashboard handoff against the same workspace before
exposing the public Open Data or private admin dashboard routes:

```bash
npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --release v0.1.0 --require-ready
```

Review the alert delivery handoff against the same workspace before enabling
webhook, SNS, or SES routing from the operator environment:

```bash
npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --release v0.1.0 --require-ready
```

Build a public-safe candidate bundle from the private files:

```bash
npm run release:candidate -- -- --operator-workspace <private-workspace-dir>
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet
```

Run [Operator Drill](operator-drill.md) with `npm run operator:drill` when rehearsing the release-candidate,
dogfood readiness, promotion, and go-live sequence before filling final
evidence:

```bash
npm --silent run operator:drill -- -- --dir <private-workspace-dir>
```

Validate dogfood readiness against the same private workspace before first
traffic:

```bash
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --quiet
npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready
npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready
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

Run the operator workspace contract check after changing workspace creation,
check-mode readiness behavior, generated README guidance, public summary
redaction, source invariants, or this runbook:

```bash
npm run check:operator-workspace
```

The operator workspace contract check verifies default summaries use
`[operator-workspace]` instead of private paths and that public Markdown
redacts token-shaped strings and AWS identifiers.

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
