# Security Model

## Primary Risks

The main risks are:

- leaking provider keys or GitHub tokens;
- leaking the GitHub App private key;
- leaking AWS credentials or database secrets;
- leaking bot admin signing secrets;
- leaking alert routing secrets or private spend details;
- letting PR authors execute code with secrets;
- trusting spoofed bot metadata;
- accepting forged GitHub webhook deliveries;
- letting PR-controlled config expand model access or budget;
- posting misleading review comments;
- unbounded provider spend;
- duplicate or over-parallel review dispatch;
- exposing private admin usage data;
- reading files outside the target checkout.

## Controls

### No Target Code Execution

The bot reads target files as text. It must not run install, build, test, or
package-manager commands from the target repository.

### Webhook Authenticity

GitHub webhook deliveries must be verified with `X-Hub-Signature-256` before
JSON parsing or event routing. Webhook bodies are capped by
`REVIEWBOT_WEBHOOK_MAX_BODY_BYTES`.

### Admission Before Spend

Public repositories require trusted actors by default. Admission policy runs
before queueing review work, budget checks, or provider calls. If the app has
not resolved actor trust, public repo events fail closed as untrusted.

### Base-Ref Repository Config

Repository config is read from the base ref, not the PR head. A PR author
therefore cannot change `.github/6529bot.yml` in the same PR to unlock more
model lanes, loosen admission, or raise budget. Repo config is also merged
restrictively with central App policy: it can narrow review kinds, select from
allowed lanes, and add tighter caps, but it cannot expand central provider or
budget authority.

### Budget Before Providers

Budget admission runs before queueing review work or calling model providers.
When budget caps are configured, missing spend data fails closed in enforce
mode.

### Run Control Before Dispatch

Run control claims budget-admitted jobs before worker dispatch. It is the
dedupe and concurrency boundary for replayed webhook deliveries, repeated
comment commands, and provider/model fanout. Production claim writes must be
atomic; a stale read-only count is not enough to enforce concurrency under
parallel webhook load.

### Path Safety

Changed-file context rejects:

- absolute paths;
- Windows drive paths;
- parent traversal;
- `.git` paths;
- symlinks;
- paths outside `REVIEW_WORKSPACE`.

### Metadata Trust

Hidden 6529bot markers are trusted only from `REVIEW_TRUSTED_MARKER_AUTHORS`.
This prevents a PR author from planting fake metadata in a comment to steer
follow-up review state.

### Prompt Hygiene

The prompt explicitly treats diffs, code, commits, and comments as untrusted
data. Hidden 6529bot metadata is stripped from prior comments before comments
enter the prompt.

### Provider Safety

Provider requests are bounded by:

- input character caps;
- output token caps;
- changed-file and changed-line budget checks;
- provider timeout;
- sanitized provider error logging;
- empty visible provider output failing closed before comment posting.

### Diagnostic Safety

Worker stdout and stderr are omitted from adapter results by default. When an
operator explicitly opts into diagnostic tails, the adapter redacts common
token and private-key shapes before returning them. GitHub API dispatch failure
bodies are redacted the same way before they can enter queue results or
run-control metadata. Redaction is a guardrail, not permission to publish
verbose worker diagnostics.

### Runtime Control Safety

Runtime control can stop all review automation or pause specific
organizations, repositories, providers, models, or review kinds before budget
reservation and worker dispatch. Operators should use `REVIEWBOT_ENABLED=false`
as the first emergency stop when spend, provider credentials, or model output
looks unsafe.

### AWS Safety

The usage ledger should use:

- GitHub Actions OIDC;
- a repo-scoped IAM trust policy;
- least-privilege RDS Data API permissions;
- a separate Aurora PostgreSQL Serverless v2 cluster;
- no inbound database security-group rules.

Start from the example templates in [infra/aws](../infra/aws/README.md), then
replace placeholders and review final policies in the operator workspace before
applying. The public repo should not contain live account ids, secret ARNs, or
target environment identifiers beyond deliberate examples.

### Reusable Workflow Safety

The reusable workflow is not the preferred production path. If used, callers
must map only the declared provider secrets and must not use `secrets: inherit`.
See [reusable-workflow.md](reusable-workflow.md).

### Admin API Safety

Private admin endpoints fail closed unless an admin authorizer is configured.
The preferred `6529.io` bridge is a short-lived HMAC assertion signed by
server-side 6529 infrastructure after the existing 6529 auth system has
verified the human operator. The HMAC secret must not be exposed to browser
JavaScript, public repo variables, or logs.

### Alerting Safety

Scheduled operator alerts can include private repo names, requestors,
providers, models, current spend, job ids, and failure or stale-claim timing
summaries. Route webhook and SNS notifications through private operator
channels unless the deployment explicitly treats the data as public. Alert
delivery secrets belong to the central bot environment, not target
repositories.

## Review Checklist For Security-Sensitive Changes

- Does the change execute target repo code?
- Can untrusted comments affect hidden metadata state?
- Can a changed file path escape the workspace?
- Can secrets reach provider prompts or PR comments?
- Can bot admin assertions be forged, replayed, or extended beyond the TTL?
- Can alert payloads or notification credentials leak private usage or job data?
- Does the workflow request broader permissions than needed?
- Does repository config still come from the base ref and merge restrictively?
- Does the change increase maximum spend or remove a hard cap?
- Can duplicate webhook deliveries or comment commands bypass run control?
- Does AWS access remain scoped to the usage-ledger resources?
