# Architecture

`6529reviewbot` has four layers.

## 1. GitHub App Identity

The intended production identity is a GitHub App named `6529bot`. The app
should be installed only on repositories that intentionally use the bot.

Minimum repository permissions:

- Contents: read
- Issues: read and write
- Pull requests: read

The bot posts top-level PR comments. It does not need write access to source
code.

## 2. Trigger And Workflow Runner

The current repo contains a GitHub Actions reusable workflow scaffold for
running the review engine. The intended production trigger is the `6529bot`
GitHub App, so target repositories do not need to own the bot implementation.

The final app layer should decide whether to dispatch work to this repo,
call a pinned reusable workflow, or run the engine in another isolated worker.
That decision also determines where GitHub App credentials, provider keys, and
AWS OIDC trust should live.

The runner is responsible for:

- resolving the target PR;
- checking whether the PR should be skipped;
- checking out target source into an isolated workspace;
- configuring provider and AWS credentials;
- invoking the relevant review-mode entrypoint.

## 3. Review Engine

The review engine lives in `src/review-bot.cjs`.

It gathers bounded context:

- PR metadata;
- PR diff;
- changed-file list;
- safe source excerpts from the checked-out workspace;
- prior comments, reviews, and inline review comments;
- trusted 6529bot hidden metadata.

It then builds a prompt for one review kind and calls the selected provider.

## 4. Usage Ledger

The usage ledger lives in AWS Aurora PostgreSQL Serverless v2 and is written
through the RDS Data API. GitHub Actions should assume an AWS IAM role through
OIDC. No long-lived AWS credentials are required.

The ledger records one row per review run with:

- repo and PR;
- PR author;
- review kind;
- provider and model;
- token counts;
- provider request identifiers;
- cost fields when available;
- metadata needed for audit/debugging.

## Trust Boundaries

The bot treats target PR content as hostile:

- It never executes target repo code.
- It reads changed files only as text.
- It rejects unsafe paths and symlinks.
- It trusts hidden metadata only from configured bot authors.
- It strips hidden bot metadata before comments are placed in prompts.

## Comment Contract

Every posted comment starts with hidden metadata:

```html
<!-- 6529-review-bot:{...} -->
```

Visible comments start with:

```md
## 6529bot <review kind> - <short-sha>
```

The metadata marker includes review kind, provider, model, and commit SHA:

```text
6529-review-bot:<kind>:<provider-lane>:<model-lane>:<short-sha>
```

That lets the same review kind run through multiple models without collisions.
