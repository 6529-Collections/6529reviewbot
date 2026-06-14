#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const diagnostics = require("../src/diagnostics.cjs");
const dogfoodPromotion = require("../src/dogfood-promotion.cjs");
const dogfoodReadiness = require("../src/dogfood-readiness.cjs");
const dogfoodTarget = require("../src/dogfood-target.cjs");
const githubAppManifestConversion = require("../src/github-app-manifest-conversion.cjs");
const operatorEvidence = require("../src/operator-evidence.cjs");
const operatorWorkspace = require("../src/operator-workspace.cjs");
const productionCutover = require("../src/production-cutover.cjs");
const releaseCandidate = require("../src/release-candidate.cjs");
const releaseGates = require("../src/release-gates.cjs");

const root = path.resolve(__dirname, "..");

const redactionFixtures = [
  {
    name: "bearer",
    input: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
    expected: "Authorization: Bearer [redacted]",
    forbidden: "abcdefghijklmnopqrstuvwxyz123456",
  },
  {
    name: "basic auth header",
    input: "Authorization: Basic dXNlcjpwYXNzd29yZDEyMzQ1",
    expected: "Authorization: Basic [redacted]",
    forbidden: "dXNlcjpwYXNz",
  },
  {
    name: "api key header",
    input: "x-api-key: providerkeyabcdefghijklmnop",
    expected: "x-api-key: [redacted]",
    forbidden: "providerkey",
  },
  {
    name: "admin signature header",
    input: "x-6529-admin-signature: sha256=abcdefghijklmnopqrstuvwxyz123456",
    expected: "x-6529-admin-signature: [redacted]",
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
const publicRendererBehaviorChecks = [
  {
    name: "dogfood promotion",
    render: dogfoodPromotion.publicText,
  },
  {
    name: "dogfood readiness",
    render: dogfoodReadiness.publicText,
  },
  {
    name: "dogfood target",
    render: dogfoodTarget.publicText,
  },
  {
    name: "GitHub App manifest conversion",
    render: githubAppManifestConversion.safeSummaryText,
  },
  {
    name: "operator evidence",
    render: operatorEvidence.publicEvidenceText,
  },
  {
    name: "operator workspace",
    render: operatorWorkspace.publicText,
  },
  {
    name: "production cutover",
    render: productionCutover.publicCutoverText,
  },
  {
    name: "release candidate",
    render: releaseCandidate.publicText,
  },
  {
    name: "release gates",
    render: releaseGates.publicReleaseGateText,
  },
];

function main() {
  const result = checkDiagnosticsRedaction();
  console.log(
    `diagnostics redaction ok (${result.fixtures} fixtures, ${result.publicRendererSources} public renderers, ${result.publicRendererBehaviorCases} renderer behavior cases, ${result.docs} docs checked)`
  );
}

function checkDiagnosticsRedaction(options = {}) {
  const findings = [];
  checkRedactionFixtures(findings);
  checkErrorAndTailHelpers(findings);
  checkPublicRendererRedaction(options.sourceTexts || {}, findings);
  checkPublicRendererBehavior(findings);
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
    publicRendererBehaviorCases: publicRendererBehaviorChecks.length,
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

function checkPublicRendererBehavior(findings) {
  const input = [
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
    "token github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    "key sk-proj-abcdefghijklmnopqrstuvwx123456",
    "resource arn:aws:rds:us-east-1:111122223333:cluster/reviewbot",
    "account 111122223333",
  ].join("\n");
  const expected = [
    "Bearer [redacted]",
    "github_pat_[redacted]",
    "sk-[redacted]",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
  ];
  const forbidden = [
    "abcdefghijklmnopqrstuvwxyz123456",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "sk-proj-abcdefghijkl",
    "arn:aws:rds",
    "111122223333",
  ];
  for (const renderer of publicRendererBehaviorChecks) {
    const output = String(renderer.render(input));
    for (const snippet of expected) {
      if (!output.includes(snippet)) {
        findings.push(`${renderer.name} public renderer must include redacted snippet '${snippet}'.`);
      }
    }
    for (const snippet of forbidden) {
      if (output.includes(snippet)) {
        findings.push(`${renderer.name} public renderer leaked forbidden text '${snippet}'.`);
      }
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
      "Worker diagnostics redact common token, sensitive-header, alert-webhook, AWS access-key id, AWS ARN, AWS account-id, and private-key shapes",
    ],
    "README.md": [
      "redact common token, sensitive-header, alert-webhook, AWS access-key id, AWS ARN, AWS account-id, and private-key shapes",
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
