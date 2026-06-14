# Dogfood Go-Live Packet

Use `npm run dogfood:go-live` as the final operator view before enabling
command-only live dogfood traffic.

The packet composes the checks that otherwise live in separate commands:

- release-candidate readiness from `npm run release:candidate`;
- target config, central dogfood inputs, self-dogfood replay, operator
  workspace parsing, and preflight from `npm run dogfood:promotion`;
- reviewed model price coverage forwarded through `npm run dogfood:promotion`;
- private dogfood, security-review, release-gate, production-cutover, and
  operator-evidence summaries from the standard operator workspace.

It is a public-safe summary. It redacts private operator workspace paths and
does not print secrets, live AWS identifiers, raw webhook payloads, prompts,
provider responses, or private evidence payloads.
External model price file paths nested inside the promotion input are
summarized as `[external-path-set]`.

## Public Dry Run

Render the packet from public examples:

```bash
npm run dogfood:go-live
npm run dogfood:go-live -- -- --json
```

The public dry run is expected to report `Go-live ready: no` because it does
not include private release evidence or live runtime preflight settings.

## Operator Run

Run from the private operator environment with the standard workspace created
by [Operator Workspace](operator-workspace.md):

```bash
npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight
```

Use `npm --silent run` when copying output into public PRs, issues, releases,
or durable manager memory. Normal `npm run` can echo the command line before
the script starts, including private file paths that the script output itself
redacts.

For the final go/no-go check, require readiness:

```bash
npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready
```

`--require-ready` requires `--strict-preflight` and `--model-price-file`, and
fails unless every go-live gate is ready:

- the private operator workspace exists and all overlay summaries are ready;
- dogfood status baseline items `provider-console-readiness-reviewed` and
  `iam-secret-custody-reviewed` are backed by `provider-console-readiness` and
  `iam-and-secrets` operator evidence before first live dogfood model calls;
- the release-candidate bundle is ready;
- the dogfood promotion packet is ready, including reviewed model price
  coverage;
- production cutover status is included, complete, and has no missing current
  checklist ids.

The go-live command passes `--model-price-file`,
`--allow-stale-model-price-source`, `--allow-zero-model-price`, and
`--max-model-price-source-age-days <days>` through to the nested promotion
packet. The dogfood-promotion gate fails when a supplied price file is missing
configured default lanes, omits input or output rates, contains stale or future
source evidence, uses zero-rate placeholders, or still points at placeholder
source URLs.

## Private Inputs

When `--operator-workspace` is supplied, the command reads these standard
workspace files:

- `v0-release-status.json`;
- `operator-evidence.json`;
- `dogfood-status.json`;
- `security-review-status.json`;
- `production-cutover-status.json`.

You can override individual files with:

```bash
npm run dogfood:go-live -- -- \
  --status-file <operator-status-file> \
  --operator-evidence-file <private-evidence-file> \
  --dogfood-status-file <operator-dogfood-status-file> \
  --security-review-status-file <operator-security-status-file> \
  --cutover-status-file <operator-cutover-status-file>
```

Keep those source files private. Public release notes should copy only the
redacted go-live packet, the release-candidate bundle, or summary counts.

## Contract Check

Run the dogfood go-live contract check after changing go-live packet
formatting, readiness gating, operator workspace handling, preflight behavior,
or release/dogfood docs:

```bash
npm run check:dogfood-go-live
```

The dogfood go-live contract check verifies that `--require-ready` requires
`--strict-preflight` and `--model-price-file`, that private workspace paths
stay summarized as `[operator-workspace]`, that nested external model price
file paths stay summarized as `[external-path-set]`, that ready mode requires
reviewed model price coverage, that the Markdown table cells redact common
secret and AWS identifier shapes, and that the public docs stay synchronized
with the traffic gate.
