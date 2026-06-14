#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const diagnostics = require("../src/diagnostics.cjs");

const root = path.resolve(__dirname, "..");

const redactionFixtures = [
  {
    name: "bearer",
    input: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
    expected: "Authorization: Bearer [redacted]",
    forbidden: "abcdefghijklmnopqrstuvwxyz123456",
  },
  {
    name: "aws access key",
    input: "AWS key AKIAABCDEFGHIJKLMNOP",
    expected: "AWS key [redacted-aws-access-key-id]",
    forbidden: "AKIAABCDEFGHIJKLMNOP",
  },
  {
    name: "aws arn",
    input: "resource arn:aws:rds:us-east-1:123456789012:cluster/reviewbot",
    expected: "resource arn:aws:[redacted]",
    forbidden: "123456789012",
  },
  {
    name: "aws account id",
    input: "account 123456789012 reviewed privately",
    expected: "account [redacted-aws-account-id] reviewed privately",
    forbidden: "123456789012",
  },
  {
    name: "github fine-grained token",
    input: "token github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    expected: "token github_pat_[redacted]",
    forbidden: "github_pat_abcdefghijklmnopqrstuvwxyz",
  },
  {
    name: "github classic token",
    input: "token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    expected: "token [redacted-github-token]",
    forbidden: "ghp_abcdefghijklmnopqrstuvwxyz",
  },
  {
    name: "provider key",
    input: "key sk-proj-abcdefghijklmnopqrstuvwx123456",
    expected: "key sk-[redacted]",
    forbidden: "sk-proj-abcdefghijkl",
  },
  {
    name: "slack webhook",
    input: "https://hooks.slack.com/services/T00000000/B00000000/abcdefghijklmnopqrstuvwxyz",
    expected: "[redacted-alert-webhook-url]",
    forbidden: "hooks.slack.com/services",
  },
  {
    name: "discord webhook",
    input: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDE",
    expected: "[redacted-alert-webhook-url]",
    forbidden: "discord.com/api/webhooks",
  },
  {
    name: "private key",
    input: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
    expected: "[redacted-private-key]",
    forbidden: "secret",
  },
];

const diagnosticsDocs = [
  "docs/security-review-checklist.md",
  "docs/support.md",
  "docs/job-ledger.md",
  "docs/alerting.md",
  "docs/release-notes-template.md",
  "README.md",
];
const publicRendererSources = [
  "src/dogfood-promotion.cjs",
  "src/dogfood-readiness.cjs",
  "src/dogfood-target.cjs",
  "src/github-app-manifest-conversion.cjs",
  "src/operator-evidence.cjs",
  "src/operator-workspace.cjs",
  "src/production-cutover.cjs",
  "src/release-candidate.cjs",
  "src/release-gates.cjs",
];

function main() {
  const result = checkDiagnosticsRedaction();
  console.log(
    `diagnostics redaction ok (${result.fixtures} fixtures, ${result.publicRendererSources} public renderers, ${result.docs} docs checked)`
  );
}

function checkDiagnosticsRedaction(options = {}) {
  const findings = [];
  checkRedactionFixtures(findings);
  checkErrorAndTailHelpers(findings);
  checkPublicRendererRedaction(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`diagnostics redaction check found ${findings.length} issue(s).`);
  }

  return {
    fixtures: redactionFixtures.length,
    docs: diagnosticsDocs.length,
    publicRendererSources: publicRendererSources.length,
  };
}

function checkRedactionFixtures(findings) {
  for (const fixture of redactionFixtures) {
    const redacted = diagnostics.redactSensitiveText(fixture.input);
    if (redacted !== fixture.expected) {
      findings.push(`${fixture.name} redaction must produce '${fixture.expected}', got '${redacted}'.`);
    }
    if (redacted.includes(fixture.forbidden)) {
      findings.push(`${fixture.name} redaction leaked forbidden text '${fixture.forbidden}'.`);
    }
  }
}

function checkErrorAndTailHelpers(findings) {
  const error = new Error(
    "first line ghp_abcdefghijklmnopqrstuvwxyz1234567890\nsecond line sk-proj-abcdefghijklmnopqrstuvwx123456"
  );
  const safeLine = diagnostics.safeErrorLine(error);
  if (safeLine.includes("\n")) {
    findings.push("safeErrorLine must keep only the first line.");
  }
  if (!safeLine.includes("[redacted-github-token]")) {
    findings.push("safeErrorLine must redact GitHub tokens.");
  }
  if (safeLine.includes("second line") || safeLine.includes("sk-proj-abcdefghijkl")) {
    findings.push("safeErrorLine must not include later stack/message lines.");
  }

  const objectLine = diagnostics.safeErrorLine({ stack: { not: "a string" } });
  if (objectLine !== "[object Object]") {
    findings.push(`safeErrorLine must tolerate non-string stacks, got '${objectLine}'.`);
  }

  const tail = diagnostics.diagnosticTail(
    `prefix sk-proj-abcdefghijklmnopqrstuvwx123456 ${"x".repeat(80)}TAIL`,
    20
  );
  if (!tail.endsWith("TAIL") || tail.length > 20) {
    findings.push(`diagnosticTail must preserve the bounded tail, got '${tail}'.`);
  }
  if (tail.includes("sk-proj-abcdefghijkl")) {
    findings.push("diagnosticTail must redact before truncating.");
  }
  const defaultTail = diagnostics.tail("abcdef", 3);
  if (defaultTail !== "def") {
    findings.push(`tail helper must return final characters, got '${defaultTail}'.`);
  }
}

function checkPublicRendererRedaction(sourceTexts, findings) {
  for (const source of publicRendererSources) {
    const text = sourceTexts[source] || readText(source);
    if (!text.includes("redactSensitiveText")) {
      findings.push(`${source} must use shared redactSensitiveText for public output.`);
    }
    if (text.includes("PUBLIC_REDACTION_PATTERNS")) {
      findings.push(`${source} must not carry local PUBLIC_REDACTION_PATTERNS; extend src/diagnostics.cjs instead.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "docs/security-review-checklist.md": [
      "support bundles report secret presence",
      "never secret values",
    ],
    "docs/support.md": [
      "common secret-shaped values",
      "does not include secret values",
    ],
    "docs/job-ledger.md": [
      "redact common bearer, GitHub, provider-key, alert-webhook, AWS access-key id, AWS ARN, AWS account-id",
    ],
    "docs/alerting.md": [
      "redacts common bearer, GitHub, provider-key",
      "alert-webhook, AWS access-key id, AWS ARN, AWS account-id",
    ],
    "docs/release-notes-template.md": [
      "Worker diagnostics redact common token, alert-webhook, AWS access-key id, AWS ARN, AWS account-id, and private-key shapes",
    ],
    "README.md": [
      "redact common token, alert-webhook, AWS access-key id, AWS ARN, AWS account-id, and private-key shapes",
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
  checkDiagnosticsRedaction,
  redactionFixtures,
};
