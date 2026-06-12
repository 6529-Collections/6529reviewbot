# Operations Runbook

## Routine Checks

Run locally:

```bash
npm run check
npm test
```

Verify AWS ledger connectivity:

```bash
aws rds-data execute-statement \
  --region "$REVIEW_USAGE_AWS_REGION" \
  --resource-arn "$REVIEW_USAGE_DB_RESOURCE_ARN" \
  --secret-arn "$REVIEW_USAGE_DB_SECRET_ARN" \
  --database "$REVIEW_USAGE_DB_NAME" \
  --sql "select count(*) from reviewbot.ai_review_usage_events"
```

Run a dry spend-alert pass:

```bash
npm run alerts:spend -- --dry-run --force
```

Validate target repo config before rollout:

```bash
npm run validate:repo-config -- templates/dogfood-repository-config.yml
```

## If Reviews Stop Posting

Check:

- target repo workflow permissions;
- GitHub App installation;
- `GH_TOKEN` scope;
- provider key availability;
- fork/external PR skip logic;
- PR draft state;
- changed-file and changed-line budgets.

## If Usage Rows Stop Writing

Check:

- `REVIEW_USAGE_ENABLED`;
- AWS OIDC role trust;
- `id-token: write` workflow permission;
- RDS Data API enabled;
- Secrets Manager secret ARN;
- IAM role policy;
- `REVIEW_USAGE_FAIL_CLOSED`.

## If Provider Spend Spikes

Check:

- the latest `npm run alerts:spend -- --dry-run --force` output;
- enabled rows in `reviewbot.ai_review_budget_policies`;
- `REVIEW_BOT_INITIAL_KINDS`;
- provider/model overrides;
- `REVIEW_MAX_OUTPUT_TOKENS`;
- `REVIEW_MAX_DIFF_CHARS`;
- `REVIEW_MAX_CONTEXT_CHARS`;
- `REVIEW_MAX_PRIOR_COMMENTS_CHARS`;
- oversize behavior.

If alerts did not send, check:

- `REVIEWBOT_ALERTS_ENABLED`;
- `REVIEWBOT_ALERTS_NOTIFY_MODE`;
- `REVIEWBOT_ALERTS_WEBHOOK_URL` or `REVIEWBOT_ALERTS_SNS_TOPIC_ARN`;
- AWS OIDC credentials for SNS mode;
- whether `REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED` should fail the scheduled job.

## If Usage Dashboards Stop Updating

Check:

- `GET /api/public/usage/summary?days=30`;
- the bot API data loader or Aurora reader;
- `REVIEWBOT_USAGE_API_PUBLIC_ENABLED`;
- `REVIEWBOT_USAGE_API_PUBLIC_REPOS` and
  `REVIEWBOT_USAGE_API_PUBLIC_ORGS`;
- 6529.io auth handoff for admin routes;
- whether private repo data is intentionally collapsed in public responses.

## If A Bot Comment Looks Wrong

Check:

- whether the finding is grounded in diff/context;
- prior comments included in prompt;
- hidden metadata marker lane;
- provider/model used;
- whether target PR content attempted prompt injection.
