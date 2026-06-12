# Release Notes Template

Use this template for pre-v1 GitHub Releases. Keep the language specific about
what was tested and conservative about what is promised.

```markdown
# 6529reviewbot v0.x.x

Status: pre-v1 dogfood/community-review release.

## Who Should Use This

This release is intended for 6529 maintainers and contributors auditing or
dogfooding `6529bot`. It is not yet a broad production service for arbitrary
repositories.

## Highlights

- Central GitHub App and worker framework for PR review.
- Review modes: general, follow-up, WCAG 2.2 AA, i18n, crypto/security.
- Provider lanes: Anthropic, OpenAI, and OpenRouter through explicit config.
- Public-repo trusted-actor admission before model calls.
- Budget admission and usage telemetry through the isolated reviewbot ledger.
- Run-control claims for duplicate delivery and concurrency protection.
- Empty provider output fails closed before comment posting.
- Worker diagnostics redact common token, alert-webhook, AWS access-key id, and
  private-key shapes.
- Dry-run-by-default Aurora ledger schema tooling.
- Dry-run-by-default model pricing update tooling.
- No-network production preflight command.
- Public/admin usage API contracts for 6529.io surfaces.

## Tested Configuration

- Worker path:
- GitHub Actions dispatch mode:
- GitHub Actions dispatch token source:
- App server runtime:
- Container image digest, if used:
- GitHub App permissions/events:
- Providers/models:
- Default Anthropic model:
- Repository config template:
- Budget mode and caps:
- Run-control mode and caps:
- Ledger schema status:
- Model pricing status:
- Model price source freshness policy:
- Alert delivery:
- Empty provider output fail-closed evidence:
- Worker diagnostic redaction evidence:
- 6529.io dashboard/admin status:
- Preflight result:
- v0 gate checklist:
- v0 gate status file/evidence:
- v0 gate summary:

## Safety Requirements

Public repositories should not enable automatic model calls unless all of these
are true:

- trusted-actor admission is enabled;
- budget mode is `enforce`;
- run-control mode is `enforce`, or the release notes explain why it is
  deferred;
- provider keys and AWS credentials live only in bot-owned infrastructure;
- target repo configuration is loaded from the base ref;
- scheduled operator alerts route to an operator-owned channel.

## Known Gaps

- Production GitHub App deployment:
- 6529.io public dashboard:
- 6529.io private admin UI:
- Dogfood repositories:
- Provider pricing/model update process:
- Accepted model-price overrides:
- Incident response readiness:
- Compatibility guarantees:

## Upgrade Notes

Pre-v1 releases may change worker payloads, hidden metadata, configuration
fields, usage API shapes, comment format, and default fanout behavior. Pin
target repositories to an exact tag or commit SHA and review release notes
before updating.

## Rollback

- Disable the GitHub App installation or repository config.
- Set `REVIEWBOT_WORKER_ADAPTER=noop` or disable central dispatch.
- Set `REVIEWBOT_ENABLED=false` for emergency pause.
- Revert target repository `.github/6529bot.yml` changes if needed.

## Validation

- `npm run release:check`:
- `npm run v0:gates`:
- `npm run preflight -- -- --strict`:
- `npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight`:
- CI:
- Dependency Review:
- OpenSSF Scorecard:
- Manual security checklist:
```
