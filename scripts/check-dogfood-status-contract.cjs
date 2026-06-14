#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const dogfoodStatus = require("../src/dogfood-status.cjs");
const dogfoodStatusCli = require("../bin/dogfood-status.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/dogfood-status.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-candidate.md",
  "docs/dogfood.md",
];

function main() {
  const result = checkDogfoodStatusContract();
  console.log(
    `dogfood status contract ok (${result.cliCases} CLI cases, ${result.statusCases} status cases, ${result.docs} docs checked)`
  );
}

function checkDogfoodStatusContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkStatusContract(findings);
  checkChecklistConfig(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dogfood status contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    statusCases: 6,
    docs: targetDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = dogfoodStatusCli.parseArgs([
    "--",
    "--file",
    "config/dogfood-checklist.json",
    "--status-file",
    "dogfood-status.json",
    "--init-status",
    "init-dogfood-status.json",
    "--json",
    "--summary",
    "--require-ready",
    "--quiet",
    "--force",
  ]);
  if (
    !objectsEqual(parsed, {
      file: "config/dogfood-checklist.json",
      force: true,
      initStatusFile: "init-dogfood-status.json",
      json: true,
      quiet: true,
      requireReady: true,
      statusFile: "dogfood-status.json",
      summary: true,
    })
  ) {
    findings.push(`dogfood status CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => dogfoodStatusCli.parseArgs(["--status-file"]),
    "--status-file requires a value.",
    findings
  );
  expectError(
    () => dogfoodStatusCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkStatusContract(findings) {
  const checklist = dogfoodStatus.loadDogfoodChecklist(
    path.join(root, "config/dogfood-checklist.json")
  );
  const skeleton = dogfoodStatus.createDogfoodStatusSkeleton(checklist);
  const mergedSkeleton = dogfoodStatus.mergeDogfoodStatus(checklist, skeleton);
  const skeletonSummary = dogfoodStatus.summarizeDogfood(mergedSkeleton);
  if (skeletonSummary.ready || skeletonSummary.pending !== skeletonSummary.total) {
    findings.push("dogfood pending skeleton must summarize as not ready with every item pending.");
  }

  const completeStatus = {
    version: 1,
    release: checklist.release,
    items: Object.fromEntries(
      dogfoodItems(checklist).map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `Reviewed dogfood evidence for ${item.id}.`,
        },
      ])
    ),
  };
  const complete = dogfoodStatus.mergeDogfoodStatus(checklist, completeStatus, {
    requireComplete: true,
  });
  const completeSummary = dogfoodStatus.assertDogfoodReady(complete);
  if (!completeSummary.ready || completeSummary.complete !== completeSummary.total) {
    findings.push("dogfood complete status must be ready.");
  }

  const deferredStatus = {
    ...completeStatus,
    items: {
      ...completeStatus.items,
      [dogfoodItems(checklist)[0].id]: {
        status: "deferred",
        notes: "Accepted for limited dogfood with named owner.",
      },
    },
  };
  const deferredSummary = dogfoodStatus.summarizeDogfood(
    dogfoodStatus.mergeDogfoodStatus(checklist, deferredStatus, {
      requireComplete: true,
    })
  );
  if (!deferredSummary.ready || !deferredSummary.hasDeferrals) {
    findings.push("dogfood deferred items with notes must be ready but flagged as deferrals.");
  }

  expectError(
    () =>
      dogfoodStatus.mergeDogfoodStatus(
        checklist,
        { version: 1, release: checklist.release, items: {} },
        { requireComplete: true }
      ),
    /dogfood status is missing/,
    findings
  );
  expectError(
    () =>
      dogfoodStatus.missingDogfoodStatusIds(checklist, {
        version: 1,
        release: checklist.release,
        items: {
          "unknown-item": {
            status: "pending",
          },
        },
      }),
    "dogfood status references unknown item 'unknown-item'.",
    findings
  );
  expectError(
    () =>
      dogfoodStatus.validateDogfoodStatus({
        version: 1,
        items: {
          "dogfood-target-selected": {
            status: "complete",
          },
        },
      }),
    "dogfood status.items.dogfood-target-selected.evidence must be set when status is complete.",
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-dogfood-status-contract-"));
  const statusFile = path.join(tempDir, "dogfood-status.json");
  dogfoodStatus.writeDogfoodStatusFile(statusFile, skeleton);
  if (!fs.existsSync(statusFile)) {
    findings.push("dogfood init-status must write the status file.");
  }
  expectError(
    () => dogfoodStatus.writeDogfoodStatusFile(statusFile, skeleton),
    `dogfood status file already exists: ${statusFile}`,
    findings
  );
}

function checkChecklistConfig(findings) {
  const checklist = dogfoodStatus.loadDogfoodChecklist(
    path.join(root, "config/dogfood-checklist.json")
  );
  const baseline = checklist.phases.find((phase) => phase.id === "baseline");
  if (!baseline) {
    findings.push("dogfood checklist must include the baseline phase.");
    return;
  }
  const itemIds = baseline.items.map((item) => item.id);
  const readinessIndex = itemIds.indexOf("dogfood-readiness-passes");
  const providerIndex = itemIds.indexOf("provider-console-readiness-reviewed");
  const iamIndex = itemIds.indexOf("iam-secret-custody-reviewed");
  if (providerIndex === -1) {
    findings.push("baseline phase must include provider-console-readiness-reviewed.");
  } else {
    if (readinessIndex !== -1 && providerIndex < readinessIndex) {
      findings.push("provider-console-readiness-reviewed must come after dogfood-readiness-passes.");
    }
    const provider = baseline.items[providerIndex];
    for (const snippet of [
      "Provider-console readiness",
      "configured-model availability",
      "key custody",
      "quotas/rate limits",
      "spend controls",
      "billing alerts",
      "emergency key disablement",
      "before live dogfood model calls",
    ]) {
      if (!provider.title.includes(snippet)) {
        findings.push(`provider-console-readiness-reviewed title must include '${snippet}'.`);
      }
    }
    for (const snippet of [
      "provider-console-readiness operator evidence",
      "without API keys",
      "billing account identifiers",
      "private project ids",
      "provider screenshots",
    ]) {
      if (!provider.evidence.includes(snippet)) {
        findings.push(`provider-console-readiness-reviewed evidence must include '${snippet}'.`);
      }
    }
    if (provider.runbook !== "docs/provider-setup.md") {
      findings.push("provider-console-readiness-reviewed runbook must be docs/provider-setup.md.");
    }
  }
  if (iamIndex === -1) {
    findings.push("baseline phase must include iam-secret-custody-reviewed.");
  } else {
    if (providerIndex !== -1 && iamIndex < providerIndex) {
      findings.push("iam-secret-custody-reviewed must come after provider-console-readiness-reviewed.");
    }
    const iam = baseline.items[iamIndex];
    for (const snippet of [
      "IAM and secret-custody evidence",
      "OIDC trust",
      "Data API scope",
      "database grants",
      "runtime secret-store principals",
      "target-repo/browser secret exclusion",
      "break-glass revoke paths",
      "before live dogfood traffic",
    ]) {
      if (!iam.title.includes(snippet)) {
        findings.push(`iam-secret-custody-reviewed title must include '${snippet}'.`);
      }
    }
    for (const snippet of [
      "iam-and-secrets operator evidence",
      "without live account ids",
      "ARNs",
      "secret names",
      "private principals",
    ]) {
      if (!iam.evidence.includes(snippet)) {
        findings.push(`iam-secret-custody-reviewed evidence must include '${snippet}'.`);
      }
    }
    if (iam.runbook !== "infra/aws/README.md") {
      findings.push("iam-secret-custody-reviewed runbook must be infra/aws/README.md.");
    }
  }
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
            title: "Dogfood item\none",
            evidence: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890 evidence",
            runbook: "docs/dogfood-status.md",
            status: "deferred",
            notes: "Deferred\nwith owner",
          },
        ],
      },
    ],
  };
  const markdown = dogfoodStatus.renderDogfoodMarkdown(checklist);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "Phase\nOne",
    "Dogfood item\none",
    "Deferred\nwith owner",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`dogfood Markdown must redact or normalize '${unsafe}'.`);
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
    "Dogfood item one",
    "Deferred with owner",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`dogfood Markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/dogfood-status.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "DEFAULT_DOGFOOD_CHECKLIST_PATH",
    "publicCutoverText",
    "assertDogfoodReady",
    "Deferred dogfood items must be named in release notes",
    "dogfood execution is not ready",
    "dogfood status is missing",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/dogfood-status.cjs";
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
    "README.md": ["npm run check:dogfood-status"],
    "docs/dogfood-status.md": [
      "npm run check:dogfood-status",
      "dogfood status contract check",
      "provider-console-readiness operator evidence",
      "iam-and-secrets operator evidence",
      "AWS identifiers",
    ],
    "docs/release-readiness.md": ["dogfood status contract"],
    "docs/release-operations-map.md": ["npm run check:dogfood-status"],
    "docs/release.md": [
      "npm run check:dogfood-status",
      "dogfood status contract",
    ],
    "docs/release-candidate.md": ["dogfood status checker"],
    "docs/dogfood.md": ["dogfood status checker"],
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

function dogfoodItems(checklist) {
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
  checkDogfoodStatusContract,
  targetDocs,
};
