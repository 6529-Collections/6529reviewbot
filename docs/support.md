# Support Playbook

This playbook explains how maintainers and community users should ask for help
without exposing secrets, private repository data, or provider account details.

## Public Support

Use public GitHub issues for:

- reproducible bugs in this repository;
- documentation gaps;
- provider adapter questions that do not include account details;
- target repository configuration questions with sanitized examples;
- feature requests and design discussion.

Do not use public issues for:

- provider keys, GitHub tokens, webhook secrets, AWS credentials, or database
  ARNs;
- private PR diffs, private repository names, or raw webhook payloads;
- screenshots of provider dashboards or cloud consoles;
- suspected vulnerabilities.

Security issues should follow [SECURITY.md](../SECURITY.md).

## Support Bundle

Generate a sanitized local support bundle:

```bash
npm run support:bundle
```

For automation or private maintainer triage:

```bash
npm run support:bundle -- --json
```

The bundle includes:

- package and runtime version;
- git branch and commit;
- selected safe runtime settings;
- secret/account-linked setting presence as `set` or `unset`, including
  provider keys, GitHub App credentials, central workflow dispatch token
  sources, and central worker repository names;
- preflight errors and warnings.

It does not include secret values. It also does not include target repository
diffs, prompts, provider responses, webhook payloads, private worker
repository names, or absolute local config paths.

Use `--include-git-status` only when file names in your local checkout are safe
to disclose:

```bash
npm run support:bundle -- --include-git-status
```

## Good Bug Reports

Include:

- what command, workflow, or webhook path was involved;
- expected behavior;
- actual behavior;
- sanitized logs or error messages;
- `npm run support:bundle` output;
- whether this is central App mode, local worker mode, or reusable workflow
  mode;
- whether the issue affects spend, secrets, PR comment integrity, or only docs.

For target repository config problems, include a sanitized `.github/6529bot.yml`
or `.6529reviewbot.yml`. Remove private repo names if the repo is not public.

## Maintainer Triage

Suggested first pass:

1. confirm the report does not contain secrets or private payloads;
2. label the area: `review-engine`, `github-app`, `worker`, `provider`,
   `ledger`, `docs`, or `security`;
3. ask for a support bundle if the report is missing runtime context;
4. reproduce locally with `npm run release:check` or a focused command;
5. decide whether the issue is a bug, operator misconfiguration, provider
   outage, roadmap request, or security report.

If a public issue accidentally includes sensitive data, hide or delete the
content through GitHub moderation tools, rotate the exposed secret if needed,
and move the discussion to a private channel.

Before copying support findings into public docs, issues, release notes, or
manager memory, run:

```bash
npm run check:public-artifacts
```

The scan redacts matches in output and fails on live-looking cloud account
ids, ARNs, provider keys, GitHub tokens, AWS access keys, alert webhook URLs,
and private key blocks in public artifacts.

## Escalation

Escalate privately when a report involves:

- possible provider key or GitHub App private-key exposure;
- AWS account identifiers tied to a sensitive incident;
- incorrect budget admission that could cause unexpected spend;
- bot comments that disclose private data;
- exploitable prompt injection or command abuse;
- any vulnerability affecting target repositories.

Use [Incident Response](incident-response.md) for containment steps.
