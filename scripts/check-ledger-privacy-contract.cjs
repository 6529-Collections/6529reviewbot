#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const ledgerMetadata = require("../src/ledger-metadata.cjs");
const ledgerSchema = require("../src/ledger-schema.cjs");
const jobLedger = require("../src/job-ledger.cjs");
const runControlLedger = require("../src/run-control-ledger.cjs");
const usageApi = require("../src/usage-api.cjs");
const usageApiLedger = require("../src/usage-api-ledger.cjs");
const usageLedger = require("../src/usage-ledger.cjs");

const root = path.resolve(__dirname, "..");

const ledgerPrivacyDocs = [
  "README.md",
  "docs/architecture.md",
  "docs/aws-usage-ledger.md",
  "docs/job-ledger.md",
  "docs/security-model.md",
  "docs/usage-api.md",
  "docs/release-operations-map.md",
  "docs/release-readiness.md",
];

const forbiddenMetadataKeys = [
  "prompt",
  "diffText",
  "providerOutput",
  "providerResponse",
  "webhookPayload",
  "rawWebhook",
  "stdout",
  "stderr",
  "credentials",
  "secret",
  "token",
  "authorization",
  "bad key",
  "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
  "nested",
];

function main() {
  const result = checkLedgerPrivacyContract();
  console.log(
    `ledger privacy ok (${result.ledgers} ledgers, ${result.metadataCases} metadata cases, ${result.docs} docs checked)`
  );
}

function checkLedgerPrivacyContract(options = {}) {
  const findings = [];
  checkMetadataNormalizer(findings);
  checkUsageLedgerBoundary(findings);
  checkJobLedgerBoundary(findings);
  checkRunControlLedgerBoundary(findings);
  checkReadSideApiBoundary(findings);
  checkSchemaBoundary(options.schemaText, findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`ledger privacy contract check found ${findings.length} issue(s).`);
  }

  return {
    ledgers: 3,
    metadataCases: Object.keys(unsafeMetadata()).length,
    docs: ledgerPrivacyDocs.length,
  };
}

function checkMetadataNormalizer(findings) {
  const metadata = ledgerMetadata.normalizeLedgerMetadata(unsafeMetadata(), {
    includeNull: true,
    maxStringChars: 200,
  });
  expectSafeMetadata(metadata, findings, "shared ledger metadata");
  if (metadata.nullish !== null) {
    findings.push("shared ledger metadata must preserve explicit null when includeNull is true.");
  }
  if (metadata.longText.length > 200) {
    findings.push("shared ledger metadata must truncate long strings before persistence.");
  }
  if (!ledgerMetadata.isSafeLedgerMetadataKey("requestor")) {
    findings.push("requestor must be an allowed ledger metadata key.");
  }
  if (ledgerMetadata.isSafeLedgerMetadataKey("prompt")) {
    findings.push("prompt must not be an allowed ledger metadata key.");
  }
  if (ledgerMetadata.isSafeLedgerMetadataKey("github_pat_abcdefghijklmnopqrstuvwxyz1234567890")) {
    findings.push("secret-shaped metadata keys must be rejected.");
  }
}

function checkUsageLedgerBoundary(findings) {
  let captured = null;
  usageLedger.writeUsageEvent(
    configuredLedgerSettings(),
    {
      repoFullName: "6529-Collections/private",
      prNumber: 12,
      prAuthor: "author",
      prHeadSha: "head",
      workflowRunId: "run-1",
      workflowJob: "review-job",
      reviewKind: "security",
      provider: "openai",
      model: "gpt-5.5",
      lane: "openai:gpt-5.5",
      requestId: "request-1",
      providerResponseId: "response-1",
      inputTokens: 10,
      outputTokens: 5,
      metadata: unsafeMetadata(),
    },
    () => {},
    {
      executeStatement: (settings, sql, parameters) => {
        captured = { settings, sql, parameters };
        return {};
      },
    }
  );
  const persisted = metadataParam(captured.parameters);
  expectSafeMetadata(persisted, findings, "usage ledger metadata");
  if (!captured.sql.includes("ai_review_usage_events")) {
    findings.push("usage ledger write must target ai_review_usage_events.");
  }
}

function checkJobLedgerBoundary(findings) {
  const event = jobLedger.normalizeJobLedgerEvent({
    jobId: "job-1",
    status: "dispatch_error",
    stage: "dispatch",
    repoFullName: "6529-Collections/private",
    reviewKind: "security",
    provider: "anthropic",
    model: "claude-opus-4-8",
    reason:
      "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    metadata: unsafeMetadata(),
  });
  if (event.reason.includes("Bearer abcdef") || event.reason.includes("sk-proj-abcdefghijkl")) {
    findings.push("job ledger reason must be redacted before persistence.");
  }
  expectSafeMetadata(event.metadata, findings, "job ledger metadata");
  const insert = jobLedger.buildJobEventInsert("reviewbot", event);
  expectSafeMetadata(metadataParam(insert.parameters), findings, "job ledger insert metadata");
}

function checkRunControlLedgerBoundary(findings) {
  const update = runControlLedger.buildRunClaimStatusUpdate(
    "reviewbot",
    { id: "job-1", runKey: "run-1" },
    "dispatching",
    { metadata: unsafeMetadata() }
  );
  expectSafeMetadata(metadataParam(update.parameters), findings, "run-control ledger metadata");
}

function checkReadSideApiBoundary(findings) {
  const adminUsageEvent = usageApi.normalizeAdminUsageEvent({
    repoFullName: "6529-Collections/private",
    prNumber: 12,
    requestId: "request-1",
    providerResponseId: "response-1",
    prAuthor: "author",
    requestor: "maintainer",
    reviewKind: "security",
    provider: "openai",
    model: "gpt-5.5",
    inputTokens: 10,
    outputTokens: 20,
    metadata: unsafeMetadata(),
  });
  if (Object.prototype.hasOwnProperty.call(adminUsageEvent, "requestId")) {
    findings.push("admin usage event responses must not include provider request IDs.");
  }
  if (Object.prototype.hasOwnProperty.call(adminUsageEvent, "providerResponseId")) {
    findings.push("admin usage event responses must not include provider response IDs.");
  }
  expectSafeMetadata(adminUsageEvent.metadata, findings, "admin usage event metadata");

  const publicSummary = usageApi.summarizeUsageEvents(
    [
      {
        repoFullName: "6529-Collections/private",
        prNumber: 12,
        prAuthor: "author",
        actualCostUsd: 1,
        totalTokens: 100,
        provider: "openai",
        model: "gpt-5.5",
        reviewKind: "security",
        metadata: { requestor: "maintainer" },
      },
    ],
    {
      visibility: "public",
      publicRepos: [],
      publicOrganizations: [],
      maxItems: 10,
    }
  );
  if (Object.prototype.hasOwnProperty.call(publicSummary, "byRequestor")) {
    findings.push("public usage summaries must not include requestor aggregates.");
  }
  if (Object.prototype.hasOwnProperty.call(publicSummary, "byPr")) {
    findings.push("public usage summaries must not include PR aggregates.");
  }
  const publicSummaryText = JSON.stringify(publicSummary);
  if (publicSummaryText.includes("6529-Collections/private") || publicSummaryText.includes("maintainer")) {
    findings.push("public usage summaries must collapse unallowlisted repo/requestor identifiers.");
  }

  const usageQuery = usageApiLedger.buildUsageEventsQuery(
    "reviewbot",
    { from: "2026-06-01T00:00:00.000Z", to: "2026-06-02T00:00:00.000Z" },
    25
  ).sql.toLowerCase();
  for (const forbidden of ["request_id", "provider_response_id"]) {
    if (usageQuery.includes(forbidden)) {
      findings.push(`usage API ledger query must not select ${forbidden}.`);
    }
  }
}

function checkSchemaBoundary(schemaText, findings) {
  const rendered = normalizeWhitespace(schemaText || ledgerSchema.renderLedgerSchema("reviewbot")).toLowerCase();
  for (const forbidden of [
    "prompt",
    "diff",
    "provider_output",
    "provider_response_body",
    "provider_response_text",
    "webhook_payload",
    "stdout",
    "stderr",
    "credential",
    "secret",
  ]) {
    if (rendered.includes(forbidden)) {
      findings.push(`ledger schema must not include a durable '${forbidden}' field.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const requiredBySource = {
    "src/usage-ledger.cjs": [
      "JSON.stringify(normalizeUsageLedgerMetadata(event.metadata))",
      "function normalizeUsageLedgerMetadata",
    ],
    "src/job-ledger.cjs": [
      "normalizeLedgerMetadata(value, { includeNull: true, maxStringChars: 1000 })",
    ],
    "src/run-control-ledger.cjs": [
      "normalizeLedgerMetadata(metadata, { includeNull: false, maxStringChars: 1000 })",
    ],
    "src/ledger-metadata.cjs": [
      "FORBIDDEN_LEDGER_METADATA_KEY_PATTERN",
      "redactSensitiveText(text) !== text",
    ],
  };
  for (const [sourcePath, snippets] of Object.entries(requiredBySource)) {
    const text = sourceTexts[sourcePath] || readText(sourcePath);
    for (const snippet of snippets) {
      if (!text.includes(snippet)) {
        findings.push(`${sourcePath} must include '${snippet}'.`);
      }
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:ledger-privacy"],
    "docs/architecture.md": [
      "The usage, job, and run-control ledgers normalize custom metadata before persistence",
    ],
    "docs/aws-usage-ledger.md": [
      "Usage, job, and run-control ledgers normalize custom metadata before persistence",
      "npm run check:ledger-privacy",
    ],
    "docs/job-ledger.md": [
      "The same ledger metadata normalizer is used before job-event and run-control metadata writes",
    ],
    "docs/security-model.md": [
      "Ledger metadata is treated as untrusted operational input",
    ],
    "docs/usage-api.md": [
      "npm run check:ledger-privacy",
    ],
    "docs/release-operations-map.md": [
      "npm run check:ledger-privacy",
    ],
    "docs/release-readiness.md": [
      "ledger privacy checker",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function unsafeMetadata() {
  return {
    requestor: "maintainer",
    detail:
      "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    prompt: "raw prompt text",
    diffText: "raw diff text",
    providerOutput: "raw provider output",
    providerResponse: "raw provider response",
    webhookPayload: "raw webhook payload",
    rawWebhook: "raw webhook payload",
    stdout: "worker stdout",
    stderr: "worker stderr",
    credentials: "credential payload",
    secret: "secret value",
    token: "token value",
    authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
    "bad key": "bad key value",
    github_pat_abcdefghijklmnopqrstuvwxyz1234567890: "secret-shaped key",
    nested: { prompt: "nested prompt" },
    count: 2,
    ok: true,
    nullish: null,
    longText: "x".repeat(1200),
  };
}

function expectSafeMetadata(metadata, findings, label) {
  const text = JSON.stringify(metadata || {});
  for (const key of forbiddenMetadataKeys) {
    if (Object.prototype.hasOwnProperty.call(metadata || {}, key)) {
      findings.push(`${label} must drop forbidden metadata key '${key}'.`);
    }
  }
  for (const forbidden of [
    "Bearer abcdefghijklmnopqrstuvwxyz123456",
    "sk-proj-abcdefghijkl",
    "raw prompt text",
    "raw diff text",
    "raw provider output",
    "raw webhook payload",
    "worker stdout",
    "worker stderr",
    "credential payload",
    "secret value",
    "token value",
  ]) {
    if (text.includes(forbidden)) {
      findings.push(`${label} leaked forbidden metadata text '${forbidden}'.`);
    }
  }
  if (!metadata.detail.includes("Bearer [redacted]") || !metadata.detail.includes("sk-[redacted]")) {
    findings.push(`${label} must redact common token and provider-key shapes.`);
  }
  if (metadata.count !== 2 || metadata.ok !== true || metadata.requestor !== "maintainer") {
    findings.push(`${label} must preserve safe scalar audit fields.`);
  }
}

function metadataParam(parameters) {
  const param = (parameters || []).find((item) => item.name === "metadata");
  if (!param?.value?.stringValue) {
    throw new Error("metadata parameter was not captured.");
  }
  return JSON.parse(param.value.stringValue);
}

function configuredLedgerSettings() {
  return {
    enabled: true,
    failClosed: true,
    region: "us-east-1",
    resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
    database: "reviewbot",
    schema: "reviewbot",
  };
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkLedgerPrivacyContract,
  ledgerPrivacyDocs,
};
