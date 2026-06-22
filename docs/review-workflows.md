# Review Workflows

The bot supports sixteen review modes.

In the central GitHub App, a trigger becomes one or more review jobs. Each job
has one review mode and one lane. Model-backed jobs use provider/model lanes;
the responsiveness job uses the deterministic `github:actions-ubuntu-latest`
lane for GitHub Actions budget accounting. See
[review-jobs.md](review-jobs.md).

Maintainer comment triggers are documented in
[comment-commands.md](comment-commands.md).

## General PR Review

Entrypoint:

```bash
node bin/general-pr-review.cjs
```

Focus:

- correctness regressions;
- production bugs;
- auth, injection, or secret exposure;
- data integrity;
- missing error handling;
- meaningful test gaps.

## Follow-Up Commit Review

Entrypoint:

```bash
node bin/followup-commit-review.cjs
```

Focus:

- newest commit set;
- prior human and bot review comments;
- prior same-kind/same-provider/model 6529bot marker;
- whether prior findings were fixed, ignored, or regressed;
- new issues introduced by follow-up fixes.

## WCAG 2.2 AA Analysis

Entrypoint:

```bash
node bin/wcag-aa-analysis.cjs
```

Focus:

- the 6529 frontend WCAG 2.2 AA standard, read from the PR base ref for
  `6529-Collections/6529seize-frontend` reviews;
- keyboard access;
- focus order and focus visibility;
- semantic buttons/links instead of clickable non-interactive elements;
- accessible names and labels;
- icon-only control names;
- semantic structure;
- dialogs, live regions, and ARIA correctness, including focus movement,
  dismissal, background inertness, and focus restoration;
- contrast, target size, reduced motion, and responsive layout risks.

For 6529 frontend PRs, the prompt also includes deterministic changed-line
review leads for common WCAG hazards such as clickable `div`/`span` elements,
unlabeled form controls, icon-only controls without names, custom dialog
semantics, removed focus outlines, and new autofocus. These leads are not
automatic findings; the model must verify each one against the diff and file
context before reporting it.

## i18n Analysis

Entrypoint:

```bash
node bin/i18n-analysis.cjs
```

Focus:

- the 6529 frontend i18n standard, read from the PR base ref for
  `6529-Collections/6529seize-frontend` reviews;
- 6529 frontend progressive i18n policy;
- `en-US` source/default locale with `en-GB`, `fr-FR`, `es-ES`, and `de-DE`
  fallback dictionaries;
- message-backed visible copy and accessible names through
  `i18n/messages.ts` and `t(locale, key, params)`;
- product-meaning message keys, interpolation, and no translated sentence
  concatenation;
- locale-aware helpers from `i18n/format.ts` and `i18n/locales.ts`, including
  `normalizeLocale`, number/date/percent/relative-time formatting, and
  `compareLocalized`;
- no broad `app/[lang]` migration request during component-level migration;
- no user-generated content translation unless a feature explicitly adds it;
- fallback-debt notes for touched surfaces that are not fully migrated.

For 6529 frontend PRs, the prompt also includes deterministic changed-line
review leads for common localization hazards such as new hardcoded JSX copy,
hardcoded accessible names, direct locale APIs, sentence concatenation, and
unsupported locale identifiers. These leads are not automatic findings; the
model must verify each one against the diff and file context before reporting
it.

## Crypto Security Analysis

Entrypoint:

```bash
node bin/security-analysis.cjs
```

Focus:

- signature replay;
- domain separation;
- nonce handling;
- chain-id confusion;
- wallet identity binding;
- JWT and session handling;
- transaction integrity;
- XSS, SSRF, redirects, injection, and untrusted media.

## Deploy/Actions Review

Entrypoint:

```bash
node bin/deploy-actions-review.cjs
```

Focus:

- GitHub Actions permissions, pinned actions, workflow inputs, and token scope;
- staging/production deploy routing, branch/ref validation, and environment
  selection;
- Serverless, Lambda, EventBridge, SQS, IAM, ECR, Docker, and AWS credential
  boundaries;
- deploy UI and API guardrails for privileged operator actions;
- generated deploy config drift, rollback, and partial-failure paths.

## Auth/API Contract Review

Entrypoint:

```bash
node bin/auth-api-review.cjs
```

Focus:

- route auth requirements, optional-auth behavior, admin/proxy permissions, and
  identity propagation;
- JWT, session, refresh-token, wallet signature, Safe/EIP-1271, nonce, replay,
  and address-normalization behavior;
- OpenAPI generation, generated models, request/response DTOs, error shapes,
  pagination, and compatibility;
- CORS, rate limits, webhook callbacks, route validation, and public/private
  API boundaries;
- contract and authz tests for changed routes.

## DB/Lambda Dataflow Review

Entrypoint:

```bash
node bin/db-lambda-review.cjs
```

Focus:

- TypeORM entities, migrations, generated tables, destructive schema changes,
  and shared table contracts;
- repository transactions, SQL parameterization, read/write pool selection,
  locking, retry, and idempotency;
- Lambda loop scheduling, `dbMigrationsLoop`, concurrency, checkpointing, batch
  sizing, timeout, and recovery;
- SQS, SNS, EventBridge, outbox, payload compatibility, duplicate delivery,
  and dead-letter paths;
- backfill, replay, metrics, and alertable failure modes.

## Media/External Input Review

Entrypoint:

```bash
node bin/media-external-review.cjs
```

Focus:

- S3 keys, bucket privacy, presigned URL constraints, multipart completion,
  content type, and metadata leakage;
- attachment, drop, wave, NFT link, minting-claim, IPFS, Arweave, and
  third-party ingest flows;
- SSRF, redirects, DNS/IP controls, timeout, size, decompression, MIME sniffing,
  HTML/script sanitization, and safe-fetch use;
- Sharp, ffmpeg, image/video/PDF/CSV parsing, malformed-media handling, and
  resource exhaustion;
- retry, idempotency, receipt/status persistence, and hostile-input tests.

## 6529Stream Contract Review

Entrypoint:

```bash
node bin/stream-contracts-review.cjs
```

Focus:

- 6529Stream-only smart contract and release-evidence review;
- drop authorization, EIP-712/ERC-1271, signer epoch, replay, cancellation,
  payer/recipient, sale-mode, and token-data hash invariants;
- auction custody, bidding, settlement, pull-payment, owed/reserved/surplus,
  and emergency-withdraw boundaries;
- randomness provider, request, token, collection, epoch, stale, retry, and
  funding/request-health evidence;
- admin, pause, signer-manager, contract-update, and marker/nonzero
  boundaries;
- `StreamCore` metadata, burn audit, freeze manifest, dependency pin,
  bytecode-spend, and satellite-first policy;
- ABI, bytecode, manifest, checksum, ADR, audit-package, and known-blocker
  evidence drift.

## Safe Write Path Review

Entrypoint:

```bash
node bin/safe-write-review.cjs
```

Focus:

- Safe runtime gating, wallet connection, chain id, Safe address, and explicit
  user intent before any write path;
- typed and constrained transaction builders with allowlisted targets,
  selectors, value, operation type, and argument encoders;
- mainnet or configured-chain enforcement before transaction assembly,
  simulation, copy-to-clipboard, or Safe SDK submission;
- prevention of untrusted route params, query params, API responses, local
  storage, or rendered copy from altering transaction facts;
- consistency across UI text, copied calldata, decoded preview, simulation
  input, and submitted Safe transaction;
- stale owner, threshold, module, nonce, queue, Safe version, and simulation
  preflight risks;
- confused-deputy flows that turn read-only previews or helpers into
  write-capable Safe operations.

## Release And Deployment Review

Entrypoint:

```bash
node bin/release-deploy-review.cjs
```

Focus:

- GitHub Actions permissions, OIDC trust, environments, branch/tag filters,
  reusable workflow inputs, and secret exposure;
- pinned and auditable actions, install scripts, dependency fetches, and
  release tooling for a security-sensitive app;
- deployable artifact provenance such as commit, checksum, manifest, SBOM, or
  equivalent evidence where the workflow expects it;
- S3, CloudFront, Route53, WAF, CSP, CORS, cache invalidation, and origin
  boundary changes;
- wrong bucket or distribution targets, stale artifacts, accidental production
  publishes, and silent fallback to local or default credentials;
- staging versus production and canonical-origin ambiguity.

## Privacy And Evidence Review

Entrypoint:

```bash
node bin/privacy-evidence-review.cjs
```

Focus:

- wallet addresses, Safe owners, thresholds, transaction hashes, signatures,
  calldata, session identifiers, support artifacts, and public evidence;
- logs, analytics, error reporting, screenshots, artifacts, model prompts, and
  PR comments that could leak sensitive wallet or transaction material;
- support bundles and audit evidence that must redact or minimize user-specific
  data while preserving reproducible public facts;
- privacy notices, retention controls, and exported records matching actual
  collection behavior;
- hidden telemetry, fingerprinting, broad local storage, or provider calls on
  signer-critical paths;
- accidental disclosure in markdown, runbooks, workflow logs, private
  endpoints, raw provider responses, or internal evidence URLs.

## Signer UX Review

Entrypoint:

```bash
node bin/signer-ux-review.cjs
```

Focus:

- signer-critical screens showing human meaning, affected collection or
  contract, action, amount or value, chain, target address, and consequences;
- warnings, disabled states, copy, decoded calldata, simulation summaries, and
  final submit controls that must not contradict each other;
- dangerous or irreversible action blockers and confirmations;
- long, translated, responsive, and assistive-technology presentations of
  signer-critical facts;
- loading, error, stale data, unsupported Safe, wrong network, and simulation
  failure states that should stop ambiguous signing;
- keyboard, focus, and accessible-name behavior where it affects a signer
  decision.

## GLM Swarm Review

Entrypoint:

```bash
node bin/glm-swarm-review.cjs
```

Focus:

- advisory OpenRouter GLM 5.2 review fanout;
- risk-selected narrow internal reviewer threads;
- one synthesized GitHub comment titled `6529bot GLM Swarm Review`;
- Codex feedback loops for focused deterministic checks;
- no replacement of existing tests, responsiveness checks, or Opus-backed
  reviewbot lanes.

The GLM swarm kind is opt-in. It is not included in the default initial
review set or `/6529bot review all`. Job fanout pins it to
`openrouter:z-ai/glm-5.2` regardless of the configured Opus lanes, so enabling
it does not modify or remove existing Anthropic reviewbot lanes.

The runner applies the same untrusted-PR source restrictions as the main
review engine, enforces PR-size, token, thread, and actual-cost caps, records
prompt version and prompt hashes in hidden metadata, and can retain raw
internal reviewer/synthesis outputs only in configured S3 operator
infrastructure. Raw GLM outputs must not be committed or stored through Git
LFS.

## Responsiveness Review

Entrypoint:

```bash
node bin/responsiveness-review.cjs
```

The central worker dispatches responsiveness jobs to
`.github/workflows/responsiveness-review.yml`. The benchmark job runs target PR
frontend code on GitHub-hosted `ubuntu-latest` without model provider keys. A
separate comment job posts the 6529bot result with provider `github`, model
`actions-ubuntu-latest`, and zero token usage.

Focus:

- changed-route web desktop and mobile viewport regressions;
- native mobile shell behavior under Capacitor shims;
- Electron desktop shell behavior under Electron user-agent shims;
- horizontal overflow, visible framework error overlays, navigation failures,
  and fatal console errors;
- deterministic runner findings only.

## Comment Format

Visible comments should begin with:

```md
**Verdict**: <allowed verdict>
```

Findings should be grouped only when needed:

```md
### Critical
### Important
### Nice-to-have
### Resolved since last review
```

The bot omits empty sections.

See [Review Comment Format](review-comment-format.md) for the full visible
comment, hidden metadata, and budget-skip contract.
