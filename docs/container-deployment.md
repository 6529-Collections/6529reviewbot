# Container Deployment

This guide covers the repository-owned container image for the central
`6529bot` App server.

The image is for the bot-owned backend process: webhook verification,
admission, budget checks, usage/admin APIs, run-control wiring, job ledger
events, and worker dispatch. Target repositories still receive no provider
keys, AWS credentials, GitHub App private keys, or bot implementation code.

## Image Contents

The checked-in `Dockerfile` builds a production runtime image that includes:

- Node.js 22;
- production npm dependencies from `package-lock.json`;
- `bin/`, `src/`, `config/`, and `templates/`;
- `git` and `gh` for local-worker debugging and GitHub Actions worker
  dispatch;
- a non-root `node` runtime user;
- a `/healthz` Docker health check.

It intentionally does not copy docs, manager memory, local checkouts,
`node_modules`, `.env` files, private evidence, or git metadata into the
runtime image.

## Build

Build locally or in a trusted builder:

```bash
docker build -t 6529reviewbot:local .
```

The base image is configurable for operators who pin images by digest:

```bash
docker build \
  --build-arg NODE_IMAGE=node:22-bookworm-slim \
  -t 6529reviewbot:local .
```

For production, publish the reviewed image to an operator-owned registry such
as ECR. Keep the digest, builder identity, source commit, and vulnerability
scan result in the private operator evidence record.

## Runtime Configuration

Run the image with secrets injected by the hosting platform, not baked into the
image:

```bash
docker run --rm \
  --env-file .env.production \
  -p 8080:8080 \
  6529reviewbot:local
```

The server listens on `PORT` or `REVIEWBOT_PORT`, defaulting to `8080`.

Minimum local smoke settings:

```text
REVIEWBOT_GITHUB_WEBHOOK_SECRET=<secret-store-value>
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_REPOSITORY_CONFIG_SOURCE=none
REVIEW_USAGE_ENABLED=false
REVIEWBOT_JOB_LEDGER_ENABLED=false
REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false
```

Production should start from `templates/dogfood-central-env.example`, then
move real values into the platform secret store. Do not commit, copy into the
image, or log:

- GitHub App private keys;
- GitHub webhook secrets;
- provider API keys;
- AWS role, Data API, database, or secret values;
- alert webhooks or SNS destination details;
- admin-auth shared or HMAC secrets.

Use `REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64` rather than a raw multiline key
when the hosting platform handles single-line secrets more reliably.

## Worker Dispatch

The image wires `bin/server.cjs` to the worker adapter selected by
`REVIEWBOT_WORKER_ADAPTER`.

Recommended startup sequence:

1. Deploy with `REVIEWBOT_WORKER_ADAPTER=noop`.
2. Verify `/healthz`, preflight, GitHub App ping, repository config loading,
   admission, budget decisions, and job fanout.
3. Enable `REVIEWBOT_WORKER_ADAPTER=github_actions` only after the central
   review-job workflow has its provider, GitHub App, and AWS secrets.

`github_actions` dispatch uses the bundled `gh` binary. Configure
`REVIEWBOT_WORKER_GITHUB_REPO`, `REVIEWBOT_WORKER_GITHUB_WORKFLOW`, and
`REVIEWBOT_WORKER_GITHUB_REF`, and provide a GitHub credential to the container
environment that can dispatch workflows in the bot repository. Keep that
credential separate from the GitHub App installation tokens used for target
repository checkout and comments.

The `local` adapter can run inside the container for tightly controlled worker
deployments, but it still needs an operator-provided target checkout, `gh`
authentication, provider keys, and AWS settings. Do not use `local` mode for
untrusted target repository code execution.

## Hosting Notes

Use a hosting platform that can provide:

- HTTPS termination for the GitHub webhook URL;
- secret injection from a managed store;
- outbound HTTPS to GitHub, model providers, and AWS Data API;
- private operator logs with retention controls;
- health checks on `/healthz`;
- restart and rollback controls;
- IAM roles or OIDC for AWS access.

For AWS, ECS Fargate or App Runner are both reasonable starting points. Keep
Aurora, Secrets Manager, SNS, and registry identifiers in private operator
runbooks rather than public release notes.

## Verification

Before allowing GitHub webhook traffic:

```bash
npm run preflight -- --strict
```

From outside the container:

```text
GET /healthz
```

Then verify:

- invalid webhook signatures fail;
- GitHub App `ping` deliveries are acknowledged;
- `noop` mode returns explicit queue results without dispatching workers;
- job ledger and run-control settings match the intended release mode;
- admin routes require the 6529.io auth bridge when enabled;
- scheduled alerts run from the same production environment or a separately
  reviewed central job environment.

Use [deployment.md](deployment.md), [install.md](install.md), and
[operator-evidence-template.md](operator-evidence-template.md) for the full
production rollout and evidence flow.

## Rollback

Fast container rollback options:

```text
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_ENABLED=false
REVIEWBOT_PUBLIC_REPO_MODE=off
```

If image rollback is needed, redeploy the prior reviewed image digest and keep
provider keys disabled until webhook replay and budget checks are understood.
