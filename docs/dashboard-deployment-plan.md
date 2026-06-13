# 6529.io Dashboard Deployment Plan

The dashboard deployment plan is the dry-run operator handoff for wiring the
merged 6529.io public usage and private admin dashboard routes to a production
`6529reviewbot` deployment.

It ties together:

- the reviewed `templates/6529-io-reviewbot-env.example` environment shape;
- 6529.io server-side auth-check and wallet allowlist configuration;
- central bot public usage disclosure and HMAC admin auth settings;
- public Open Data and private admin route verification;
- admin snapshot, production cutover, release-candidate, and release-note
  evidence.

It does not deploy 6529.io, create secrets, call auth endpoints, run checks,
or expose dashboards.

## Commands

Render a placeholder plan while preparing private deployment inputs:

```bash
npm run dashboard:deployment-plan
```

Use explicit inputs for a reviewed 6529.io handoff:

```bash
npm run dashboard:deployment-plan -- -- --frontend-origin https://6529.io --bot-origin https://reviewbot.example.com --operator-workspace <private-workspace-dir> --auth-check-url https://6529.io/api/auth/reviewbot --release v0.1.0
```

Use `--require-ready` for the final dashboard handoff gate. This exits
non-zero unless the 6529.io origin, production bot origin, private operator
workspace, and 6529.io server-side auth-check URL are supplied:

```bash
npm run dashboard:deployment-plan -- -- --frontend-origin https://6529.io --bot-origin https://reviewbot.example.com --operator-workspace <private-workspace-dir> --auth-check-url https://6529.io/api/auth/reviewbot --release v0.1.0 --require-ready
```

For automation that wants JSON instead of Markdown:

```bash
npm run dashboard:deployment-plan -- -- --frontend-origin https://6529.io --bot-origin https://reviewbot.example.com --operator-workspace <private-workspace-dir> --auth-check-url https://6529.io/api/auth/reviewbot --release v0.1.0 --require-ready --json
```

The output can include private deployment origins, auth endpoint paths, and
operator workspace paths. Treat raw output as private unless each command line
has been reviewed for public release notes or PR descriptions. Prefer
`npm --silent run ...` or `--json --quiet` when capturing output that includes
private paths.

## Operator Flow

The plan intentionally prints handoff steps instead of executing them.
Operators should complete the steps in the printed order and record private
evidence for each phase:

- 6529.io environment: copy the reviewed template into the private 6529.io
  deployment config, set `REVIEWBOT_USAGE_API_BASE_URL`, wallet allowlists,
  the 6529.io auth-check URL, and the shared HMAC secret only in private
  config.
- Bot admin auth: set `REVIEWBOT_USAGE_API_PUBLIC_ORGS` for intentional public
  repo-name disclosure, enable public summaries, and configure HMAC admin auth
  with the same private secret and `reviewbot-admin` role used by 6529.io.
- Dashboard verification: verify the public `/open-data/6529bot` page renders
  only allowlisted summaries and the private `/tools/6529bot/admin` page
  requires 6529.io auth before calling admin endpoints.
- Cutover evidence: update the private production cutover status and
  release-candidate evidence so dashboard configuration, deployment, HMAC
  bridge wiring, and operator verification are complete or explicitly
  deferred.
- Release notes: summarize dashboard status publicly without publishing wallet
  allowlists, internal auth endpoints, HMAC secrets, raw admin rows, or private
  operator paths.

The private operator workspace owns the raw evidence. Public release notes
should use redacted summaries, release-candidate bundles, or reviewed status
counts.

## Contract

The maintenance check is:

```bash
npm run check:dashboard-deployment-plan
```

It verifies the dry-run behavior, required-input gate, origin and auth-check
URL validation, route and org allowlist validation, CLI flags, release
operations map entries, smoke-test wiring, and public docs.

The check is included in `npm run release:check`.
