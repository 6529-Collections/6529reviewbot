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
- Current branch: `codex/run-claim-completion`
- Current local changes: worker completion updates for durable run-control
  claims, plus docs/tests/template updates

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

## Constraints

- Public repository: keep memory and docs free of secrets and private data.
- Use signed commits for 6529 repos.
- Keep PRs focused and mergeable.
- Validate every runtime increment with tests.
- Preserve unrelated user changes in other repos.

## Next Actions

1. Validate, publish, and merge the run-claim completion PR if checks and
   review are clean.
2. Continue dogfood target-repo PRs once required human review completes.
3. Prepare the next release-polish or operator-readiness slice after the
   model price tooling PR lands.

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
- Durable run-claim completion depends on central workers receiving `runKey`
  and run-control ledger environment variables.
- Frontend PR #2605 is open and verified locally; all checks are green, but
  merge is still blocked by required human review.
