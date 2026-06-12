# Architecture

`6529reviewbot` has six layers.

## 1. GitHub App Identity

The intended production identity is a GitHub App named `6529bot`. The app
should be installed only on repositories that intentionally use the bot.
Webhook verification and initial event normalization live in
`src/github-webhook.cjs` and `src/app-server.cjs`.

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
- verifying GitHub webhook signatures before routing events;
- loading base-ref repository configuration when enabled;
- evaluating admission policy before queueing model work;
- expanding admitted events into explicit review jobs;
- evaluating budget policy per review job before queueing model work;
- checking whether the PR should be skipped;
- checking out target source into an isolated workspace;
- configuring provider and AWS credentials;
- invoking the relevant review-mode entrypoint.

Review jobs are the contract between the App and workers. One job represents
one repository, PR, head SHA, review kind, provider, and model. This allows the
same review kind to run through multiple model lanes without collisions.

Repository configuration is read from the target repository's base ref. It can
disable work, narrow review kinds, choose from centrally allowed lanes, and add
tighter budget/admission rules. It cannot expand model/provider access beyond
central App policy.

## 3. Worker Adapters

Worker adapters bridge admitted jobs to execution. The current adapters are:

- `noop`, the default safe adapter that does not execute jobs;
- `local`, which runs the review CLI in the current bot checkout;
- `github_actions`, which dispatches a central bot workflow with job inputs.

Adapters run only after webhook authenticity, admission, job fanout, and budget
checks. They do not make target repositories owners of provider keys, AWS
credentials, or bot implementation code.

## 4. Review Engine

The review engine lives in `src/review-bot.cjs`.

It gathers bounded context:

- PR metadata;
- PR diff;
- changed-file list;
- safe source excerpts from the checked-out workspace;
- prior comments, reviews, and inline review comments;
- trusted 6529bot hidden metadata.

It then builds a prompt for one review kind and calls the selected provider.

## 5. Usage Ledger

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

## 6. Usage API

The usage API is the read-side contract for dashboards and admin tools. Public
endpoints return aggregate usage data that is safe for 6529.io transparency
pages. Admin endpoints require an injected authorizer and should be called only
after the existing 6529.io auth system verifies operator permissions.

The API does not expose Aurora credentials, provider keys, GitHub App secrets,
or raw provider responses to browser clients.

`src/admin-auth.cjs` provides the server-side bridge for private 6529.io admin
requests. The preferred mode is a short-lived HMAC assertion signed by trusted
6529.io infrastructure, not a separate bot login system.

## 7. Scheduled Alerts

`src/scheduled-spend-check.cjs` reads the same Aurora usage ledger and budget
policy table as the usage API. It evaluates spend alerts without calling model
providers, then delivers through `stdout`, a webhook, or SNS via
`src/alert-notifier.cjs`.

Scheduled checks should run from central bot infrastructure. Target
repositories should not receive AWS usage-ledger credentials or notification
secrets.

## Trust Boundaries

The bot treats target PR content as hostile:

- It never executes target repo code.
- It reads changed files only as text.
- It reads repo config from the base ref, not the PR head.
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
