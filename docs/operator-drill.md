# Operator Drill

`npm run operator:drill` runs a public-safe release and dogfood operator drill.
It creates a temporary operator workspace skeleton, rehearses the
release-candidate, dogfood readiness, promotion, and go-live summaries, and
prints the next commands an operator should run from the private environment,
including the production deployment plan, dashboard deployment plan, and alert
delivery plan handoffs.
The default drill removes the temporary workspace before exiting.

The drill rehearses the sequence without calling GitHub, AWS, or model
providers. It does not replace the final `--require-ready` gates for release,
promotion, or go-live decisions.

## Quick Run

```bash
npm run operator:drill
```

Use an existing private workspace when one has already been created:

```bash
npm --silent run operator:drill -- -- --dir <private-workspace-dir>
```

Write a public-safe report without echoing a private path in the command line:

```bash
npm --silent run operator:drill -- -- --dir <private-workspace-dir> --out <public-drill.md> --quiet
```

## What It Checks

The drill composes existing public-safe commands and summaries:

- `operator:workspace` skeleton creation and parse checks;
- `release:candidate` readiness summary using the workspace overlays;
- `dogfood:readiness` static input checks for repository config, budget policy,
  model catalog, and workspace parsing;
- `dogfood:promotion` summary with self-dogfood replay included by default;
- `dogfood:go-live` summary that shows which final gates are still pending.
- `production:deployment-plan` as the dry-run deployment handoff command to
  review before live App, registry, runtime, cutover, or dogfood actions;
- `dashboard:deployment-plan` as the dry-run 6529.io dashboard handoff command
  to review before public/private dashboard exposure.
- `alerts:delivery-plan` as the dry-run alert routing handoff command to
  review before webhook, SNS, or SES delivery.

Freshly generated operator workspace files are expected to be pending. A
default drill should usually report `Ready: no`; that is useful because it
shows the exact evidence that still needs operator completion.

## Private Workspace

When `--dir` is supplied, the command writes the standard private workspace
skeleton unless the files already exist. Use `--force` only when intentionally
regenerating the workspace.

```bash
npm --silent run operator:drill -- -- --dir <private-workspace-dir> --force
```

By default, the command refuses to write inside the public repository. Use a
private operator runbook, encrypted workspace, or another access-controlled
location.

## Final Gates

After filling the private workspace, run the real gates:

```bash
npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready --out <public-bundle-file.md> --quiet
npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --worker-dispatch-installation-id <central-repo-installation-id> --release v0.1.0 --require-ready
npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --release v0.1.0 --require-ready
npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --release v0.1.0 --require-ready
npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready
npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready
```

Run `npm run check:operator-drill` after changing the drill command, operator
workspace flow, release-candidate bundle, dogfood readiness/promotion/go-live
summaries, production deployment plan handoff, dashboard deployment plan
handoff, alert delivery plan handoff, or this runbook.
