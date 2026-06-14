# Governance

`6529reviewbot` is maintained by 6529 Collections.

## Maintainer Responsibilities

Maintainers are responsible for:

- reviewing code and documentation changes;
- protecting provider and AWS trust boundaries;
- maintaining release tags and workflow pins;
- responding to security reports;
- keeping cost controls and usage-ledger behavior understandable.

## Decision Making

For routine changes, consensus through pull request review is enough.

For changes that affect security boundaries, AWS access, supported providers,
comment contracts, or cost accounting, maintainers should document the decision
in the PR and update the relevant docs.

## Review Ownership

`.github/CODEOWNERS` assigns default review ownership to `@punk6529` until a
dedicated 6529 maintainer team is configured. Before broad community release,
maintainers should either keep that file current or replace the default owner
with the dedicated 6529 maintainer team and update the checked governance docs.

## Releases

Reusable workflow releases should use tags such as `v0`, `v1`, or pinned SHAs.
Downstream repositories should pin to a reviewed tag or SHA rather than an
unreviewed branch.
