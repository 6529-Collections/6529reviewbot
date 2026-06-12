# Reusable Workflow Compatibility

The reusable workflow is a compatibility and development bridge. The preferred
production model is still the central `6529bot` GitHub App, central worker, and
bot-owned secrets.

Use the reusable workflow only when a repository intentionally accepts the
caller-repository trust model.

## Why It Is Not The Preferred Production Path

In the reusable workflow model, GitHub evaluates workflow permissions,
repository variables, secrets, and AWS OIDC identity from the caller
repository. That makes each caller repository part of the bot operating
surface.

Central App execution is preferred because:

- provider keys stay in one bot-owned environment;
- AWS OIDC trust can be scoped to the bot repository or protected environment;
- budget and run-control policy are enforced centrally;
- target repositories do not own bot code or provider credentials.

## Secret Contract

The reusable workflow declares only these optional provider secrets:

```text
ANTHROPIC_API_KEY
OPENAI_API_KEY
OPENROUTER_API_KEY
```

The caller template maps those names explicitly. Do not use `secrets: inherit`
for this workflow. Inheriting all caller secrets makes unrelated repository
secrets available to the bot job and weakens the public secret boundary.

AWS usage-ledger access should still use OIDC and reviewed trust policy. If a
caller repository writes usage rows directly, scope AWS trust to that exact
repository and branch/environment. Prefer central worker writes whenever
possible.

## Public Repository Rules

Do not enable automatic model calls from the reusable workflow on a public
repository unless all of these are true:

- only trusted actors can trigger spend;
- provider keys are scoped to the least privilege available from the provider;
- budget controls are configured and enforced;
- run-control dedupe and concurrency protections are enabled or explicitly
  accepted as a release risk;
- scheduled operator alerts route to a private operator channel.

The central App path gives stronger public-repo protections and should be used
for 6529 dogfood and community release work.

## Caller Template

Start from:

```text
templates/caller-workflow.yml
```

Pin the workflow ref to a reviewed tag or commit once a release tag exists.
Before the first release tag, treat `@v0` in the template as a placeholder.
