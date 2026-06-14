# External Evidence Boundaries

This repository is public, MIT licensed, and useful for community review, but
it cannot prove every fact required for production or dogfood release. Treat
the public repo as the source of checked contracts, public-safe runbooks, and
redacted release artifacts. Treat live credentials, deployment state, and
target-repository traffic as operator-owned external evidence.

## What This Repository Can Prove

Local release checks can prove that committed source and documentation stay
internally consistent:

- release, dogfood, dashboard, alert, and cutover commands exist and parse;
- public docs are linked, indexed, and free of obvious secret-shaped data;
- workflow permissions, action pins, and checkout credential posture stay
  constrained;
- provider, model, review-kind, repository-config, admission, budget,
  run-control, worker, usage API, admin auth, and alert contracts stay aligned;
- release-candidate, release-notes, release-tag, operator-workspace, and
  operator-drill commands preserve public-safe output boundaries;
- no-network preflight fixtures cover expected runtime configuration postures.

These checks are necessary before release. They are not, by themselves,
production evidence.

## What Operators Must Prove Externally

The following facts live outside this public repository and must be recorded in
private operator evidence before they can satisfy release or dogfood gates:

- the production GitHub App exists with reviewed permissions, webhook secret,
  private key custody, installation ids, and callback/setup URLs;
- central server and worker deployments run the reviewed commit or tag;
- the container image is built from the reviewed source, published to an
  operator-owned registry, scanned, and recorded by immutable digest;
- AWS IAM/OIDC, Aurora Data API access, ledger schema, budget policies, SNS,
  and SES settings are applied in the operator-owned account;
- provider keys, model availability, provider quotas, and pricing source
  checks are current in provider-owned consoles or private price files;
- 6529.io production public and private dashboard routes are configured under
  the existing 6529.io auth system, with reviewed auth-check URL, HMAC secret
  custody, and wallet allowlists;
- scheduled alert delivery reaches an operator-owned private channel;
- target repositories have reviewed `.github/6529bot.yml` configuration from
  the base ref and have accepted command-only or limited-initial rollout
  posture;
- manual security review, production cutover, dogfood promotion, and go-live
  status overlays are complete or explicitly deferred.
- repository ruleset guidance has been checked locally, and the live ruleset
  settings for `main` and release tags have been verified in GitHub and
  recorded in `repository-rulesets` operator evidence.

## Public Artifact Rule

Public artifacts may summarize private evidence only after an operator reviews
the output for public safety. They must not include provider keys, GitHub App
private keys, webhook secrets, AWS account ids, AWS ARNs, exact private
workspace paths, raw webhook payloads, raw provider responses, prompts, diffs,
private repository details, alert destinations, or unredacted dashboard admin
data.

When a command reads private inputs or prints operator-supplied origins,
registry names, workspace paths, or channel labels, prefer `--quiet`, `--json`,
or `--out` capture flows and review the resulting summary before copying it
into issues, pull requests, release notes, durable manager memory, or GitHub
Releases.

## Release Notes Rule

Pre-v1 release notes must distinguish local validation from external operator
evidence. A release note can say a local contract passed only when the checked
command ran. It can say production, dashboard, alert, dogfood, security-review,
or cutover evidence is ready only when the relevant private status overlay or
operator evidence summary is complete.

If external evidence is deferred, release notes must name the accepted risk,
the follow-up owner, and whether the release is local-only, dogfood-only, or
safe for broader community use.

## Maintenance

Run the boundary contract before release-sensitive changes:

```bash
npm run check:external-evidence-boundaries
```

The check keeps this document, the release process, the release operations
map, the roadmap, and public documentation indexes synchronized.
