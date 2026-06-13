# Dogfood Readiness

Use `npm run dogfood:readiness` before enabling command-only or limited
initial-review traffic on a target repository.

The command validates the public dogfood inputs operators edit most often:

- target repository config templates;
- central dogfood budget policy file;
- model catalog defaults.

It can also include a private operator workspace parse check when the run is
being prepared from the release workspace. The report includes counts, modes,
review kinds, provider/model lanes, and readiness status. It does not print raw
private budget scope values, operator workspace paths, secrets, AWS
identifiers, provider responses, prompts, or target repository payloads.

## Static Check

Run the default static check from the repository root:

```bash
npm run dogfood:readiness
```

Render machine-readable output:

```bash
npm run dogfood:readiness -- -- --json
```

Use `--require-ready` when this is part of a release or cutover gate:

```bash
npm run dogfood:readiness -- -- --json --quiet --require-ready
```

## Operator Workspace

When a private workspace has been created with `npm run operator:workspace`,
include it before first traffic:

```bash
npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir>
```

This checks that the private release-gate, dogfood, security-review,
production-cutover, and operator-evidence files exist and parse. Pending
evidence items are summarized but do not make the pre-traffic readiness check
fail.

For expansion or final release gates where every private checklist must be
complete, add the stricter workspace flag:

```bash
npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --require-operator-workspace-ready --require-ready
```

## Custom Inputs

Validate an operator-reviewed target repository config and budget policy:

```bash
npm run dogfood:readiness -- -- \
  --repository-config <target-repo>/.github/6529bot.yml \
  --budget-policy-file <private-budget-policy-file.json>
```

`--repository-config` is repeatable, so operators can validate command-only and
limited-initial-review configs in one pass.

## Optional Preflight

Static checks intentionally do not require live secrets. From a private
operator environment, include the no-network preflight summary:

```bash
npm run dogfood:readiness -- -- --preflight
npm run dogfood:readiness -- -- --strict-preflight --require-ready
```

`--strict-preflight` treats warnings as not ready, matching the conservative
release-candidate behavior.

## Relationship To Release Tools

- `dogfood:readiness` answers whether the dogfood input files are internally
  consistent before first traffic.
- `dogfood:status` tracks the private evidence overlay after traffic starts.
- `release:candidate` summarizes broader tag/no-tag readiness.
- `production:cutover` tracks the live go/no-go checklist and private status
  overlay.
- `admin:snapshot` verifies private bot API posture after the bot is deployed.

Use all four when moving from source readiness to live dogfood traffic.
