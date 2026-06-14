# Production Deployment Plan

The production deployment plan is the dry-run operator handoff from reviewed
release artifacts to a controlled production deployment and first dogfood
traffic.

It ties together:

- production GitHub App manifest rendering and private manifest conversion;
- central App container publish planning;
- private operator workspace checks;
- strict runtime preflight and private admin snapshot evidence;
- production cutover, dogfood promotion, and dogfood go-live gates.

It does not create GitHub Apps, convert manifest codes, deploy services, run
checks, or send traffic.

## Commands

Render a placeholder plan while preparing the deployment inputs:

```bash
npm run production:deployment-plan
```

Use explicit inputs for a reviewed operator handoff:

```bash
npm run production:deployment-plan -- -- --host https://reviewbot.example.com --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0
```

Use `--require-ready` for the final handoff gate. This exits non-zero unless
the production bot origin, operator-owned image repository, and private
operator workspace are supplied:

```bash
npm run production:deployment-plan -- -- --host https://reviewbot.example.com --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0 --require-ready
```

Image repository inputs are validated as lowercase Docker image repositories
without a URL scheme, tag, digest, uppercase repository characters, or empty
path segments. The release version supplies the command tag.

For automation that wants JSON instead of Markdown:

```bash
npm run production:deployment-plan -- -- --host https://reviewbot.example.com --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0 --require-ready --json
```

The output can include private deployment origins, registry names, and
operator workspace paths. Treat raw output as private unless each command line
has been reviewed for public release notes or PR descriptions. Prefer
`npm --silent run ...` or `--json --quiet` when capturing output that includes
private paths.

## Operator Flow

The plan intentionally prints commands instead of executing them. Operators
should run the commands in the printed order and record private evidence for
each phase:

- GitHub App registration: App id, installation scope, credential custody, and
  webhook secret presence.
- Container image: image digest, builder identity, source commit, and
  vulnerability scan summary.
- Operator workspace: release-gate, dogfood, security-review,
  production-cutover, and operator-evidence overlay readiness.
- Runtime preflight: strict preflight result and private admin snapshot
  posture without raw rows or secrets.
- Cutover and dogfood: go/no-go output, accepted deferrals, rollback posture,
  and first traffic decision.

The private operator workspace owns the raw evidence. Public release notes
should use redacted summaries, release-candidate bundles, or reviewed status
counts.

## Contract

The maintenance check is:

```bash
npm run check:production-deployment-plan
```

It verifies the dry-run behavior, required-input gate, origin and image
validation, CLI flags, release operations map entries, smoke-test wiring, and
public docs.

The check is included in `npm run release:check`.
