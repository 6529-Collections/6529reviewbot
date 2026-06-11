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
- Current branch: `codex/usage-api-ledger-loader`
- Current local changes:
  - shared RDS Data API helper with transient resume/throttle retry
  - read-only usage API Aurora loader for usage events and budget policies
  - server entrypoint auto-wiring when `REVIEW_USAGE_ENABLED=true`
  - public repo/org allowlists before repo names appear in public summaries

## Key Decisions

- Production direction is a central GitHub App named `6529bot`, not per-repo
  bot logic.
- Target repositories should not own provider keys, AWS credentials, or bot
  implementation code.
- Public repos need trusted-actor admission before model calls to prevent
  budget abuse.
- Usage/cost aggregates may be public on 6529.io.
- Private admin controls should live on 6529.io behind the existing 6529 auth
  system.
- `6529reviewbot` owns operational bot secrets.
- `6529.io` owns user/session auth secrets.

## Constraints

- Public repository: keep memory and docs free of secrets and private data.
- Use signed commits for 6529 repos.
- Keep PRs focused and mergeable.
- Validate every runtime increment with tests.
- Preserve unrelated user changes in other repos.

## Next Actions

1. Validate, self-review, and merge the budget admission PR.
2. Refactor review execution behind a job interface.
3. Validate, self-review, and merge the usage API contract PR.
4. Validate, self-review, and merge the Aurora read-side loader PR.
5. Add 6529.io frontend integration.
6. Sweep docs for community-release readiness.

## Open Risks

- GitHub App credentials and deployment target are not created yet.
- 6529.io auth integration contract is not defined yet.
- Budget admission now runs per job so provider, model, and review-kind caps
  can differ.
- Public usage summaries require explicit repo/org allowlists before repo names
  are disclosed; otherwise repo detail collapses to `private`.
- OpenRouter/OpenAI/Anthropic model pricing needs a maintained update process.
