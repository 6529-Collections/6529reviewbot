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
- Current local changes:
  - `README.md` links to the roadmap
  - `docs/roadmap.md` captures roadmap, budget, 6529.io dashboard, and secret
    ownership decisions
  - `_manager/roadmap-execution/` captures durable workstream memory

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

1. Commit and merge the roadmap/memory docs PR.
2. Create a central app skeleton with webhook verification and event routing.
3. Add policy/admission module and tests.
4. Add budget admission module and tests.
5. Refactor review execution behind a job interface.

## Open Risks

- GitHub App credentials and deployment target are not created yet.
- 6529.io auth integration contract is not defined yet.
- AWS budget/admission queries need to be designed against current ledger
  schema.
- OpenRouter/OpenAI/Anthropic model pricing needs a maintained update process.
