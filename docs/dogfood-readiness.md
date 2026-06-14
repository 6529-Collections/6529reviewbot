# Dogfood Readiness

Use `npm run dogfood:readiness` before enabling command-only or limited
initial-review traffic on a target repository.

The command validates the public dogfood inputs operators edit most often:

- target repository config templates;
- this repository's command-only `.github/6529bot.yml` self-dogfood config;
- central dogfood budget policy file;
- model catalog defaults.

It can also include model price coverage and a private operator workspace parse
check when the run is being prepared from the release workspace. The report
includes counts, modes, review kinds, provider/model lanes, model price
coverage, and readiness status. It does not print raw private budget scope
values, model price file paths, operator workspace paths, secrets, AWS
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

When copying the report into a public PR, issue, release note, or manager
memory entry, use silent npm output so npm does not echo the private workspace
path before the command's redacted report:

```bash
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir>
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --json
```

The command output redacts operator workspace paths, but a normal `npm run`
invocation can still print the full command line before the script starts.
The rendered report uses `[operator-workspace]` for private workspace roots
and `[external-path-set]` for external file inputs.

For expansion or final release gates where every private checklist must be
complete, add the stricter workspace flag:

```bash
npm run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --require-operator-workspace-ready --require-ready
npm --silent run dogfood:readiness -- -- --operator-workspace <private-workspace-dir> --require-operator-workspace-ready --require-ready
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

Include the reviewed model price file before relying on local cost estimates:

```bash
npm run dogfood:readiness -- -- --model-price-file <reviewed-model-price-file.json>
npm run dogfood:readiness -- -- --model-price-file <reviewed-model-price-file.json> --max-model-price-source-age-days 14
```

The model price coverage check fails readiness when catalog default lanes are
missing, input or output rates are incomplete, source evidence is stale or
future-dated, zero-rate placeholders remain, or placeholder source URLs are
still present. Use `--allow-stale-model-price-source` or
`--allow-zero-model-price` only with explicit release evidence.
`dogfood:promotion --require-ready` and `dogfood:go-live --require-ready`
require `--model-price-file`; the public static readiness check can still run
without one when it is only validating committed dogfood inputs.

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
- `dogfood:promotion` composes target config, readiness, self-dogfood replay,
  private workspace parsing, and preflight into the final pre-traffic go/no-go
  packet.
- `dogfood:status` tracks the private evidence overlay after traffic starts.
- `release:candidate` summarizes broader tag/no-tag readiness.
- `production:cutover` tracks the live go/no-go checklist and private status
  overlay.
- `admin:snapshot` verifies private bot API posture after the bot is deployed.

Use all four when moving from source readiness to live dogfood traffic.

## Contract Check

Run the dogfood readiness contract check after changing readiness report
formatting, static input defaults, operator workspace handling, preflight
behavior, or release/dogfood docs:

```bash
npm run check:dogfood-readiness
```

The dogfood readiness contract check verifies the public static report,
private workspace path redaction, strict preflight state, Markdown redaction
for common secret and AWS identifier shapes, source invariants, and public doc
synchronization.
