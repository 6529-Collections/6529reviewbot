# Security Review Status

Use `npm run security:review` to track the manual security review as a private
status overlay while keeping the canonical checklist public.

The public checklist lives at:

```text
config/security-review-checklist.json
```

The real status file should stay in the private operator workspace when it
contains reviewer names, deployment details, evidence links, accepted risks, or
follow-up ownership that should not be public yet.

## Bootstrap

Create a pending private status skeleton:

```bash
npm run security:review -- -- --init-status <operator-security-status-file>
```

Overwrite an existing local scratch file only when intentional:

```bash
npm run security:review -- -- --init-status <operator-security-status-file> --force
```

## Review

Render the canonical checklist:

```bash
npm run security:review
```

Render a private status overlay:

```bash
npm run security:review -- -- --status-file <operator-security-status-file>
```

Render only the public-safe summary:

```bash
npm run security:review -- -- --status-file <operator-security-status-file> --summary
```

Use JSON for automation:

```bash
npm run security:review -- -- --status-file <operator-security-status-file> --summary --json
```

## Readiness Gate

Before a dogfood expansion or public pre-v1 tag, require the private status
file to list every current checklist item and contain no pending or blocked
items:

```bash
npm run security:review -- -- --status-file <operator-security-status-file> --require-ready
```

`deferred` items are allowed only when the status includes notes. Release notes
must name the deferral, risk, and follow-up owner.

Run the security review status contract check after changing the status
schema, readiness behavior, deferral handling, Markdown redaction, source
invariants, or this runbook:

```bash
npm run check:security-review-status
```

The security review status contract check verifies pending skeletons, complete
and deferred readiness semantics, required evidence rules, public Markdown
redaction, and docs stay synchronized.

## Evidence Boundary

Status evidence may include:

- public-safe release-candidate summaries;
- aggregate preflight, budget, usage, run-control, and alert posture;
- public check links;
- manual decision summaries.

Status evidence must not include:

- provider prompts, responses, or raw diffs;
- raw webhook payloads;
- private repository details that are not intentionally public;
- provider keys, GitHub App credentials, HMAC secrets, AWS identifiers, alert
  webhook URLs, SNS topic ARNs, email addresses, or local private paths.

Use [Security Review Checklist](security-review-checklist.md) for the prose
review guide and [Release Candidate Bundle](release-candidate.md) for the
public-safe release evidence bundle.
