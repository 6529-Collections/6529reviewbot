# Provider Setup

`6529reviewbot` supports Anthropic, OpenAI, and OpenRouter. Provider setup is
centralized in the bot environment. Target repositories should not receive
provider keys or provider billing credentials.

Use this guide with:

- [Configuration](configuration.md)
- [Model Catalog](model-catalog.md)
- [Model Pricing](model-pricing.md)
- [Deployment](deployment.md)

Provider documentation and pricing change over time. Treat provider-owned docs
as the source of truth and keep this repository focused on the operational
contract.

## Shared Requirements

For every enabled provider:

1. create the key in a bot-owned provider account or project;
2. store it only in the central bot secret store or central worker secrets;
3. set a provider-side hard spend or credit limit when the provider supports
   one;
4. configure 6529bot budget caps before allowing public repository spend;
5. add or verify the model in `config/model-catalog.json`;
6. apply reviewed price rows with `npm run model-prices -- -- --file <file>
   --apply`, including fresh `sourceCheckedAt` evidence for the provider docs;
7. run `npm run check:provider-adapters` after changing provider request,
   usage, error, or model-option behavior;
8. run `npm run preflight -- -- --strict` from the release candidate
   environment.

Do not put provider keys in:

- target application repositories;
- pull request workflows controlled by untrusted contributors;
- browser bundles;
- public documentation, screenshots, logs, or GitHub issue comments.

## Anthropic

Runtime secret:

```text
ANTHROPIC_API_KEY
```

Default model controls:

```text
REVIEW_PROVIDER=anthropic
REVIEW_DEFAULT_ANTHROPIC_MODEL=claude-opus-4-8
```

Anthropic is the default provider for this project. The default model is stored
in [Model Catalog](model-catalog.md), so future Opus updates should change the
catalog or environment rather than scattered code constants.

Operator checklist:

- create or rotate the key in the Anthropic Console;
- confirm the key has the minimum access needed for Messages API requests;
- confirm provider account limits are compatible with 6529bot budgets;
- verify current model pricing in Anthropic-owned pricing docs;
- apply the matching fresh `ai_model_prices` row before relying on cost
  estimates.

Useful provider links:

- [Claude API docs](https://docs.anthropic.com/)
- [Claude get started](https://docs.anthropic.com/en/docs/get-started)
- [Claude API pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [Claude models API](https://docs.anthropic.com/en/api/models-list)
- [Claude rate limits](https://docs.anthropic.com/en/api/rate-limits)

## OpenAI

Runtime secret:

```text
OPENAI_API_KEY
```

Default model controls:

```text
REVIEW_PROVIDER=openai
REVIEW_DEFAULT_OPENAI_MODEL=gpt-5.5
```

OpenAI review runs use the Responses API path in the review engine. Reasoning
and text verbosity options are enabled only for model families that advertise
support in the local capability map, unless operators force them through
configuration.

Operator checklist:

- create the key in the intended OpenAI project;
- prefer project-scoped keys or workload identity where available;
- keep admin API keys out of review workers unless an admin endpoint is
  explicitly required;
- set project budgets and alerts in the provider console;
- verify current model pricing in OpenAI-owned pricing docs;
- apply the matching fresh `ai_model_prices` row before relying on cost
  estimates.

Useful provider links:

- [OpenAI developer docs](https://developers.openai.com/api/docs)
- [OpenAI API reference](https://developers.openai.com/api/reference/overview/)
- [OpenAI API pricing](https://openai.com/api/pricing/)
- [OpenAI quickstart](https://developers.openai.com/api/docs/quickstart)

## OpenRouter

Runtime secret:

```text
OPENROUTER_API_KEY
```

Default model controls:

```text
REVIEW_PROVIDER=openrouter
REVIEW_DEFAULT_OPENROUTER_MODEL=
```

OpenRouter intentionally has no built-in default model. Use explicit lanes:

```text
REVIEWBOT_REVIEW_LANES=openrouter:anthropic/claude-sonnet-4
```

OpenRouter can return usage cost directly when usage accounting is requested,
which is more precise than local estimation. The review engine asks OpenRouter
to include usage data in responses.

Operator checklist:

- create the key in the OpenRouter account intended to own spend;
- set provider-side credit limits where available;
- choose explicit models or routes, not an unreviewed generic router;
- review the underlying model provider, data handling, latency, and pricing;
- keep OpenRouter routing choices in central policy, not target repo PRs;
- apply fresh local `ai_model_prices` rows only when direct cost is unavailable
  or when operators want a fallback estimate.

Useful provider links:

- [OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [OpenRouter models](https://openrouter.ai/docs/guides/overview/models)
- [OpenRouter pricing](https://openrouter.ai/pricing)
- [OpenRouter FAQ](https://openrouter.ai/docs/faq)

## Rotation

Rotate provider keys on a schedule and immediately after suspected exposure.
Recommended rotation process:

1. create the replacement key;
2. add it to the central bot secret store;
3. deploy or restart the worker path that reads the secret;
4. run `npm run preflight -- -- --strict`;
5. run one trusted dry run or command-only dogfood review;
6. revoke the old key;
7. record the rotation in private operator notes, not public issues.

## Budget Safety

Provider-side limits are not a substitute for 6529bot limits. Use both.

Recommended dogfood posture:

- start with one provider and one model lane;
- keep `REVIEWBOT_PUBLIC_REPO_MODE=trusted`;
- keep `REVIEWBOT_BUDGET_MODE=enforce`;
- enforce low repo, requestor, PR, provider, and model caps;
- enable run-control claims before automatic reviews;
- expand lanes only after reviewing several days of usage.

If provider usage dashboards and the 6529bot ledger disagree, treat the
provider dashboard as the billing source of truth and investigate the local
ledger before raising caps.
