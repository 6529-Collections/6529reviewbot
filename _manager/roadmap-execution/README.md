# 6529reviewbot Roadmap Execution

## Charter

Own the `6529reviewbot` roadmap from public foundation to a polished,
community-ready system. Work autonomously in focused, mergeable increments with
evidence-backed validation and repeated self-review.

## Primary Objective

Complete the roadmap captured in `docs/roadmap.md`:

- central GitHub App execution model;
- policy and admission controls;
- budget management before model calls;
- public transparency and private 6529.io admin UX contracts;
- product command/config contract;
- secret ownership boundaries;
- security hardening;
- operations and community-release polish.

## Reload Order

After compaction or a new session, read:

1. `_manager/roadmap-execution/active-context.md`
2. `_manager/roadmap-execution/run-log.md`
3. `docs/roadmap.md`
4. `AGENTS.md`
5. `README.md`
6. current branch, `git status -sb`, and open PR/CI status

## Owned Paths

- `src/`
- `bin/`
- `docs/`
- `scripts/`
- `templates/`
- `.github/`
- `_manager/roadmap-execution/`
- package metadata and project config

Frontend integration may touch `D:\repos\6529seize-frontend` later, but only
after the bot API contract is clearer.

## Forbidden Paths And Data

- Do not commit provider keys, GitHub App private keys, webhook secrets, AWS
  credentials, live DB secrets, private repo data, or raw provider payloads.
- Do not run target repository code while gathering review context.
- Do not weaken workflow permissions or policy checks for convenience.
- Do not revert unrelated user changes in any repo.

## Evidence Standard

Each shipped increment should include:

- exact files changed;
- validation commands and results;
- security/privacy review notes where relevant;
- PR URL and merge commit once merged;
- residual risks or follow-up decisions.

## Escalation Triggers

Ask the user only for:

- secrets or production credentials that cannot be inferred safely;
- irreversible product choices not already covered by the roadmap;
- destructive infrastructure actions;
- permission failures that require account-owner action;
- deployment/installation steps that could affect production users.
