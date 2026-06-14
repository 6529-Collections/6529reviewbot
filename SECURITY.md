# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes apply to the `main` branch until a
formal release process is established.

## Reporting A Vulnerability

Please do not open a public issue for suspected vulnerabilities.

Report privately through GitHub's private vulnerability reporting if enabled on
the repository, or contact a 6529 maintainer through the organization's normal
private security channel.

Before broad community release, maintainers should enable GitHub private
vulnerability reporting for this repository or record an equivalent private
security intake channel in operator evidence. Public release notes should not
claim community-release security readiness while private vulnerability intake
is unknown or explicitly deferred.

Useful report details:

- affected file or workflow;
- exploit scenario;
- whether secrets, provider keys, AWS access, or PR comment integrity are
  affected;
- reproduction steps;
- suggested fix, if known.

## Security Boundaries

The bot assumes all target repository PR content is untrusted:

- diffs;
- source files;
- PR titles and bodies;
- issue, review, and inline comments;
- hidden metadata in comments.

The bot must not execute target repository code during review. It may read
files as text to provide model context after path and symlink checks.

## Secrets

Provider keys, GitHub App private keys, GitHub tokens, AWS credentials, Secrets
Manager values, and raw provider diagnostics must not be written to:

- PR comments;
- logs;
- artifacts;
- model prompts;
- test fixtures;
- docs.

## AWS Access

GitHub Actions should use OIDC and a least-privilege IAM role. Long-lived AWS
access keys are not required and should not be configured.

## Dependency And Workflow Security

- Keep dependencies minimal.
- Pin third-party GitHub Actions by commit SHA.
- Use least-privilege workflow permissions.
- Prefer read-only default permissions unless a job explicitly needs write
  access.
