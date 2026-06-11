# Release Process

This repository will eventually expose a reusable workflow or action consumed
by multiple 6529 repositories.

## Versioning

Before `v1`, downstream repositories should pin to a reviewed commit SHA.

After stabilization:

- `v1` should be a moving major tag for compatible updates;
- minor/patch tags may be added for auditability;
- high-risk adopters may continue pinning exact SHAs.

## Release Checklist

- `npm run check`
- `npm test`
- docs updated
- workflow pins reviewed
- security model reviewed for trust-boundary changes
- AWS/IAM changes documented
- comment contract changes documented
- configuration changes documented

## Breaking Changes

Treat these as breaking:

- changing hidden metadata format;
- changing required provider config;
- changing AWS ledger schema without migration docs;
- changing workflow permissions;
- changing default review fan-out;
- changing skip behavior.
