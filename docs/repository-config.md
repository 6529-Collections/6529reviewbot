# Repository Configuration

Repository configuration lets each target repository choose how `6529bot`
behaves without moving provider keys, AWS credentials, or bot code into that
repository.

The file is optional. If no file is present, central App policy applies.

## File Locations

The App checks these paths, in order, on the target repository's base ref:

```text
.github/6529bot.yml
.github/6529bot.yaml
.github/6529bot.json
.6529reviewbot.yml
.6529reviewbot.yaml
.6529reviewbot.json
```

Use `.github/6529bot.yml` unless there is a repository-specific reason not to.

For pull requests, config is read from the base ref, not the PR head. This
prevents a PR author from changing the bot policy inside the same PR that
triggers model spend.

## What Repo Config Can Do

Repository config can:

- disable the bot for a repository;
- narrow review kinds on initial PRs and follow-up commits;
- disable comment commands;
- select provider/model lanes from the centrally allowed lane set;
- lower the max jobs per delivery;
- add stricter admission rules;
- add or lower budget caps.

Repository config cannot:

- introduce a provider/model lane that central App policy did not allow;
- raise central budget caps;
- make central admission policy less restrictive;
- change provider keys, AWS access, GitHub App credentials, or worker runtime;
- execute repository code.

## Example

```yaml
version: 1
enabled: true

reviewKinds:
  allowed: [general, followup, wcag, i18n, security]
  initial: [general, wcag, i18n, security]
  followup: [followup]

commands:
  enabled: true

lanes:
  - provider: anthropic
    model: claude-opus-4-8
  - provider: openai
    model: gpt-5.5

limits:
  maxJobsPerDelivery: 8

admission:
  publicRepoMode: trusted
  privateRepoMode: open
  draftPrMode: skip
  trustedUsers: []
  trustedTeams: []
  trustedOrganizations: []
  trustedPermission: write
  denyUsers: []

budget:
  mode: enforce
  defaultEstimatedCostUsd: 1
  caps:
    repo:
      dailyUsd: 25
      monthlyUsd: 500
    requestor:
      dailyUsd: 10
    pr:
      dailyUsd: 5
    provider:
      dailyUsd: 50
    model:
      dailyUsd: 25
    review_kind:
      dailyUsd: 15
```

## Schema Notes

`version` must be `1`.

`reviewKinds.allowed`, `reviewKinds.initial`, and `reviewKinds.followup` may
contain only:

```text
general
followup
wcag
i18n
security
```

`lanes` may be written as objects:

```yaml
lanes:
  - provider: anthropic
    model: claude-opus-4-8
```

or strings:

```yaml
lanes:
  - anthropic:claude-opus-4-8
```

The App intersects these lanes with central `REVIEWBOT_REVIEW_LANES`. If the
intersection is empty, no jobs are queued.

`limits.maxJobsPerDelivery` is merged by taking the lower value between central
policy and repo config.

Admission modes are merged restrictively:

```text
off > trusted > open
```

Draft PR mode is restrictive too: if either central policy or repo config says
`skip`, drafts are skipped.

Budget modes are merged restrictively:

```text
enforce > warn > off
```

Budget caps are merged by taking the lower non-empty cap for each scope and
period. If only repo config defines a cap, that cap is added. If only central
policy defines a cap, central policy remains in force.

## Operational Guidance

For public open-source repositories, keep `publicRepoMode: trusted`. This
prevents untrusted contributors from burning model budget by opening or
updating PRs. Maintainers can still trigger targeted reviews with comment
commands when that behavior is centrally allowed.

For high-volume repositories, use `limits.maxJobsPerDelivery` and repo/requestor
budget caps. These are pre-provider controls and stop work before any model
request is queued.

When changing model defaults, update central `REVIEWBOT_REVIEW_LANES` first.
Then update repository config only where a repository should opt into a subset
of those centrally allowed lanes.
