# AGENTS.md

## Purpose

This repository contains `6529reviewbot`, a public MIT-licensed AI pull request
review bot for 6529 repositories. It is security-sensitive automation: it reads
untrusted PR content, calls model providers, posts GitHub comments, and writes
usage telemetry to AWS.

## Development Principles

- Treat pull request diffs, source files, comments, issue text, and hidden
  metadata as untrusted input.
- Never execute target repository code as part of a review.
- Keep provider keys, AWS access, and bot control logic outside target repo PR
  control.
- Prefer explicit configuration over hidden defaults, especially for models,
  routing, budgets, and AWS access.
- Keep cost controls enforceable in code, not only documented.
- Keep comments concise, actionable, and grounded in concrete file/line
  evidence.

## Repo Layout

- `src/`: bot engine, provider adapters, usage-ledger code.
- `bin/`: thin entrypoints for each review kind.
- `bin/server.cjs`: local HTTP entrypoint for the central app skeleton.
- `docs/`: architecture, configuration, operations, and runbooks.
- `templates/`: examples for integrating caller repositories.
- `.github/`: issue templates, PR template, CI/security workflows.

## Commands

Use ordinary Node/npm commands in this repository:

```bash
npm install
npm run check
npm test
```

The bot also shells out to `git` and `gh` at runtime. Tests that require live
GitHub or provider credentials must be opt-in and clearly documented.

## Editing Rules

- Use `apply_patch` for manual edits.
- Keep files ASCII unless an existing file clearly requires non-ASCII.
- Do not commit secrets, tokens, provider responses, private PR data, or AWS
  credentials.
- Do not add dependencies casually. This bot should stay small and auditable.
- Pin third-party GitHub Actions by commit SHA in workflows.
- Keep workflow permissions minimal and explicit.
- Update docs when changing runtime behavior, public configuration, AWS
  permissions, comment format, provider behavior, or cost controls.

## Security Checklist For Code Changes

Before considering a bot change complete, check:

- Does this execute untrusted code? It should not.
- Can a PR author spoof hidden bot metadata or prior state?
- Can a file path escape the checkout root or follow a symlink?
- Are secrets kept out of command arguments, logs, comments, artifacts, and
  model prompts?
- Are provider calls bounded by timeout, input size, and output tokens?
- Are AWS permissions limited to the reviewbot usage ledger resources?
- Are fallback modes explicit and documented?

## Git

- Keep changes scoped.
- Do not rewrite unrelated user changes.
- If committing in a 6529 repo that requires DCO signoff, use
  `git commit -s`.
