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
- sanitized provider error logging.

### AWS Safety

The usage ledger should use:

- GitHub Actions OIDC;
- a repo-scoped IAM trust policy;
- least-privilege RDS Data API permissions;
- a separate Aurora PostgreSQL Serverless v2 cluster;
- no inbound database security-group rules.

### Admin API Safety

Private admin endpoints fail closed unless an admin authorizer is configured.
The preferred `6529.io` bridge is a short-lived HMAC assertion signed by
server-side 6529 infrastructure after the existing 6529 auth system has
verified the human operator. The HMAC secret must not be exposed to browser
JavaScript, public repo variables, or logs.

### Alerting Safety

Scheduled spend alerts can include private repo names, requestors, providers,
models, and current spend. Route webhook and SNS notifications through private
operator channels unless the deployment explicitly treats the data as public.
Alert delivery secrets belong to the central bot environment, not target
repositories.

## Review Checklist For Security-Sensitive Changes

- Does the change execute target repo code?
- Can untrusted comments affect hidden metadata state?
- Can a changed file path escape the workspace?
- Can secrets reach provider prompts or PR comments?
- Can bot admin assertions be forged, replayed, or extended beyond the TTL?
- Can alert payloads or notification credentials leak private usage data?
- Does the workflow request broader permissions than needed?
- Does repository config still come from the base ref and merge restrictively?
- Does the change increase maximum spend or remove a hard cap?
- Does AWS access remain scoped to the usage-ledger resources?
