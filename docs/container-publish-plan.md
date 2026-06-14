# Container Publish Plan

The container publish plan is the dry-run bridge between the checked-in
container image contract and an operator-owned registry publish.

It checks:

- the checked-in `Dockerfile` and `.dockerignore` through
  `npm run check:container-image`;
- that the local checkout is on clean, synced `main`;
- the requested release tag and lowercase image repository shape, without a
  URL scheme, tag, digest, uppercase repository characters, or empty path
  segments in the repository input;
- the build, push, digest capture, vulnerability scan, and private evidence
  steps the operator should run.

It does not build, push, scan, or publish container images.

## Commands

Run the planner after the release checks pass and before building a production
image:

```bash
npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0
```

Use `--require-ready` for the final pre-publish gate. This exits non-zero
unless the local checkout is on clean, synced `main` and the container image
contract passes:

```bash
npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0 --require-ready
```

For automation that wants JSON instead of Markdown:

```bash
npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0 --require-ready --json
```

The output may include the operator-owned registry or image repository. Treat
the raw output as private unless the registry path is already intended for
public release notes.

## Evidence

After the operator runs the printed commands, record these facts in private
operator evidence:

- image digest;
- builder identity;
- source commit;
- vulnerability scan scanner and result;
- any accepted scan findings and follow-up owner;
- runtime smoke evidence such as `/healthz` and strict preflight.

The public release notes should mention only public-safe summaries and link to
the release candidate or operator evidence summary after review.

## Contract

The maintenance check is:

```bash
npm run check:container-publish-plan
```

It verifies the dry-run behavior, clean-main readiness gate, image-reference
validation, CLI flags, release operations map entries, smoke-test wiring, and
public docs.

The check is included in `npm run release:check`.
