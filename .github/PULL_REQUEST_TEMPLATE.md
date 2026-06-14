## Summary

Describe what changed and why.

## Behavior And Contract Notes

- Does this change affect comment commands, review kinds, repository config,
  hidden metadata, API response shapes, release gates, or operator runbooks?
- If it changes release, dogfood, cutover, or traffic policy behavior, do the
  release-candidate, dogfood promotion, dogfood go-live, production cutover,
  and release-notes evidence paths still agree?
- If it claims production, dashboard, alert, dogfood, security-review, or
  cutover readiness, does it distinguish local validation from operator-owned
  external evidence per [External Evidence Boundaries](../docs/external-evidence-boundaries.md)?
- If it changes a public/admin API, is `docs/usage-api.openapi.json` updated?

## Security Notes

- Does this change touch provider calls, GitHub permissions, AWS access, hidden
  metadata, or prompt construction?
- Does this change execute target repository code?
- Can secrets reach logs, comments, artifacts, or model prompts?
- Do runtime pause controls, trusted-actor admission, budget admission, and
  admin auth still fail closed before provider calls or private data exposure?

## Cost Notes

- Does this change affect token limits, fan-out, provider defaults, or usage
  ledger writes?
- Does it alter budget admission, run-control claims, usage cost estimation, or
  model price handling?

## Validation

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run release:check` when release, config, API, security, provider,
      budget, runtime, worker, or docs gates changed
- [ ] `npm run check:external-evidence-boundaries` when release artifacts,
      operator evidence, or public readiness language changed
- [ ] `npm run validate:api-contract` when usage/admin API contracts changed
- [ ] `npm run preflight -- -- --strict` or documented warnings when deployment
      configuration changed
- [ ] Docs updated if behavior/config changed
