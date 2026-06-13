#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const securityReview = require("../src/security-review-status.cjs");
const securityReviewCli = require("../bin/security-review-status.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/security-review-status.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-candidate.md",
];

function main() {
  const result = checkSecurityReviewStatusContract();
  console.log(
    `security review status contract ok (${result.cliCases} CLI cases, ${result.statusCases} status cases, ${result.docs} docs checked)`
  );
}

function checkSecurityReviewStatusContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkStatusContract(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`security review status contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    statusCases: 5,
    docs: targetDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = securityReviewCli.parseArgs([
    "--",
    "--file",
    "config/security-review-checklist.json",
    "--status-file",
    "security-status.json",
    "--init-status",
    "init-security-status.json",
    "--json",
    "--summary",
    "--require-ready",
    "--quiet",
    "--force",
  ]);
  if (
    !objectsEqual(parsed, {
      file: "config/security-review-checklist.json",
      force: true,
      initStatusFile: "init-security-status.json",
      json: true,
      quiet: true,
      requireReady: true,
      statusFile: "security-status.json",
      summary: true,
    })
  ) {
    findings.push(`security review CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => securityReviewCli.parseArgs(["--status-file"]),
    "--status-file requires a value.",
    findings
  );
  expectError(
    () => securityReviewCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkStatusContract(findings) {
  const checklist = securityReview.loadSecurityReviewChecklist(
    path.join(root, "config/security-review-checklist.json")
  );
  const skeleton = securityReview.createSecurityReviewStatusSkeleton(checklist);
  const mergedSkeleton = securityReview.mergeSecurityReviewStatus(checklist, skeleton);
  const skeletonSummary = securityReview.summarizeSecurityReview(mergedSkeleton);
  if (skeletonSummary.ready || skeletonSummary.pending !== skeletonSummary.total) {
    findings.push("security review pending skeleton must summarize as not ready with every item pending.");
  }

  const completeStatus = {
    version: 1,
    release: checklist.release,
    items: Object.fromEntries(
      securityReviewItems(checklist).map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `Reviewed security evidence for ${item.id}.`,
        },
      ])
    ),
  };
  const complete = securityReview.mergeSecurityReviewStatus(checklist, completeStatus, {
    requireComplete: true,
  });
  const completeSummary = securityReview.assertSecurityReviewReady(complete);
  if (!completeSummary.ready || completeSummary.complete !== completeSummary.total) {
    findings.push("security review complete status must be ready.");
  }

  const deferredStatus = {
    ...completeStatus,
    items: {
      ...completeStatus.items,
      [securityReviewItems(checklist)[0].id]: {
        status: "deferred",
        notes: "Accepted for dogfood-only release with named owner.",
      },
    },
  };
  const deferredSummary = securityReview.summarizeSecurityReview(
    securityReview.mergeSecurityReviewStatus(checklist, deferredStatus, {
      requireComplete: true,
    })
  );
  if (!deferredSummary.ready || !deferredSummary.hasDeferrals) {
    findings.push("security review deferred items with notes must be ready but flagged as deferrals.");
  }

  expectError(
    () =>
      securityReview.mergeSecurityReviewStatus(
        checklist,
        { version: 1, release: checklist.release, items: {} },
        { requireComplete: true }
      ),
    /security review status is missing/,
    findings
  );
  expectError(
    () =>
      securityReview.validateSecurityReviewStatus({
        version: 1,
        items: {
          "github-app-permissions": {
            status: "complete",
          },
        },
      }),
    "security review status.items.github-app-permissions.evidence must be set when status is complete.",
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-security-review-contract-"));
  const statusFile = path.join(tempDir, "security-review-status.json");
  securityReview.writeSecurityReviewStatusFile(statusFile, skeleton);
  if (!fs.existsSync(statusFile)) {
    findings.push("security review init-status must write the status file.");
  }
  expectError(
    () => securityReview.writeSecurityReviewStatusFile(statusFile, skeleton),
    `security review status file already exists: ${statusFile}`,
    findings
  );
}

function checkMarkdownRedaction(findings) {
  const checklist = {
    version: 1,
    release: "v0.1.0\nsk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    description:
      "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | account 123456789012 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    phases: [
      {
        id: "phase-one",
        title: "Phase\nOne",
        objective: "Keep ghp_abcdefghijklmnopqrstuvwxyz1234567890 private.",
        items: [
          {
            id: "item-one",
            title: "Security item\none",
            evidence: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890 evidence",
            runbook: "docs/security-review-status.md",
            status: "deferred",
            notes: "Deferred\nwith owner",
          },
        ],
      },
    ],
  };
  const markdown = securityReview.renderSecurityReviewMarkdown(checklist);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "Phase\nOne",
    "Security item\none",
    "Deferred\nwith owner",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`security review Markdown must redact or normalize '${unsafe}'.`);
    }
  }
  for (const expected of [
    "v0.1.0 sk-[redacted]",
    "Bearer [redacted]",
    "[redacted-aws-account-id]",
    "arn:aws:[redacted]",
    "[redacted-github-token]",
    "github_pat_[redacted]",
    "Phase One",
    "Security item one",
    "Deferred with owner",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`security review Markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/security-review-status.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH",
    "publicCutoverText",
    "assertSecurityReviewReady",
    "Deferred security-review items must be named in release notes",
    "security review is not ready",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/security-review-status.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "--require-ready",
    "Fail unless every item is listed and none are pending or blocked.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:security-review-status"],
    "docs/security-review-status.md": [
      "npm run check:security-review-status",
      "security review status contract check",
      "AWS identifiers",
    ],
    "docs/release-readiness.md": ["security review status contract"],
    "docs/release-operations-map.md": ["npm run check:security-review-status"],
    "docs/release.md": [
      "npm run check:security-review-status",
      "security review status contract",
    ],
    "docs/release-candidate.md": ["security review status checker"],
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

function securityReviewItems(checklist) {
  return checklist.phases.flatMap((phase) => phase.items);
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
  checkSecurityReviewStatusContract,
  targetDocs,
};
