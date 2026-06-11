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

4. Update docs when changing public behavior or configuration.
5. Do not include secrets, raw provider responses, private PR data, or AWS
   credentials in commits, logs, screenshots, issues, or tests.

## Pull Request Expectations

PRs should explain:

- what changed;
- why it changed;
- security implications;
- cost implications;
- validation performed.

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
