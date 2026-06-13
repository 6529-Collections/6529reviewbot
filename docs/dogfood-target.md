# Dogfood Target Packet

Use `npm run dogfood:target` before opening a target repository PR that adds
`.github/6529bot.yml`.

The command validates the repository config file operators are about to copy
or propose in the target repo. It does not call GitHub, read target repository
source code, use provider credentials, inspect private status files, or dispatch
workers.

## Command-Only Start

The safest first target-repo PR uses the command-only template. Initial and
follow-up automatic reviews stay disabled, while trusted maintainer comment
commands remain available:

```bash
npm run dogfood:target
npm run dogfood:target -- -- --mode command-only --require-ready
```

The default config is
`templates/dogfood-command-only-config.yml`.

## Limited Initial Reviews

After webhook delivery, budget admission, run-control, usage rows, and alerts
are verified, validate the limited-initial template:

```bash
npm run dogfood:target -- -- --mode limited-initial --require-ready
```

The default config is `templates/dogfood-repository-config.yml`.

## Custom Target Config

Validate a config file prepared for a specific target repository:

```bash
npm run dogfood:target -- -- --repository-config <target-repo>/.github/6529bot.yml --mode auto --require-ready
npm --silent run dogfood:target -- -- --repository-config <target-repo>/.github/6529bot.yml --mode auto --require-ready
```

`--mode auto` infers command-only mode when initial and follow-up automatic
reviews are disabled; otherwise it treats the config as limited-initial.

If the target repository name is intentionally public, include it in the
packet:

```bash
npm run dogfood:target -- -- --repository 6529-Collections/example --mode command-only
```

## What It Checks

The packet fails `--require-ready` when the target config is unsafe for first
dogfood traffic:

- config file parses and matches the requested mode;
- `enabled` and maintainer comment commands are on;
- command-only mode has no automatic initial or follow-up reviews;
- limited-initial mode includes general and security initial reviews plus
  follow-up review;
- at least one explicit provider/model lane exists;
- `maxJobsPerDelivery` stays within the conservative mode cap;
- public repos require trusted actors, draft PRs are skipped, and trusted
  permission is write, maintain, or admin;
- budget mode is `enforce`, with daily repo, requestor, PR, and review-kind
  caps.

Warnings do not fail the packet. They call out choices that should be reviewed
before traffic, such as multiple provider/model lanes or a narrowed allowed
review-kind set.

## Public Boundary

The Markdown and JSON outputs are public-safe when the repository name is
intentionally public. External config paths are rendered as
`[external-config]/<file>` so local operator paths are not copied into public
PRs or release notes.

Use `npm --silent run` before copying output from commands that include a
private local config path. The packet output redacts external paths, but normal
npm output can echo the full command line before the script starts.

The packet is not a substitute for live readiness. Before first traffic, also
run [Dogfood Readiness](dogfood-readiness.md), run the
[Dogfood Promotion Packet](dogfood-promotion.md) from the private operator
environment, create or update the private [Dogfood Status](dogfood-status.md)
overlay, and confirm central runtime, budget, run-control, ledger, and alert
posture from the operator environment.
