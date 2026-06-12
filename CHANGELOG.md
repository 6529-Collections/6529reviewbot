# Changelog

All notable changes to this project will be documented here.

This project follows a lightweight changelog format inspired by Keep a
Changelog. Versioning will become formal once the reusable workflow API is
stabilized.

## Unreleased

- Initial public MIT repository structure, governance, security, support, and
  contribution docs.
- Standalone review engine for general, follow-up, WCAG 2.2 AA, i18n, and
  crypto/security review modes.
- Provider configuration for Anthropic, OpenAI, and OpenRouter.
- GitHub App webhook skeleton with signature verification and normalized PR
  and comment-command events.
- GitHub App installation-token handling for repository config reads and actor
  permission resolution.
- Timeout handling and fail-closed hardening for GitHub App API calls.
- Trusted-actor admission for public repositories.
- Budget admission against the isolated AWS usage ledger.
- Review job fanout across review kinds and provider/model lanes.
- Base-ref repository config loading and restrictive policy merge.
- Local and central GitHub Actions worker adapters.
- Public/admin usage API contracts and read-only Aurora usage readers.
- 6529.io admin auth bridge contract.
- Scheduled spend alerts for budget utilization and unusual spend spikes.
- Documentation for architecture, configuration, operations, release readiness,
  security model, AWS usage ledger, repository config, worker adapters, and
  alerting.
