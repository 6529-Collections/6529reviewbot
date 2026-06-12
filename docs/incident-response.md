# Incident Response

This runbook covers operator response for `6529bot` incidents. It is written
for the central App model where provider keys, GitHub App credentials, AWS
ledger access, and alert routing live outside target repositories.

Do not paste provider keys, GitHub App private keys, webhook secrets, AWS
credentials, raw private repository payloads, or private PR data into public
issues, PRs, release notes, or chat exports.

## Severity

```text
SEV1  Active secret exposure, uncontrolled provider spend, or broad incorrect
      bot behavior across multiple repositories.
SEV2  One repository or provider path is impaired, spend is bounded, or admin
      visibility is degraded.
SEV3  Localized failure with a workaround, delayed alert, or non-urgent docs
      correction.
```

## First Five Minutes

1. Stop spend if there is any chance of uncontrolled model calls:

   ```text
   REVIEWBOT_ENABLED=false
   REVIEWBOT_WORKER_ADAPTER=noop
   REVIEWBOT_PUBLIC_REPO_MODE=off
   ```

2. Disable target repository config if only one repo is affected:

   ```yaml
   enabled: false
   ```

3. Preserve evidence privately:

   - GitHub delivery id and event type;
   - PR number, head SHA, requestor, and review kind;
   - queue result or job ledger rows;
   - usage ledger rows and alert payloads;
   - sanitized logs.

4. Run no-network checks before restarting anything:

   ```bash
   npm run preflight -- -- --json
   ```

5. Use webhook replay only with sanitized saved payloads and no dispatch:

   ```bash
   npm run webhook:replay -- -- --payload payload.json \
     --actor-permission write \
     --assume-empty-budget
   ```

## Spend Spike

Immediate actions:

- set `REVIEWBOT_WORKER_ADAPTER=noop`;
- set `REVIEWBOT_ENABLED=false` if model calls must stop globally;
- set `REVIEWBOT_PUBLIC_REPO_MODE=off` if public repo triggers are involved;
- verify budget policies in `reviewbot.ai_review_budget_policies`;
- inspect recent usage:

  ```sql
  select created_at, repo_full_name, pr_number, review_kind, provider, model,
         coalesce(actual_cost_usd, estimated_cost_usd, 0) as cost_usd,
         metadata->>'requestor' as requestor
  from reviewbot.ai_review_usage_events
  where created_at >= now() - interval '24 hours'
  order by created_at desc
  limit 100;
  ```

- inspect dispatch behavior:

  ```sql
  select created_at, job_id, status, repo_full_name, pr_number, requestor,
         review_kind, provider, model, adapter, reason
  from reviewbot.ai_review_job_events
  where created_at >= now() - interval '24 hours'
  order by created_at desc
  limit 100;
  ```

Recovery:

- identify whether spend came from initial PR triggers, comment commands,
  provider/model fanout, or repeated deliveries;
- tighten repo/org/requestor/PR/provider/model caps before reenabling;
- restart in command-only or trusted-only mode;
- document accepted residual risk in private incident notes.

## Secret Exposure

Immediate actions:

- revoke or rotate the exposed secret;
- disable affected provider key, GitHub App private key, webhook secret, AWS
  secret, or admin-auth secret;
- remove the secret from logs, comments, artifacts, and screenshots where
  possible;
- check whether the secret was sent to a model provider or public GitHub
  surface.

Recovery:

- rotate dependent credentials that could have been reached through the
  exposed secret;
- verify the new secret owner and storage location;
- run `npm run preflight -- -- --strict` in the updated environment;
- record the timeline, exposure surface, and rotation evidence privately.

## Provider Outage Or Bad Provider Responses

Immediate actions:

- set affected provider/model caps to zero or remove the lane from
  `REVIEWBOT_REVIEW_LANES`;
- keep other provider lanes active only if budget and quality risks are
  understood;
- inspect bot comments for provider error leakage.

Recovery:

- restore the lane only after a successful dry run or limited command-triggered
  test;
- update [model-catalog.md](model-catalog.md) if the outage is tied to a model
  rename or deprecation;
- add a release note if users need to change repo config.

## Webhook Replay Or Command Abuse

Immediate actions:

- verify GitHub webhook signatures are enforced;
- set `REVIEWBOT_PUBLIC_REPO_MODE=off` or `trusted`;
- add abusive actors to `REVIEWBOT_DENY_USERS`;
- disable comment commands in affected repo config if needed:

  ```yaml
  commands:
    enabled: false
  ```

Recovery:

- confirm requestor attribution points to the trusted trigger, not the PR
  author for maintainer-triggered external PRs;
- check job ids for repeated delivery/head SHA fanout;
- open a private follow-up if dedupe or rate limiting needs to change.

## Ledger Or Dashboard Outage

Immediate actions:

- decide whether the bot should fail open or closed:

  ```text
  REVIEW_USAGE_FAIL_CLOSED=true|false
  REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=true|false
  ```

- verify the schema:

  ```bash
  npm run ledger:schema
  ```

- verify Data API connectivity with a read-only query before applying changes.

Recovery:

- run `npm run ledger:schema -- -- --apply` only from a configured operator
  environment;
- backfill only from trusted private logs or provider/accounting exports;
- keep public dashboards in a degraded state rather than exposing private raw
  rows.

## Bad Bot Comment

Immediate actions:

- hide or delete the comment if it is misleading, unsafe, or contains private
  data;
- set `REVIEWBOT_WORKER_ADAPTER=noop` if the issue may repeat;
- preserve the hidden metadata marker and job id privately.

Recovery:

- inspect the prompt inputs for prompt injection, stale prior comments, or
  context truncation;
- add or tighten prompt instructions only if the issue is systemic;
- rerun the review only with a trusted command and bounded scope.

## Post-Incident Notes

Record privately:

```text
Incident:
Severity:
Start:
Detected by:
Affected repos/PRs:
Requestors:
Providers/models:
Spend impact:
Secrets involved:
Immediate containment:
Root cause:
Fix:
Follow-ups:
Public communication needed:
```

Public follow-up should be sanitized and should not reveal private repo names,
requestor names, raw payloads, provider keys, AWS identifiers beyond intended
public examples, or attacker-controlled prompt content.
