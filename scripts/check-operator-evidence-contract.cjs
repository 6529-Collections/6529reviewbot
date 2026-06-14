#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const operatorEvidence = require("../src/operator-evidence.cjs");
const operatorEvidenceCli = require("../bin/operator-evidence.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/operator-evidence-template.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-candidate.md",
];

function main() {
  const result = checkOperatorEvidenceContract();
  console.log(
    `operator evidence contract ok (${result.cliCases} CLI cases, ${result.evidenceCases} evidence cases, ${result.docs} docs checked)`
  );
}

function checkOperatorEvidenceContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkEvidenceContract(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`operator evidence contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    evidenceCases: 6,
    docs: targetDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = operatorEvidenceCli.parseArgs([
    "--",
    "--file",
    "operator-evidence.json",
    "--json",
    "--summary",
    "--require-ready",
    "--quiet",
  ]);
  if (
    !objectsEqual(parsed, {
      file: "operator-evidence.json",
      json: true,
      quiet: true,
      requireReady: true,
      summary: true,
    })
  ) {
    findings.push(`operator evidence CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => operatorEvidenceCli.parseArgs(["--file"]),
    "--file requires a value.",
    findings
  );
  expectError(
    () => operatorEvidenceCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkEvidenceContract(findings) {
  const skeleton = operatorEvidence.createOperatorEvidenceSkeleton({
    commit: "abc123",
    date: "2026-06-12",
    environment: "dogfood",
    operator: "maintainer",
    privateEvidenceLocation: "private operator runbook",
  });
  const skeletonSummary = operatorEvidence.summarizeOperatorEvidence(skeleton);
  if (
    skeletonSummary.ready ||
    skeletonSummary.pending !== operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length
  ) {
    findings.push("operator evidence pending skeleton must summarize as not ready with every section pending.");
  }

  const completeDocument = completeEvidenceDocument();
  const completeSummary = operatorEvidence.assertOperatorEvidenceReady(completeDocument);
  if (!completeSummary.ready || completeSummary.complete !== completeSummary.total) {
    findings.push("operator evidence complete document must be ready.");
  }

  const deferredDocument = completeEvidenceDocument();
  deferredDocument.sections["github-app"] = {
    status: "deferred",
    notes: "Accepted for dogfood-only release with named owner.",
  };
  const deferredSummary = operatorEvidence.summarizeOperatorEvidence(
    operatorEvidence.validateOperatorEvidence(deferredDocument)
  );
  if (!deferredSummary.ready || !deferredSummary.hasDeferrals) {
    findings.push("operator evidence deferred sections with notes must be ready but flagged as deferrals.");
  }

  expectError(
    () =>
      operatorEvidence.validateOperatorEvidence({
        ...completeEvidenceDocument(),
        sections: {
          ...completeEvidenceDocument().sections,
          "github-app": { status: "complete" },
        },
      }),
    "operator evidence.sections.github-app.evidence must be set when status is complete.",
    findings
  );
  expectError(
    () =>
      operatorEvidence.validateOperatorEvidence({
        ...completeEvidenceDocument(),
        sections: {
          ...completeEvidenceDocument().sections,
          "github-app": { status: "deferred" },
        },
      }),
    "operator evidence.sections.github-app.notes must explain deferred sections.",
    findings
  );
  expectError(
    () =>
      operatorEvidence.validateOperatorEvidence({
        ...completeEvidenceDocument(),
        sections: {
          ...completeEvidenceDocument().sections,
          "unknown-section": { status: "pending" },
        },
      }),
    "operator evidence.sections references unknown section 'unknown-section'.",
    findings
  );
  expectError(
    () => operatorEvidence.assertOperatorEvidenceReady(skeleton),
    /operator evidence is not ready/,
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-operator-evidence-contract-"));
  const evidenceFile = path.join(tempDir, "operator-evidence.json");
  operatorEvidence.writeOperatorEvidenceFile(evidenceFile, skeleton);
  if (!fs.existsSync(evidenceFile)) {
    findings.push("operator evidence writer must create the evidence file.");
  }
  expectError(
    () => operatorEvidence.writeOperatorEvidenceFile(evidenceFile, skeleton),
    `operator evidence file already exists: ${evidenceFile}`,
    findings
  );
}

function checkMarkdownRedaction(findings) {
  const document = completeEvidenceDocument({
    release: "v0.1.0\nsk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    summary: {
      date: "2026-06-12\nrelease day",
      operator: "maintainer\noperator",
      commit: "abc123",
      environment:
        "prod arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      publicSummaryLocation: "public summary",
      privateEvidenceLocation:
        "private runbook 123456789012 Bearer abcdefghijklmnopqrstuvwxyz1234567890",
      releaseGateSummary: "gates\nready",
      releaseGateReadyCheck: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      productionCutoverStatusFile: "cutover status",
      productionCutoverSummary: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
      productionCutoverReadyCheck: "ready",
    },
    evidence: [
      "evidence line one\nline two",
      "cluster arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    ],
    notes: "notes\nwith owner",
  });
  const markdown = operatorEvidence.renderOperatorEvidenceSummaryMarkdown(document);
  const publicJson = JSON.stringify(operatorEvidence.publicOperatorEvidenceDocument(document));
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "2026-06-12\nrelease day",
    "maintainer\noperator",
    "evidence line one\nline two",
    "notes\nwith owner",
  ]) {
    if (markdown.includes(unsafe) || publicJson.includes(unsafe)) {
      findings.push(`operator evidence public output must redact or normalize '${unsafe}'.`);
    }
  }
  for (const expected of [
    "v0.1.0 sk-[redacted]",
    "Bearer [redacted]",
    "[redacted-aws-account-id]",
    "arn:aws:[redacted]",
    "[redacted-github-token]",
    "github_pat_[redacted]",
    "release day",
    "maintainer operator",
    "evidence line one line two",
    "notes with owner",
    "production-deployment-plan",
    "Production Deployment Plan",
  ]) {
    if (!markdown.includes(expected) && !publicJson.includes(expected)) {
      findings.push(`operator evidence public output must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/operator-evidence.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "OPERATOR_EVIDENCE_SECTIONS",
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "status === \"complete\" && evidence.length === 0",
    "Deferred sections must be named in release notes",
    "container-publish-plan",
    "production-deployment-plan",
    "worker-dispatch-credentials",
    "6529-io-public-disclosure",
    "6529-io-private-admin-auth",
    "operator evidence is not ready",
    "replace(/\\r?\\n/g, \" \")",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/operator-evidence.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "--require-ready",
    "Fail unless every section is complete or deferred and none are pending or blocked.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:operator-evidence"],
    "docs/operator-evidence-template.md": [
      "npm run check:operator-evidence",
      "operator evidence contract check",
      "AWS account ids",
      "Container publish plan command",
      "Container publish plan reviewed",
      "Production deployment plan command",
      "Production deployment plan reviewed",
      "Worker dispatch installation id reviewed",
      "Worker dispatch mode",
      "Dispatch-only GitHub App preferred/reviewed",
      "Alert delivery plan command",
      "Alert delivery plan reviewed",
      "Reviewed public repo/org disclosure allowlists",
      "Auth-check URL reviewed",
      "Wallet allowlist evidence reviewed",
    ],
    "docs/release-readiness.md": ["operator evidence contract"],
    "docs/release-operations-map.md": ["npm run check:operator-evidence"],
    "docs/release.md": [
      "npm run check:operator-evidence",
      "operator evidence contract",
    ],
    "docs/release-candidate.md": ["operator evidence checker"],
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

function completeEvidenceDocument(overrides = {}) {
  const summary = {
    date: "2026-06-12",
    operator: "maintainer",
    commit: "abc123",
    environment: "dogfood",
    privateEvidenceLocation: "private operator runbook",
    ...(overrides.summary || {}),
  };
  return {
    version: 1,
    release: overrides.release || "v0.1.0",
    summary,
    sections: Object.fromEntries(
      operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.map((section) => [
        section.id,
        {
          status: "complete",
          evidence: overrides.evidence || [`Reviewed operator evidence for ${section.id}.`],
          ...(overrides.notes ? { notes: overrides.notes } : {}),
        },
      ])
    ),
  };
}

function expectError(fn, expected, findings) {
  try {
    fn();
    findings.push(`expected error '${expected}'.`);
  } catch (error) {
    const message = error.message;
    if (expected instanceof RegExp) {
      if (!expected.test(message)) {
        findings.push(`expected error matching '${expected}', got '${message}'.`);
      }
    } else if (message !== expected) {
      findings.push(`expected error '${expected}', got '${message}'.`);
    }
  }
}

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  checkOperatorEvidenceContract,
  targetDocs,
};
