# Dogfood Status

Use `npm run dogfood:status` to track the first live dogfood run from selected
trusted repositories through command-only and limited initial-review traffic.

The command uses a public canonical checklist:

```text
config/dogfood-checklist.json
```

The real status file should stay in the private operator workspace when it
contains target repository names, PR links, ledger details, delivery channels,
or rollout notes. Public release notes should copy only redacted summaries.

## Bootstrap

Create a pending private status skeleton:

```bash
npm run dogfood:status -- -- --init-status <operator-dogfood-status-file>
```

Overwrite an existing local scratch file only when intentional:

```bash
npm run dogfood:status -- -- --init-status <operator-dogfood-status-file> --force
```

## Review

Render the canonical checklist:

```bash
npm run dogfood:status
```

Render a private status overlay:

```bash
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file>
```

Render only the public-safe summary:

```bash
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary
```

Use JSON for automation:

```bash
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --summary --json
```

## Readiness Gate

Before expanding from command-only to limited initial reviews, require the
current private status file to list every checklist item and contain no pending
or blocked items for the phase being approved:

```bash
npm run dogfood:status -- -- --status-file <operator-dogfood-status-file> --require-ready
```

`deferred` items are allowed only when the status includes notes. Release notes
must name the deferral, risk, and follow-up owner.

Run the dogfood status contract check after changing the status schema,
readiness behavior, missing-id handling, deferral handling, Markdown redaction,
source invariants, or this runbook:

```bash
npm run check:dogfood-status
```

The dogfood status contract check verifies pending skeletons, complete and
deferred readiness semantics, required evidence rules, public Markdown
redaction, and docs stay synchronized.

## Baseline Evidence

Before the first live dogfood model call, the baseline phase must include
reviewed provider-console-readiness operator evidence for model availability,
key custody, quotas/rate limits, spend controls, billing alerts, and emergency
key disablement. It must also include reviewed iam-and-secrets operator
evidence for OIDC trust, Data API scope, database grants, runtime secret-store
principals, target-repo/browser secret exclusion, rotation ownership, and
break-glass revoke paths.

## Evidence Boundary

Status evidence may include:

- public-safe PR comment links;
- aggregate job, budget, usage, and run-control counts;
- public check summaries;
- operator decision summaries.

Status evidence must not include:

- provider prompts, responses, or raw diffs;
- raw webhook payloads;
- private repository details that are not intentionally public;
- provider keys, GitHub App credentials, HMAC secrets, AWS identifiers, alert
  webhook URLs, SNS topic ARNs, or email addresses.

Use [Dogfood Readiness](dogfood-readiness.md) before first traffic,
[Dogfood Runbook](dogfood.md) during the run, and
[Production Cutover](production-cutover.md) when the release decision also
covers broad live traffic.
