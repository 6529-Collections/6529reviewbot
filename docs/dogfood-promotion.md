# Dogfood Promotion Packet

Use `npm run dogfood:promotion` as the final go/no-go packet before enabling
command-only or limited initial-review dogfood traffic.

The command composes the checks operators otherwise have to remember
separately:

- target repository config posture from `dogfood:target`;
- central repository config, budget policy, and model catalog validation from
  `dogfood:readiness`;
- reviewed model price coverage from `dogfood:readiness`, so ready-mode local
  cost estimates are backed by complete, fresh provider evidence before live
  traffic;
- synthetic self-dogfood replay for PR-open skip, trusted maintainer command
  admission, deliberate multi-lane fanout, max-fanout rejection, and untrusted
  public command denial;
- private operator workspace parsing when supplied;
- no-network runtime preflight when supplied.

The report is public-safe. It does not print provider keys, GitHub App
credentials, AWS account ids, ARNs, raw webhook payloads, prompts, diffs,
provider responses, exact private workspace paths, or private status file
contents.
External model price file paths are summarized as `[external-path-set]`.

## Public Static Packet

Run the public packet from the repository root:

```bash
npm run dogfood:promotion
```

This validates public inputs and runs the synthetic self-dogfood replay, but it
will report `Promotion ready: no` until private operator workspace and
preflight inputs are included.

Render JSON for automation:

```bash
npm run dogfood:promotion -- -- --json
```

Validate a specific target repository config:

```bash
npm run dogfood:promotion -- -- \
  --repository 6529-Collections/example \
  --repository-config <target-repo>/.github/6529bot.yml \
  --mode command-only
```

External config paths are redacted to an `[external-config]` label in public
output.

## Private Go/No-Go Check

From the private operator environment, include the operator workspace,
reviewed model price file, and no-network preflight:

```bash
npm --silent run dogfood:promotion -- -- \
  --operator-workspace <private-workspace-dir> \
  --model-price-file <reviewed-model-price-file.json> \
  --strict-preflight \
  --require-ready
```

Use `npm --silent run` before copying output into public PRs, issues, release
notes, or manager memory. The command output redacts the operator workspace
path, but normal `npm run` can echo the full command line before the script
starts.

For expansion gates where every private checklist must already be complete,
add the stricter workspace flag:

```bash
npm --silent run dogfood:promotion -- -- \
  --operator-workspace <private-workspace-dir> \
  --model-price-file <reviewed-model-price-file.json> \
  --require-operator-workspace-ready \
  --strict-preflight \
  --require-ready
```

The model price coverage check fails the central-inputs promotion gate when a
provided price file is missing configured default lanes, omits input or output
rates, contains stale or future source evidence, uses zero-rate placeholders,
or still points at placeholder source URLs. Use
`--allow-stale-model-price-source`, `--allow-zero-model-price`, or
`--max-model-price-source-age-days <days>` only when the exception is backed by
explicit release evidence.

## Gate Meaning

`--require-ready` requires `--operator-workspace`, `--strict-preflight`, and
`--model-price-file`, and fails unless all promotion gates are green:

- target config packet is ready;
- central dogfood inputs parse, including reviewed model price coverage;
- self-dogfood replay passes;
- private operator workspace is supplied and parses;
- no-network preflight is supplied and passes.

Pending private dogfood evidence does not block first command-only traffic
unless `--require-operator-workspace-ready` is also supplied. The pending
evidence is what operators fill in after live dogfood starts. The exception is
the baseline provider/IAM handoff: before first live dogfood model calls,
complete `provider-console-readiness-reviewed` and
`iam-secret-custody-reviewed` in the private dogfood status overlay, backed by
`provider-console-readiness` and `iam-and-secrets` operator evidence.

## Relationship To Other Dogfood Tools

- `dogfood:target` checks the target repository config PR posture.
- `dogfood:readiness` checks static dogfood inputs and optional private
  workspace/preflight posture.
- `check:self-dogfood-replay` proves the committed self-dogfood config behaves
  safely before live delivery, and rehearses a deliberate two-lane command plus
  max-fanout rejection with temporary local config.
- `dogfood:promotion` composes those checks into the final pre-traffic packet.
- `dogfood:go-live` cross-checks the promotion packet against release
  candidate, production cutover, and operator workspace evidence.
- `dogfood:status` tracks private evidence after traffic starts.

Use the promotion packet immediately before enabling live command-only traffic,
then use the go-live packet when the traffic decision should include all
release and cutover evidence in one public-safe summary. Record the first run
and baseline provider/IAM evidence in the private dogfood status overlay.

## Contract Check

Run the dogfood promotion contract check after changing promotion packet
formatting, readiness gating, operator workspace handling, preflight behavior,
or release/dogfood docs:

```bash
npm run check:dogfood-promotion
```

The dogfood promotion contract check verifies that `--require-ready` requires
`--operator-workspace`, `--strict-preflight`, and `--model-price-file`, that
private workspace paths stay summarized as `[operator-workspace]`, that
external model price file paths stay summarized as `[external-path-set]`, that
ready mode requires reviewed model price coverage, that Markdown table cells
redact common secret and AWS identifier shapes, and that the public docs stay
synchronized with the pre-traffic gate.
