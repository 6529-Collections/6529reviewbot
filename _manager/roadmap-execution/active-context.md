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
- Current branch: `codex/review-job-interface`
- Current local changes:
  - explicit review job schema and provider/model lane parsing
  - App-server fanout from admitted GitHub events into per-lane jobs
  - per-job budget admission before queueing
  - review job tests and public documentation

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
3. Add bot API aggregate/admin contracts.
4. Add 6529.io frontend integration.
5. Sweep docs for community-release readiness.

## Open Risks

- GitHub App credentials and deployment target are not created yet.
- 6529.io auth integration contract is not defined yet.
- Budget admission now runs per job so provider, model, and review-kind caps
  can differ.
- OpenRouter/OpenAI/Anthropic model pricing needs a maintained update process.
