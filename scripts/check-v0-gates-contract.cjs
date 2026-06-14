#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const releaseGates = require("../src/release-gates.cjs");
const releaseGatesCli = require("../bin/v0-gates.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/v0-release-plan.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-candidate.md",
];

function main() {
  const result = checkV0GatesContract();
  console.log(
    `v0 release gates contract ok (${result.cliCases} CLI cases, ${result.statusCases} status cases, ${result.docs} docs checked)`
  );
}

function checkV0GatesContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkStatusContract(findings);
  checkGateConfig(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`v0 release gates contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    statusCases: 6,
    docs: targetDocs.length,
  };
}

function checkGateConfig(findings) {
  const gates = releaseGates.loadReleaseGates(path.join(root, "config/v0-release-gates.json"));
  const gatesById = new Map(gates.gates.map((gate) => [gate.id, gate]));
  const serverWorkerGate = gatesById.get("server-worker");
  if (!serverWorkerGate) {
    findings.push("v0 release gates must include 'server-worker'.");
  } else {
    if (serverWorkerGate.evidence !== "docs/worker-capacity.md") {
      findings.push("server-worker gate evidence must be docs/worker-capacity.md.");
    }
    const serverWorkerTitle = normalizeWhitespace(serverWorkerGate.title).toLowerCase();
    for (const snippet of [
      "reviewed worker capacity policy",
      "dispatch credential evidence",
      "dispatch-only github app",
      "fallback explicitly accepted",
    ]) {
      if (!serverWorkerTitle.includes(snippet)) {
        findings.push(`server-worker gate title must require ${snippet}.`);
      }
    }
  }
  const containerImageGate = gatesById.get("container-image");
  if (!containerImageGate) {
    findings.push("v0 release gates must include 'container-image'.");
  } else {
    if (containerImageGate.evidence !== "docs/container-publish-plan.md") {
      findings.push("container-image gate evidence must be docs/container-publish-plan.md.");
    }
    const containerTitle = normalizeWhitespace(containerImageGate.title).toLowerCase();
    for (const snippet of [
      "reviewed container publish plan evidence",
      "operator-owned registry",
      "container-image contract check",
      "reviewed commit",
      "scanned",
      "digest",
    ]) {
      if (!containerTitle.includes(snippet)) {
        findings.push(`container-image gate title must require ${snippet}.`);
      }
    }
  }
  for (const id of ["public-dashboard", "admin-surface"]) {
    const gate = gatesById.get(id);
    if (!gate) {
      findings.push(`v0 release gates must include '${id}'.`);
      continue;
    }
    if (gate.evidence !== "docs/dashboard-deployment-plan.md") {
      findings.push(`${id} gate evidence must be docs/dashboard-deployment-plan.md.`);
    }
    if (!normalizeWhitespace(gate.title).toLowerCase().includes("reviewed dashboard deployment plan evidence")) {
      findings.push(`${id} gate title must require reviewed dashboard deployment plan evidence.`);
    }
    if (
      id === "public-dashboard" &&
      !normalizeWhitespace(gate.title).toLowerCase().includes("reviewed public repo/org disclosure allowlists")
    ) {
      findings.push("public-dashboard gate title must require reviewed public repo/org disclosure allowlists.");
    }
  }

  const alertGate = gatesById.get("alerts");
  if (!alertGate) {
    findings.push("v0 release gates must include 'alerts'.");
  } else {
    if (alertGate.evidence !== "docs/alert-delivery-plan.md") {
      findings.push("alerts gate evidence must be docs/alert-delivery-plan.md.");
    }
    const alertTitle = normalizeWhitespace(alertGate.title).toLowerCase();
    if (!alertTitle.includes("reviewed alert delivery plan evidence")) {
      findings.push("alerts gate title must require reviewed alert delivery plan evidence.");
    }
    if (!alertTitle.includes("operator-owned channel")) {
      findings.push("alerts gate title must require an operator-owned channel.");
    }
  }
}

function checkCliContract(findings) {
  const parsed = releaseGatesCli.parseArgs([
    "--file",
    "config/v0-release-gates.json",
    "--status-file",
    "v0-release-status.json",
    "--init-status",
    "init-v0-release-status.json",
    "--json",
    "--summary",
    "--require-ready",
    "--quiet",
    "--force",
  ]);
  if (
    !objectsEqual(parsed, {
      file: "config/v0-release-gates.json",
      force: true,
      initStatusFile: "init-v0-release-status.json",
      json: true,
      quiet: true,
      requireReady: true,
      summary: true,
      statusFile: "v0-release-status.json",
    })
  ) {
    findings.push(`v0 gates CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => releaseGatesCli.parseArgs(["--status-file"]),
    "--status-file requires a value.",
    findings
  );
  expectError(
    () => releaseGatesCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkStatusContract(findings) {
  const gates = releaseGates.loadReleaseGates(path.join(root, "config/v0-release-gates.json"));
  const skeleton = releaseGates.createReleaseGateStatusSkeleton(gates);
  const mergedSkeleton = releaseGates.mergeReleaseGateStatus(gates, skeleton);
  const skeletonSummary = releaseGates.summarizeReleaseGates(mergedSkeleton);
  if (skeletonSummary.ready || skeletonSummary.pending !== skeletonSummary.total) {
    findings.push("v0 release gate pending skeleton must summarize as not ready with every gate pending.");
  }

  const completeStatus = {
    version: 1,
    release: gates.release,
    gates: Object.fromEntries(
      gates.gates.map((gate) => [
        gate.id,
        {
          status: "complete",
          evidence: `Reviewed release gate evidence for ${gate.id}.`,
        },
      ])
    ),
  };
  const complete = releaseGates.mergeReleaseGateStatus(gates, completeStatus, {
    requireComplete: true,
  });
  const completeSummary = releaseGates.assertReleaseGatesReady(complete);
  if (!completeSummary.ready || completeSummary.complete !== completeSummary.total) {
    findings.push("v0 release gate complete status must be ready.");
  }

  const deferredStatus = {
    ...completeStatus,
    gates: {
      ...completeStatus.gates,
      [gates.gates[0].id]: {
        status: "deferred",
        notes: "Accepted for dogfood-only release with named owner.",
      },
    },
  };
  const deferredSummary = releaseGates.summarizeReleaseGates(
    releaseGates.mergeReleaseGateStatus(gates, deferredStatus, {
      requireComplete: true,
    })
  );
  if (!deferredSummary.ready || !deferredSummary.hasDeferrals) {
    findings.push("v0 release gate deferred gates with notes must be ready but flagged as deferrals.");
  }

  expectError(
    () =>
      releaseGates.mergeReleaseGateStatus(
        gates,
        { version: 1, release: gates.release, gates: {} },
        { requireComplete: true }
      ),
    /release gate status is missing/,
    findings
  );
  expectError(
    () =>
      releaseGates.missingReleaseGateStatusIds(gates, {
        version: 1,
        release: gates.release,
        gates: {
          "unknown-gate": {
            status: "pending",
          },
        },
      }),
    "release gate status references unknown gate 'unknown-gate'.",
    findings
  );
  expectError(
    () =>
      releaseGates.validateReleaseGateStatus({
        version: 1,
        gates: {
          "ledger-schema": {
            status: "complete",
          },
        },
      }),
    "release gate status.gates.ledger-schema.evidence must be set when status is complete.",
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-v0-gates-contract-"));
  const statusFile = path.join(tempDir, "v0-release-status.json");
  releaseGates.writeReleaseGateStatusFile(statusFile, skeleton);
  if (!fs.existsSync(statusFile)) {
    findings.push("v0 gates init-status must write the status file.");
  }
  expectError(
    () => releaseGates.writeReleaseGateStatusFile(statusFile, skeleton),
    `release gate status file already exists: ${statusFile}`,
    findings
  );
}

function checkMarkdownRedaction(findings) {
  const gates = {
    version: 1,
    release: "v0.1.0\nsk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    description:
      "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | account 123456789012 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    gates: [
      {
        id: "gate-one",
        title: "Gate\nOne",
        evidence: "docs/release.md\nghp_abcdefghijklmnopqrstuvwxyz1234567890",
        status: "deferred",
        statusEvidence: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890 evidence",
        notes: "Deferred\nwith owner",
      },
    ],
  };
  const markdown = releaseGates.renderReleaseGatesMarkdown(gates);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "v0.1.0\nsk-proj",
    "Gate\nOne",
    "docs/release.md\nghp_",
    "Deferred\nwith owner",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`v0 release gate Markdown must redact or normalize '${unsafe}'.`);
    }
  }
  for (const expected of [
    "v0.1.0 sk-[redacted]",
    "Bearer [redacted]",
    "[redacted-aws-account-id]",
    "arn:aws:[redacted]",
    "[redacted-github-token]",
    "github_pat_[redacted]",
    "Gate One",
    "docs/release.md [redacted-github-token]",
    "Deferred with owner",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`v0 release gate Markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/release-gates.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "RELEASE_GATE_STATUSES",
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "status === \"complete\" && !statusEvidence",
    "Deferred gates must be called out in the release notes",
    "release gate status is missing",
    "release gates are not ready",
    "replace(/\\r?\\n/g, \" \")",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/v0-gates.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "--require-ready",
    "Fail unless every gate is listed and none are pending or blocked.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:release-gates",
      "npm run check:v0-gates",
    ],
    "docs/v0-release-plan.md": [
      "npm run check:v0-gates",
      "v0 release gate contract check",
      "dispatch credential evidence",
      "reviewed public repo/org disclosure allowlists",
      "reviewed container publish plan evidence",
      "reviewed alert delivery plan evidence",
      "AWS account ids",
    ],
    "docs/release-readiness.md": ["v0 release gate contract"],
    "docs/release-operations-map.md": [
      "npm run check:release-gates",
      "npm run check:v0-gates",
    ],
    "docs/release.md": [
      "npm run check:v0-gates",
      "v0 release gate contract",
    ],
    "docs/release-candidate.md": ["v0 release gate checker"],
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
  checkV0GatesContract,
  targetDocs,
};
