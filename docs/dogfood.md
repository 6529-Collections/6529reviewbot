# Dogfood Runbook

Use this runbook to enable `6529bot` on the first 6529 repositories without
moving provider keys, AWS credentials, or bot implementation code into target
repositories.

## Goals

- Prove the central GitHub App event path on real PRs.
- Prove trusted-actor admission before any provider spend.
- Prove per-repo and per-requestor budget gates before model calls.
- Prove usage rows, public aggregates, admin aggregates, and alerts.
- Keep rollback simple: disable the repo config or uninstall the GitHub App.

## Non-Goals

- Broad community onboarding.
- Arbitrary public repo auto-runs.
- Target-repo secrets, provider keys, or AWS credentials.
- Running target repository code during review.

## Target Repository Setup

Add one file to the target repository:

```text
.github/6529bot.yml
```

Start with command-only mode when testing a new repo. Copy the template from
this repository into the target repository as `.github/6529bot.yml`:

```bash
cp /path/to/6529reviewbot/templates/dogfood-command-only-config.yml .github/6529bot.yml
```

Move to limited initial PR reviews after webhook delivery, admission, budget,
usage, and alerts are verified:

```bash
cp /path/to/6529reviewbot/templates/dogfood-repository-config.yml .github/6529bot.yml
```

Validate the file from this repository before opening the target-repo PR:

```bash
npm run validate:repo-config -- templates/dogfood-command-only-config.yml
npm run validate:repo-config -- templates/dogfood-repository-config.yml
```

For a target repository checkout, point the validator at that repo's file:

```bash
node /path/to/6529reviewbot/bin/validate-repository-config.cjs .github/6529bot.yml
```

The config is read from the target repo base ref. A PR author cannot change bot
policy inside the same PR that triggers model spend.

## Central Bot Setup

Use `templates/dogfood-central-env.example` as the starting policy. Keep real
secret values in the bot deployment secret store.

Required secret families:

- GitHub App id, private key, and webhook secret;
- provider keys for enabled lanes;
- AWS Data API access for the isolated usage ledger;
- alert delivery credentials when not using stdout;
- 6529.io admin-auth HMAC secret when private admin routes are enabled.

Use the base64 private-key form for GitHub Actions and other environments that
handle multiline secrets poorly.

Start with:

```text
REVIEWBOT_WORKER_ADAPTER=noop
```

This verifies webhook delivery, signature checks, repository config loading,
actor resolution, admission, budget checks, and job fanout without running model
jobs. Switch to `github_actions` or `local` only after the dry path is clean.

## Phased Rollout

### Phase 0: Noop Central Dry Run

- Install the GitHub App on one target repository.
- Set `REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github`.
- Keep `REVIEWBOT_WORKER_ADAPTER=noop`.
- Open a maintainer PR and confirm the webhook response contains jobs but does
  not enqueue them.
- Confirm untrusted public-repo actors are denied before job creation.

### Phase 1: Command-Only Live Reviews

- Use `templates/dogfood-command-only-config.yml`.
- Keep automatic initial and synchronize reviews disabled.
- Switch the worker adapter to the chosen live worker.
- Trigger one review with a maintainer comment, such as `/6529bot general`.
- Confirm the PR comment is posted by `6529bot`.
- Confirm one usage row is written with requestor, repo, PR, provider, model,
  review kind, token counts, and cost fields.
- Confirm budget summaries include the requestor and repo dimensions.

### Phase 2: Limited Initial Reviews

- Use `templates/dogfood-repository-config.yml`.
- Keep a single Anthropic lane unless explicitly testing multi-lane behavior.
- Open a small PR and confirm only `general` and `security` initial jobs run.
- Push a follow-up commit and confirm only the `followup` review runs.
- Check that draft PRs are skipped.
- Check that oversized diffs skip or truncate according to central settings.

### Phase 3: Broader Coverage

- Add WCAG or i18n initial reviews only after cost and comment quality are
  acceptable.
- Test same review kind across multiple provider/model lanes only with explicit
  daily caps.
- Raise budgets only after reviewing usage data for several days.

## Rollback

Fast rollback options, from narrowest to broadest:

- set `enabled: false` in `.github/6529bot.yml`;
- set repo-level budget caps to `0`;
- set central `REVIEWBOT_WORKER_ADAPTER=noop`;
- set central `REVIEWBOT_PUBLIC_REPO_MODE=off`;
- uninstall the GitHub App from the target repo;
- disable provider keys in the bot secret store.

## Acceptance Checklist

- Webhook delivery succeeds and invalid signatures fail.
- Target repo config is loaded from the base ref.
- Public repo untrusted actors cannot trigger spend.
- Maintainer comment commands attribute spend to the maintainer.
- Budget denial happens before queueing.
- Usage rows are written for live reviews.
- Public usage summary redacts private repo detail unless allowlisted.
- Admin usage summary requires 6529.io-authenticated HMAC assertions.
- Spend alerts run on schedule and can be delivered through the chosen channel.
- Operators can disable the bot without changing target repo secrets.
