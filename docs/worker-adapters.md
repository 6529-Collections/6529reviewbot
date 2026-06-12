# Worker Adapters

Worker adapters bridge admitted review jobs to executable work.

The App still owns webhook verification, admission, budget checks, and job
fanout. A worker adapter starts only after a job has passed those gates.
`bin/server.cjs` wires the configured adapter into the production App server
entrypoint.

## Modes

```text
REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions
```

`noop` is the default. It acknowledges that no worker is configured and does
not execute anything.

`local` runs the existing review CLI entrypoint in the current bot checkout.
This is useful for development, controlled workers, and one-shot job replay.

`github_actions` dispatches a workflow in the central bot repository with the
job fields as workflow inputs. This is a bridge toward central execution while
keeping provider keys and AWS credentials out of target repositories.

## Local Worker

```text
REVIEWBOT_WORKER_ADAPTER=local
REVIEWBOT_WORKER_NODE_BIN=
REVIEWBOT_WORKER_CWD=
REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS=900000
```

The local adapter invokes the correct script under `bin/` for the job's review
kind:

```text
general  -> bin/general-pr-review.cjs
followup -> bin/followup-commit-review.cjs
wcag     -> bin/wcag-aa-analysis.cjs
i18n     -> bin/i18n-analysis.cjs
security -> bin/security-analysis.cjs
```

Workers must provide a safe `REVIEW_WORKSPACE` containing the target checkout.
The review engine reads files as text and still enforces its own context and
path limits.

## GitHub Actions Worker

```text
REVIEWBOT_WORKER_ADAPTER=github_actions
REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot
REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml
REVIEWBOT_WORKER_GITHUB_REF=main
REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=auto|api|gh
REVIEWBOT_WORKER_GITHUB_TOKEN=
REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID=
REVIEWBOT_WORKER_GITHUB_APP_ID=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY=
REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64=
REVIEWBOT_WORKER_GITHUB_API_URL=https://api.github.com
REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS=10000
REVIEWBOT_WORKER_GH_BIN=gh
```

Dispatch mode defaults to `auto`. When `REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID`
is set, the server can mint a short-lived installation token for the central
bot repository and dispatch through GitHub's REST API. Prefer a separate
dispatch-only GitHub App configured through `REVIEWBOT_WORKER_GITHUB_APP_*`
and installed only on the bot repository with `Actions: write`. If those
worker-specific credentials are blank, the server reuses the main GitHub App
credentials, which requires accepting `Actions: write` on every repository
where that App is installed. `REVIEWBOT_WORKER_GITHUB_TOKEN`, `GH_TOKEN`, or
`GITHUB_TOKEN` can be used as an explicit bot-owned dispatch token fallback.
Without either token source, `auto` falls back to the `gh` CLI for
compatibility with older operator environments.

Use `api` in production container deployments so preflight fails closed if the
App installation id or dispatch token is missing. Use `gh` only for local
compatibility or operator workstations that intentionally manage GitHub CLI
authentication.

The dispatch token source must be bot-owned and scoped only to dispatch
workflows in the central bot repository. It is separate from the short-lived
GitHub App installation tokens that workers mint for target repository
checkout and comments.

The dispatch fields are:

```text
job_id
run_key
installation_id
target_repo
head_repo
pr_number
head_sha
review_kind
provider
model
lane
requestor
```

`run_key` is the durable run-control claim key. The central worker uses it to
mark the claim `running`, then `completed` or `failed`.

`installation_id` is the target repository's GitHub App installation id. The
central workflow uses it to mint a short-lived installation token for target
checkout and PR comments.

`target_repo` is the repository that owns the PR and receives comments.
`head_repo` is the repository that owns the submitted head SHA, which can differ
for fork PRs.

The receiving workflow should validate the inputs, mint a short-lived
installation token, check out `head_repo` at `head_sha` read-only, set
provider/AWS secrets from the central bot environment, and run:

```bash
npm run worker:job -- -- --job-file job.json
```

or pipe the same job JSON to:

```bash
node bin/run-review-job.cjs
```

See `templates/review-job-workflow.yml` for a starter workflow. The template
uses `REVIEWBOT_GITHUB_APP_ID` and `REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64`
to mint the target installation token. A long-lived target repository token is
not required. Same-repo PR checkouts use the installation token; fork PR
checkouts are unauthenticated and therefore suitable only for public forks
unless the worker is extended with an explicitly approved fork access path.

The template pins third-party actions by commit SHA, disables persisted checkout
credentials, configures an operator-provided AWS OIDC role when
`REVIEW_USAGE_AWS_ROLE_ARN` is set, and adds a workflow-level concurrency group
by `run_key`. Keep those controls when copying the template into the central
bot repository.

The template defaults to a 20 minute job timeout. Override it with:

```text
REVIEWBOT_WORKER_TIMEOUT_MINUTES=20
```

Use [worker-capacity.md](worker-capacity.md) for the production scaling policy,
backpressure controls, starting concurrency caps, and worker evidence.

Validate action pinning locally with:

```bash
npm run check:workflow-actions
```

## Worker Environment

Every local worker receives:

```text
GH_REPO
GITHUB_REPOSITORY
PR_NUMBER
GITHUB_PR_NUMBER
PR_HEAD_SHA
REVIEW_KIND
REVIEW_PROVIDER
REVIEW_MODEL
REVIEWBOT_JOB_ID
REVIEWBOT_RUN_KEY
REVIEWBOT_JOB_LANE
REVIEWBOT_DELIVERY_ID
REVIEWBOT_GITHUB_INSTALLATION_ID
REVIEWBOT_REQUESTOR
```

Provider keys, GitHub App credentials, and AWS credentials remain owned by the
bot backend or worker environment. Target repositories do not receive them.

## Failure Behavior

Adapters return a structured result for every job. A dispatch failure does not
call a provider; it is visible in the queue result returned by the App. The
App can also persist budget and dispatch lifecycle rows to the job ledger so
retries, alerts, and dashboards can reason about failed dispatches after the
webhook response is gone. See [job-ledger.md](job-ledger.md).

Local workers run synchronously, so their adapter results can mark run-control
claims `completed` or `failed` immediately. GitHub Actions workers are
asynchronous; the App marks them `dispatching`, and `bin/run-review-job.cjs`
closes the claim from inside the workflow.

Worker stdout and stderr are not included in adapter results by default. This
keeps webhook responses and queue logs from accidentally carrying prompt text,
provider output, or credentials. Local debugging callers may opt into output
tails explicitly. Those diagnostic tails and GitHub API dispatch error bodies
are redacted for common token and private-key shapes before they are returned,
but operators should still avoid routing verbose worker diagnostics to public
logs or comments.
