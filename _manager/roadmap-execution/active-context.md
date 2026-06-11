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
- Current branch: `codex/github-app-skeleton`
- Current local changes:
  - app webhook verifier and event normalizer
  - minimal HTTP server entrypoint
  - smoke-test coverage for signed webhook routing
  - GitHub App operator docs

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

1. Validate, self-review, and merge the GitHub App skeleton PR.
2. Add policy/admission module and tests.
3. Add budget admission module and tests.
4. Refactor review execution behind a job interface.
5. Add bot API aggregate/admin contracts.

## Open Risks

- GitHub App credentials and deployment target are not created yet.
- 6529.io auth integration contract is not defined yet.
- AWS budget/admission queries need to be designed against current ledger
  schema.
- OpenRouter/OpenAI/Anthropic model pricing needs a maintained update process.
