# Budget Policies

Central budget policy rows are operator-maintained caps stored in
`reviewbot.ai_review_budget_policies`. They are different from repository
config caps:

- central DB rows are owned by the bot operator and can apply across orgs,
  repos, requestors, PRs, providers, models, and review kinds;
- repository config can only add stricter caps for that repository;
- the production server loads enabled DB rows before budget admission, so these
  caps stop work before run-control claims, worker dispatch, or provider calls.

## Policy File

Start from:

```bash
config/budget-policies.example.json
```

The committed default example is empty on purpose. For dogfood, start from the
concrete example and review every placeholder before applying:

```bash
config/budget-policies.dogfood.example.json
```

The dogfood example includes global, org, repo, requestor, provider, model, and
review-kind caps. Replace `replace-with-maintainer-login` and adjust caps in
an operator-owned file before applying to production.
Dogfood examples intentionally omit `pr` rows because PR caps are usually
one-off operator-owned rows tied to a specific rollout or incident.

For a custom operator file, use the same shape:

```json
{
  "version": 1,
  "currency": "USD",
  "policies": [
    {
      "scopeType": "global",
      "scopeValue": "*",
      "dailyUsd": 25,
      "monthlyUsd": 500,
      "notes": "Initial dogfood global cap."
    },
    {
      "scopeType": "repo",
      "scopeValue": "6529-Collections/6529reviewbot",
      "dailyUsd": 10,
      "weeklyUsd": 50,
      "notes": "First target repository cap."
    },
    {
      "scopeType": "requestor",
      "scopeValue": "maintainer-login",
      "dailyUsd": 5,
      "notes": "Per-requestor dogfood cap."
    }
  ]
}
```

Supported scopes:

- `global`, with `scopeValue` set to `*`;
- `org`, with an organization or user login;
- `repo`, with `owner/repo`;
- `requestor`, with the trusted GitHub login that caused the spend;
- `pr`, with `owner/repo#123`;
- `provider`, with `anthropic`, `openai`, or `openrouter`;
- `model`, with an exact configured model id;
- `review_kind`, with `general`, `followup`, `wcag`, `i18n`, or `security`.

Older dogfood ledgers may still have a database check constraint from before
`org`, `requestor`, and `pr` were finalized. Before applying budget policies
there, run the ledger schema apply command from the operator environment:

```bash
npm run ledger:schema -- -- --apply
```

It refreshes the managed constraint and normalizes the legacy `requester`
spelling to `requestor`.

Enabled policies must include at least one of `dailyUsd`, `weeklyUsd`, or
`monthlyUsd`. Use `"enabled": false` to intentionally disable an existing row.

## Dry Run

Print SQL without contacting AWS:

```bash
npm run budget-policies -- -- --file budget-policies.json
npm run budget-policies -- -- --file config/budget-policies.dogfood.example.json
```

The dry run prints the SQL plus Data API parameter values so reviewers can see
exactly what will be upserted. `notes` values are redacted for common
secret-shaped values and capped at 1000 characters before they are rendered or
applied.

Use `--quiet` when a release or CI check should validate the file without
printing SQL.

## Apply

From a configured operator environment:

```bash
npm run budget-policies -- -- --file budget-policies.json --apply
```

The command upserts rows by `(scope_type, scope_value)` and updates
`updated_at`, caps, enabled state, and notes. It uses the same RDS Data API
settings as the usage ledger:

```text
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

Use `--schema <name>` only when the deployment intentionally stores bot data in
a non-default schema.

## Admission Behavior

When `REVIEW_USAGE_ENABLED=true`, `bin/server.cjs` reads enabled budget policy
rows for every webhook and merges them into the base admission policy before
repository config is applied.

If the budget table cannot be read in this mode, webhook handling fails before
queueing work. This is intentional: central DB budget rows are a spend-control
surface, not just dashboard metadata.

Repository config remains restrictive. It can add tighter caps, but it cannot
remove or raise central DB caps.

## Review Requirements

Every policy update should record:

- why the cap exists;
- the scope and exact value;
- daily, weekly, and monthly caps where relevant;
- whether the row enables or disables the cap;
- the operator or release issue that approved the change.

Do not put secrets, private PR payloads, provider diagnostics, or AWS account
details in `notes`; the redaction guardrail is there for accidental
token-shaped text, not as a reason to store sensitive data in budget rows.
