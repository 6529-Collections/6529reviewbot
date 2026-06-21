# Comment Commands

Maintainers can trigger `6529bot` from a pull request comment. Commands are
case-insensitive and may use either slash-command or mention style:

```text
/6529bot review
@6529bot review security wcag
```

The App looks for the first trimmed comment line that starts with `/6529bot`
or `@6529bot`. Other text in the comment is ignored for command parsing, though
normal PR comments can still be included in review prompt context later.

## Commands

```text
/6529bot
/6529bot review
```

Runs the default comment review kind: `general`.

```text
/6529bot review all
```

Runs the initial-review set: `general`, `wcag`, `i18n`, and `security`.
`followup` is intentionally not included in `all`; it is for commit follow-up
work. Specialized kinds such as `deploy-actions`, `auth-api`, `db-lambda`,
`media-external`, `responsiveness`, and `glm-swarm` are also intentionally not
included in `all`; repos opt them into automatic initial reviews with
repository config, or maintainers can request them explicitly.

```text
/6529bot review general security
/6529bot review wcag i18n
/6529bot review deploy-actions
/6529bot review auth-api
/6529bot review db-lambda
/6529bot review media-external
```

Runs the listed review kinds. Unknown words are ignored. If no known review
kind is listed, the command falls back to `general`.

```text
/6529bot general
/6529bot followup
/6529bot wcag
/6529bot i18n
/6529bot security
/6529bot deploy-actions
/6529bot auth-api
/6529bot db-lambda
/6529bot media-external
/6529bot glm-swarm
/6529bot responsiveness
```

Runs exactly one review kind.

```text
/6529bot help
```

Is recognized as a no-review command. It does not queue model work in the
current App skeleton.

Unknown commands are ignored.

## Review Kinds

```text
general   correctness, regressions, production bugs, and meaningful tests
followup  newest commits plus prior human and bot review comments
wcag      WCAG 2.2 AA accessibility risks
i18n      6529 FE message keys, locale helpers, fallbacks, and copy migration
security  crypto/security, auth, injection, replay, and wallet risks
deploy-actions  deployment, CI, GitHub Actions, AWS, and rollout controls
auth-api  backend auth, route permissions, OpenAPI, and API compatibility
db-lambda  database, migration, Lambda loop, queue, and event dataflow risks
media-external  uploads, S3, media parsing, safe-fetch, and external ingest
glm-swarm  advisory OpenRouter GLM 5.2 swarm synthesis for Codex feedback
responsiveness  deterministic changed-route viewport and app-shell checks
```

See [review-workflows.md](review-workflows.md) for the review-mode prompts and
comment format.

## Policy

Comment commands do not bypass policy:

- the requestor is the comment author, not necessarily the PR author;
- central App command events are hydrated from GitHub's pull request API before
  dispatch so the worker gets the current PR head SHA, base SHA, head
  repository, draft state, and PR author;
- `REVIEWBOT_DRAFT_PR_MODE=skip` still allows trusted commands on draft PRs,
  while `skip_all` blocks draft commands too;
- if the current PR context cannot be loaded, the command is acknowledged but
  no review jobs are enqueued;
- public repositories require a trusted actor by default;
- repository config can disable commands with `commands.enabled: false`;
- repository config can narrow allowed review kinds;
- runtime control can pause orgs, repos, providers, models, or review kinds;
- budget admission and run-control claims still run before dispatch.

This is the intended external-PR shape: an untrusted contributor can open a PR,
but model spend should happen only when a trusted maintainer comments a command
or another trusted trigger admits the work.

## Dedupe

Run-control keys include the PR, head SHA, trigger, comment id, command name,
review kind, provider, and model. Duplicate webhook deliveries for the same
comment share a key. A new maintainer comment intentionally creates a new
command run.

Provider and model are part of the key so the same review kind can run through
multiple configured lanes without suppressing each other.

## Examples

Conservative dogfood command:

```text
/6529bot security
```

Full manual pass:

```text
/6529bot review all
```

Follow up after a new commit:

```text
/6529bot followup
```

Accessibility and translations only:

```text
@6529bot review wcag i18n
```

Frontend responsiveness only:

```text
/6529bot review responsiveness
```

Backend deploy and contract passes:

```text
/6529bot review deploy-actions auth-api db-lambda media-external
```

Advisory GLM swarm only:

```text
/6529bot glm-swarm
/6529bot review glm-swarm
```
