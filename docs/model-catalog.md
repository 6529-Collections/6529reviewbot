# Model Catalog

`config/model-catalog.json` is the source of truth for built-in provider
defaults. It keeps model updates explicit and reviewable.

## Current Defaults

```text
anthropic  claude-opus-4-8
openai     gpt-5.5
openrouter explicit model required
```

OpenRouter intentionally has no built-in default because routing choices affect
provider trust, latency, and cost. Configure OpenRouter with an explicit lane:

```text
REVIEWBOT_REVIEW_LANES=openrouter:anthropic/claude-sonnet-4
```

## Runtime Override Order

The runtime resolves a default model in this order:

1. `REVIEWBOT_DEFAULT_<PROVIDER>_MODEL`
2. `REVIEW_DEFAULT_<PROVIDER>_MODEL`
3. `config/model-catalog.json`

Review jobs also honor:

1. `REVIEWBOT_REVIEW_LANES`
2. `REVIEWBOT_DEFAULT_MODEL`
3. `REVIEW_MODEL`
4. provider-specific defaults above

This lets operators test a new model through environment configuration before
making it the catalog default.

## Updating Models

When a provider changes model names or 6529 policy chooses a new default:

1. Update `config/model-catalog.json`.
2. Add or update provider/model lanes in docs and templates if needed.
3. Run:

   ```bash
   npm run validate:model-catalog
   npm run check:model-defaults
   npm run release:check
   ```

4. Update `CHANGELOG.md` and release notes if the default changes.
5. For production, roll out through central `REVIEWBOT_REVIEW_LANES` first,
   then update target repo configs only if they intentionally narrow to the new
   lane.

Do not add an OpenRouter default unless central policy has selected a safe
router/model pair and the budget policy has been reviewed for that route.

## Catalog Shape

```json
{
  "version": 1,
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "defaultModel": "claude-opus-4-8",
      "requireExplicitModel": false,
      "models": {
        "claude-opus-4-8": {
          "status": "default",
          "notes": "Why this model is the default."
        }
      }
    }
  }
}
```

The validator requires every provider to be present and requires a default
model to be listed under `models` unless `requireExplicitModel` is true.
