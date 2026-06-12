# Active Context

First file to read after compaction: this file.

## Current Goal

Complete the `6529reviewbot` roadmap to a high standard using autonomous
workstream management, durable memory, repeated self-review, and incremental
merged PRs.

## Current State

- Repository: `D:\repos\6529reviewbot`
- Remote: `6529-Collections/6529reviewbot`
- Base branch: `main`
- Initial foundation PR: merged as PR #1, merge commit `50e4b47`
- Roadmap/memory PR: merged as PR #4, merge commit `5693061`
- GitHub App skeleton PR: merged as PR #5, merge commit `9e500b4`
- Budget admission PR: merged as PR #7, merge commit `69c1739`
- Review job interface PR: merged as PR #8, merge commit `43dfbea`
- Usage API contract PR: merged as PR #9, merge commit `f5af840`
- Aurora usage loader PR: merged as PR #10, merge commit `edaadc6`
- Dashboard progress docs PR: merged as PR #11, merge commit `f635a2d`
- Repository config PR: merged as PR #12, merge commit `6edb52d`
- Worker execution adapters PR: merged as PR #13, merge commit `1d84b10`
- Admin auth bridge PR: merged as PR #14, merge commit `17e6dd2`
- Scheduled spend alerts PR: merged as PR #15, merge commit `c079b7a`
- Release readiness docs PR: merged as PR #16, merge commit `6bb7e93`
- GitHub App installation auth PR: merged as PR #17, merge commit `d667ffd`
- Dogfood onboarding kit PR: merged as PR #18, merge commit `b5f458d`
- Frontend public dashboard PR:
  `https://github.com/6529-Collections/6529seize-frontend/pull/2605`
- Frontend dogfood config PR:
  `https://github.com/6529-Collections/6529seize-frontend/pull/2606`
- Production deployment wiring PR: merged as PR #19, merge commit `cee929b`
- Release hardening PR: merged as PR #20, merge commit `78401dc`
- v0 release plan PR: merged as PR #21, merge commit `9a5b5e9`
- Webhook replay diagnostics PR: merged as PR #22, merge commit `ea7a118`
- Model catalog defaults PR: merged as PR #23, merge commit `8cba107`
- Job lifecycle ledger PR: merged as PR #24, merge commit `91701f2`
- Ledger schema tooling PR: merged as PR #25, merge commit `0ffd197`
- Production preflight PR: merged as PR #26, merge commit `9b57580`
- Incident response runbook PR: merged as PR #27, merge commit `0c9ee6b`
- Run control contract PR: merged as PR #28, merge commit `ac7bc12`
- Run control ledger PR: merged as PR #29, merge commit `ba902fe`
- Budget ledger wiring PR: merged as PR #30, merge commit `25bd1b9`
- Run claim status PR: merged as PR #31, merge commit `7d16d96`
- Model price tooling PR: merged as PR #32, merge commit `5a3bf47`
- Model price estimation PR: merged as PR #33, merge commit `7aa4bd3`
- Run claim completion PR: merged as PR #34, merge commit `91a1e57`
- Provider setup guide PR: merged as PR #35, merge commit `199bccc`
- Support bundle PR: merged as PR #36, merge commit `cc6369d`
- v0 release gates PR: merged as PR #37, merge commit `f8e86b2`
- Admin job-events API PR: merged as PR #38, merge commit `283b9d3`
- Admin runtime status API PR: merged as PR #39, merge commit `9134361`
- Runtime pause controls PR: merged as PR #40, merge commit `137c949`
- Current branch: `codex/comment-command-docs`
- Current local changes: dedicated maintainer comment-command contract docs,
  README and operator-doc links, changelog, release readiness, roadmap, v0
  plan, and manager-memory updates

## Key Decisions

- Production direction is a central GitHub App named `6529bot`, not per-repo
  bot logic.
- Target repositories should not own provider keys, AWS credentials, or bot
  implementation code.
- Public repos need trusted-actor admission before model calls to prevent
  budget abuse.
- Repository config is read from the target repo base ref, not the PR head.
- Repository config can narrow central policy but cannot expand model lanes or
  raise central budget caps.
- Usage/cost aggregates may be public on 6529.io.
- Private admin controls should live on 6529.io behind the existing 6529 auth
  system.
- `6529reviewbot` owns operational bot secrets.
- `6529.io` owns user/session auth secrets.
- Job lifecycle telemetry is operational audit data and remains separate from
  provider usage/cost rows.
- Ledger schema changes should go through the repeatable schema CLI and release
  docs, not only hand-written SQL snippets in prose.
- Deployment readiness should be checkable without network calls before
  operators start the central App or worker.
- Incident response should have containment-first runbooks that keep private
  payloads, secrets, and attacker-controlled content out of public artifacts.
- Run control should claim budget-admitted jobs before worker dispatch. The
  built-in Aurora-backed claimer serializes claim attempts conservatively for
  dogfood. Dedupe keys must include provider and model so multi-model review
  lanes do not block each other.
- Production server budget checks should use the same isolated usage ledger
  when `REVIEW_USAGE_ENABLED=true`, and the resolver must receive merged
  repository budget policy.
- Run-control claims should be marked `dispatch_failed` or `dispatch_error`
  when queueing fails so failed dispatches do not consume active concurrency
  slots until TTL.
- Model pricing should be operator-maintained through reviewed price files and
  source URLs instead of hardcoded stale prices in the public repo.
- Usage writes should use active provider/model price rows for estimated cost
  only when all applicable token rates are available; missing rates should not
  create partial cost estimates.
- Remote workers need the job `runKey` so they can close durable run-control
  claims after execution; local workers can report terminal claim status
  synchronously.
- Provider-owned docs are the source of truth for key setup, availability, and
  pricing; this repo documents the operational contract and links outward.
- Public support artifacts should collect useful diagnostics while exposing
  secret presence only, never secret values, account IDs, private payloads, or
  target repository data.
- v0 release gates should exist both as prose and as a renderable checklist so
  release candidates are easy to audit.
- Recent job lifecycle diagnostics should be available through the private
  admin API, not through public transparency endpoints or direct browser access
  to Aurora.
- Runtime configuration warnings should be available to private operator
  dashboards through bot-owned APIs backed by preflight, never through direct
  browser access to process environment or secrets.
- Emergency stops and temporary pauses should be central runtime controls that
  run before budget reservation and worker dispatch.
- Maintainer comment commands are part of the public product contract and
  should be documented separately from webhook implementation details.

## Constraints

- Public repository: keep memory and docs free of secrets and private data.
- Use signed commits for 6529 repos.
- Keep PRs focused and mergeable.
- Validate every runtime increment with tests.
- Preserve unrelated user changes in other repos.

## Next Actions

1. Validate, publish, and merge the comment-command docs PR if checks and
   review are clean.
2. Continue dogfood target-repo PRs once required human review completes.
3. Prepare the next release-polish or operator-readiness slice after the
   command contract docs land.

## Open Risks

- GitHub App credentials and deployment target are not created yet.
- 6529.io auth integration contract is defined but not yet wired into
  6529.io production.
- Budget admission now runs per job so provider, model, and review-kind caps
  can differ.
- Public usage summaries require explicit repo/org allowlists before repo names
  are disclosed; otherwise repo detail collapses to `private`.
- Provider pricing rows still need operator verification against current
  provider docs before dogfood release; missing/partial price rows leave usage
  estimates empty.
- Ledger schema, including run claims, still needs to be applied in the target
  Aurora database during deployment.
- Provider pricing rows still require operator verification and key/limit
  setup in provider-owned consoles.
- Public support still requires maintainer moderation if a reporter
  accidentally pastes sensitive data.
- v0 gates still require external operator evidence before tagging.
- Frontend PR #2605 is open and verified locally; all checks are green, but
  merge is still blocked by required human review.
- Private admin UI still needs production wiring to the usage, job-events, and
  status endpoints through the 6529.io auth bridge.
