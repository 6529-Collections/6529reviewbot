# Contributing

Thanks for helping improve `6529reviewbot`.

This project is public and MIT licensed, but it is also security-sensitive
automation. Contributions should preserve the bot's trust boundaries and cost
controls.

## Before Opening A PR

1. Fork or branch from `main`.
2. Keep changes focused.
3. Run:

   ```bash
   npm run check
   npm test
   ```

4. Run `npm run release:check` when changing release, config, API, security,
   provider, budget, runtime, worker, workflow, or docs gates.
5. Run `npm run check:external-evidence-boundaries` when public readiness
   language, release artifacts, or operator-evidence summaries change.
6. Run `npm run check:repository-rulesets` when branch protection, required
   checks, release tag guidance, or repository governance changes.
7. Update docs when changing public behavior or configuration.
8. Do not include secrets, raw provider responses, private PR data, or AWS
   credentials in commits, logs, screenshots, issues, or tests.

## Pull Request Expectations

PRs should explain:

- what changed;
- why it changed;
- security implications;
- cost implications;
- validation performed.
- whether the change distinguishes local validation from operator-owned
  evidence when it mentions production, dashboard, alert, dogfood,
  security-review, cutover, branch-protection, or release-tag readiness.

For provider or workflow changes, include a note about:

- token/input/output limits;
- whether untrusted PR content is read or executed;
- whether secrets can reach logs, comments, artifacts, or model prompts.

## Coding Style

- Use plain CommonJS for runtime scripts unless the project explicitly migrates.
- Keep dependencies minimal.
- Prefer explicit, testable helpers over clever shell pipelines.
- Keep GitHub Actions pinned by SHA.
- Do not add broad AWS or GitHub permissions.

## Security Reports

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Release-Sensitive Changes

Use [External Evidence Boundaries](docs/external-evidence-boundaries.md) when
writing public release notes, PR descriptions, roadmap updates, or support
summaries that mention production or dogfood readiness. Local checks prove
repository contracts; live GitHub App settings, AWS state, provider account
settings, 6529.io production auth, alert channels, branch protection, release
tag rulesets, and dogfood traffic remain operator-owned evidence unless a
maintainer records a reviewed public-safe summary.
