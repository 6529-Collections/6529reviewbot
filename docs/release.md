# Release Process

This repository ships the central `6529bot` App/worker implementation and
keeps workflow scaffolds for dogfood and compatibility.

## Versioning

Before `v1`, downstream repositories and dogfood workflows should pin to a
reviewed commit SHA or explicit pre-release tag.

After stabilization:

- `v1` should be a moving major tag for compatible updates;
- minor/patch tags may be added for auditability;
- high-risk adopters may continue pinning exact SHAs.

## Release Checklist

- [Release readiness](release-readiness.md) reviewed
- `npm run check`
- `npm test`
- `git diff --check`
- YAML parse for workflow and template files
- docs updated
- workflow pins reviewed
- security model reviewed for trust-boundary changes
- AWS/IAM changes documented
- comment contract changes documented
- configuration changes documented
- alerting and admin-auth changes documented
- release-readiness checklist reviewed
- CodeRabbit or equivalent review feedback resolved
- CI, Dependency Review, and OpenSSF Scorecard reviewed

## Breaking Changes

Treat these as breaking:

- changing hidden metadata format;
- changing required provider config;
- changing AWS ledger schema without migration docs;
- changing workflow permissions;
- changing default review fan-out;
- changing skip behavior.
- changing admin auth canonical signing payloads;
- changing alert payload shape or delivery guarantees.

## Pre-v1 Release Notes

Every pre-v1 release should say:

- whether it is safe only for dogfood or for broader community testing;
- which worker path is supported;
- which providers and model defaults were tested;
- which budget and admission defaults are recommended;
- which known production gaps remain.
