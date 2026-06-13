# Model Pricing

Model pricing is intentionally operator-maintained. Provider prices change, and
this public repository should not pretend a committed price row is always
current.

Use the model-prices CLI to review and apply price rows to
`reviewbot.ai_model_prices`.

The review runner uses these rows for usage telemetry when a provider does not
return direct dollar cost. It records `estimated_cost_usd` only when the active
provider/model price row covers every applicable token class reported by the
provider.

## Price File

Start from:

```bash
config/model-prices.example.json
```

The example file is empty on purpose. For a real deployment, create an
operator-owned file with current provider pricing, source URLs, and checked
timestamps:

```json
{
  "version": 1,
  "currency": "USD",
  "prices": [
    {
      "provider": "anthropic",
      "model": "claude-opus-4-8",
      "inputUsdPerMillion": 0,
      "cachedInputUsdPerMillion": null,
      "outputUsdPerMillion": 0,
      "reasoningUsdPerMillion": null,
      "effectiveFrom": "2026-06-12T00:00:00.000Z",
      "sourceUrl": "https://provider.example/pricing",
      "sourceCheckedAt": "2026-06-12T12:00:00.000Z",
      "notes": "Replace zeroes with verified current provider pricing before applying."
    }
  ]
}
```

Do not apply zeroes or placeholder prices. The apply path rejects zero-rate
rows by default because a placeholder zero can silently understate spend.
Every non-empty price file should be reviewed against current provider
documentation before use.

The apply path also rejects rows whose `sourceCheckedAt` timestamp is older
than 30 days by default, and rejects future-dated source checks. Use a shorter
or longer window only when the operator runbook explains why that provider's
pricing evidence can age differently.

## Dry Run

Print SQL without contacting AWS:

```bash
npm run model-prices -- -- --file prices.json
```

The dry run prints the SQL plus Data API parameter values so reviewers can see
exactly what will be inserted. `notes` values are redacted for common
secret-shaped values and capped at 1000 characters before they are rendered or
applied.

## Apply

From a configured operator environment:

```bash
npm run model-prices -- -- --file prices.json --apply
```

Override the default freshness window when the release has an explicit
operator policy for provider price evidence:

```bash
npm run model-prices -- -- --file prices.json --apply --max-source-age-days 14
```

If a release must apply a stale row, record the accepted risk and evidence in
the operator runbook, then use the explicit override:

```bash
npm run model-prices -- -- --file prices.json --apply --allow-stale-source
```

If a provider really documents a free token class or free model, record that
source in `sourceUrl` and `notes`, then use the explicit override:

```bash
npm run model-prices -- -- --file prices.json --apply --allow-zero-price
```

The apply path:

1. closes the current open-ended price row for the same provider/model;
2. inserts a new row with `effective_from`;
3. updates the same provider/model/effective timestamp if the file is replayed;
4. keeps prior rows for audit/history.
5. rejects stale source-check evidence unless `--allow-stale-source` is supplied.
6. rejects zero-rate rows unless `--allow-zero-price` is supplied.

The command uses the same RDS Data API settings as the usage ledger:

```text
REVIEW_USAGE_AWS_REGION
REVIEW_USAGE_DB_RESOURCE_ARN
REVIEW_USAGE_DB_SECRET_ARN
REVIEW_USAGE_DB_NAME
REVIEW_USAGE_DB_SCHEMA
```

Use `--schema <name>` only when the deployment intentionally stores bot data in
a non-default schema.

## Review Requirements

Every pricing update should record:

- provider and model;
- input/cached-input/output/reasoning rates that apply;
- effective timestamp;
- provider source URL;
- source-checked timestamp showing when the operator verified the provider
  pricing source;
- notes about units or caveats.

The CLI enforces a source URL, source-checked timestamp, and at least one price
field. It also rejects zero-rate rows during apply unless the operator passes
`--allow-zero-price`, and rejects stale or future-dated source-checked
timestamps unless the operator passes `--allow-stale-source`.
Do not put secrets, private account details, provider diagnostics, or private
PR payloads in `notes`; the redaction guardrail is there for accidental
token-shaped text, not as a reason to store sensitive data in pricing rows.
Provider pages and APIs are the source of truth. If pricing cannot be verified,
leave the row unapplied and keep budget admission on conservative default
estimates.

Private operator dashboards can inspect active price-row coverage and
source-evidence freshness through `GET /api/admin/model-prices/status`. The
endpoint returns rates, source hosts, and freshness posture, but not operator
notes or full source URLs. See [Usage API](usage-api.md).

## Estimation Behavior

At usage-write time the runner selects the active row where:

```text
provider/model match the review lane
effective_from <= now
effective_to is null or in the future
```

The estimator handles cached input tokens conservatively:

- if cached tokens look like a subset of input tokens, it prices the non-cached
  remainder at the input rate and cached tokens at the cached-input rate;
- if cached tokens are reported separately from input tokens, it prices input
  tokens and cached tokens separately;
- if no cached-input rate is configured, cached tokens use the input rate only
  when that does not double-count a subset.

Reasoning tokens use `reasoningUsdPerMillion` when provided, otherwise they use
the output rate. If any token class has usage but no applicable rate, the bot
does not write an estimated cost for that run.
