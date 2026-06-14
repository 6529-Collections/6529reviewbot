#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const productionCutover = require("../src/production-cutover.cjs");
const productionCutoverCli = require("../bin/production-cutover.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/production-cutover.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-candidate.md",
];

function main() {
  const result = checkProductionCutoverContract();
  console.log(
    `production cutover contract ok (${result.cliCases} CLI cases, ${result.statusCases} status cases, ${result.docs} docs checked)`
  );
}

function checkProductionCutoverContract(options = {}) {
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
    throw new Error(`production cutover contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    statusCases: 5,
    docs: targetDocs.length,
  };
}

function checkChecklistConfig(findings) {
  const checklist = productionCutover.loadProductionCutoverChecklist(
    path.join(root, "config/production-cutover-checklist.json")
  );
  const serverWorkerPhase = checklist.phases.find((phase) => phase.id === "server-and-worker");
  if (!serverWorkerPhase) {
    findings.push("production cutover checklist must include the server-and-worker phase.");
  } else {
    const itemIds = serverWorkerPhase.items.map((item) => item.id);
    const containerImageIndex = itemIds.indexOf("container-image-reviewed");
    const serverDeployedIndex = itemIds.indexOf("server-deployed-noop");
    const workerDispatchIndex = itemIds.indexOf("worker-dispatch-credentials-reviewed");
    const workerEnabledIndex = itemIds.indexOf("worker-enabled-conservative");
    if (containerImageIndex === -1) {
      findings.push("server-and-worker phase must include container-image-reviewed.");
    } else {
      if (serverDeployedIndex !== -1 && containerImageIndex > serverDeployedIndex) {
        findings.push("container-image-reviewed must come before server-deployed-noop.");
      }
      const containerImage = serverWorkerPhase.items[containerImageIndex];
      for (const snippet of [
        "Container publish plan",
        "operator-owned registry",
        "before any image build or push",
      ]) {
        if (!containerImage.title.includes(snippet)) {
          findings.push(`container-image-reviewed title must include '${snippet}'.`);
        }
      }
      for (const snippet of [
        "npm run container:publish-plan",
        "--image <operator-registry>/6529reviewbot",
        "--release v0.1.0",
        "--require-ready",
        "image digest",
        "builder identity",
        "source commit",
        "scan summary",
      ]) {
        if (!containerImage.evidence.includes(snippet)) {
          findings.push(`container-image-reviewed evidence must include '${snippet}'.`);
        }
      }
      if (containerImage.runbook !== "docs/container-publish-plan.md") {
        findings.push("container-image-reviewed runbook must be docs/container-publish-plan.md.");
      }
    }
    if (workerDispatchIndex === -1) {
      findings.push("server-and-worker phase must include worker-dispatch-credentials-reviewed.");
    } else {
      if (workerEnabledIndex === -1) {
        findings.push("server-and-worker phase must include worker-enabled-conservative.");
      } else if (workerDispatchIndex > workerEnabledIndex) {
        findings.push("worker-dispatch-credentials-reviewed must come before worker-enabled-conservative.");
      }
      const workerDispatch = serverWorkerPhase.items[workerDispatchIndex];
      for (const snippet of [
        "Worker dispatch credential posture",
        "before enabling non-noop worker traffic",
        "dispatch-only GitHub App",
        "fallback explicitly accepted",
      ]) {
        if (!workerDispatch.title.includes(snippet)) {
          findings.push(`worker-dispatch-credentials-reviewed title must include '${snippet}'.`);
        }
      }
      for (const snippet of [
        "dispatch mode",
        "dispatch-only App installation",
        "reviewed fallback acceptance",
        "Actions: write scope",
        "strict preflight warning decision",
      ]) {
        if (!workerDispatch.evidence.includes(snippet)) {
          findings.push(`worker-dispatch-credentials-reviewed evidence must include '${snippet}'.`);
        }
      }
      if (workerDispatch.runbook !== "docs/deployment.md") {
        findings.push("worker-dispatch-credentials-reviewed runbook must be docs/deployment.md.");
      }
    }
  }
  const dogfoodPhase = checklist.phases.find((phase) => phase.id === "dogfood");
  if (!dogfoodPhase) {
    findings.push("production cutover checklist must include the dogfood phase.");
  } else {
    const promotionPacket = dogfoodPhase.items.find(
      (item) => item.id === "dogfood-promotion-packet"
    );
    if (!promotionPacket) {
      findings.push("dogfood phase must include dogfood-promotion-packet.");
    } else {
      for (const snippet of [
        "reviewed model price coverage",
        "npm --silent run dogfood:promotion",
        "--operator-workspace <private-workspace-dir>",
        "--model-price-file <reviewed-model-price-file.json>",
        "--strict-preflight",
        "--require-ready",
      ]) {
        if (!`${promotionPacket.title} ${promotionPacket.evidence}`.includes(snippet)) {
          findings.push(`dogfood-promotion-packet must include '${snippet}'.`);
        }
      }
    }
  }
  const ioPhase = checklist.phases.find((phase) => phase.id === "6529-io-and-alerts");
  if (!ioPhase) {
    findings.push("production cutover checklist must include the 6529-io-and-alerts phase.");
    return;
  }
  const itemIds = ioPhase.items.map((item) => item.id);
  const dashboardPlanIndex = itemIds.indexOf("dashboard-deployment-plan-reviewed");
  const alertPlanIndex = itemIds.indexOf("alert-delivery-plan-reviewed");
  const alertsDeliverIndex = itemIds.indexOf("alerts-deliver");
  const publicDashboardIndex = itemIds.indexOf("public-dashboard-wired");
  const adminBridgeIndex = itemIds.indexOf("admin-bridge-wired");
  if (dashboardPlanIndex === -1) {
    findings.push("6529.io cutover phase must include dashboard-deployment-plan-reviewed.");
    return;
  }
  if (publicDashboardIndex === -1) {
    findings.push("6529.io cutover phase must include public-dashboard-wired.");
  } else if (dashboardPlanIndex > publicDashboardIndex) {
    findings.push("dashboard-deployment-plan-reviewed must come before public-dashboard-wired.");
  } else {
    const publicDashboard = ioPhase.items[publicDashboardIndex];
    for (const snippet of [
      "public transparency route",
      "public usage summary API",
      "reviewed public repo/org disclosure allowlists",
    ]) {
      if (!publicDashboard.title.includes(snippet)) {
        findings.push(`public-dashboard-wired title must include '${snippet}'.`);
      }
    }
    for (const snippet of [
      "route",
      "API target",
      "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
      "repo allowlist decision",
      "deployment summary",
    ]) {
      if (!publicDashboard.evidence.includes(snippet)) {
        findings.push(`public-dashboard-wired evidence must include '${snippet}'.`);
      }
    }
  }
  if (adminBridgeIndex === -1) {
    findings.push("6529.io cutover phase must include admin-bridge-wired.");
  } else if (dashboardPlanIndex > adminBridgeIndex) {
    findings.push("dashboard-deployment-plan-reviewed must come before admin-bridge-wired.");
  }
  if (alertPlanIndex === -1) {
    findings.push("6529.io cutover phase must include alert-delivery-plan-reviewed.");
  }
  if (alertsDeliverIndex === -1) {
    findings.push("6529.io cutover phase must include alerts-deliver.");
  } else if (alertPlanIndex > alertsDeliverIndex) {
    findings.push("alert-delivery-plan-reviewed must come before alerts-deliver.");
  }
  const dashboardPlan = ioPhase.items[dashboardPlanIndex];
  for (const snippet of [
    "explicit 6529.io origin",
    "bot origin",
    "private workspace",
    "auth-check URL",
  ]) {
    if (!dashboardPlan.title.includes(snippet)) {
      findings.push(`dashboard-deployment-plan-reviewed title must include '${snippet}'.`);
    }
  }
  for (const snippet of [
    "npm run dashboard:deployment-plan",
    "--frontend-origin <6529-io-origin>",
    "--bot-origin <production-bot-origin>",
    "--operator-workspace <private-workspace-dir>",
    "--auth-check-url <6529-auth-check-url>",
    "--require-ready",
  ]) {
    if (!dashboardPlan.evidence.includes(snippet)) {
      findings.push(`dashboard-deployment-plan-reviewed evidence must include '${snippet}'.`);
    }
  }
  if (dashboardPlan.runbook !== "docs/dashboard-deployment-plan.md") {
    findings.push("dashboard-deployment-plan-reviewed runbook must be docs/dashboard-deployment-plan.md.");
  }
  if (alertPlanIndex !== -1) {
    const alertPlan = ioPhase.items[alertPlanIndex];
    for (const snippet of [
      "explicit production bot origin",
      "private workspace",
      "webhook/SNS/SES notify mode",
      "operator channel label",
    ]) {
      if (!alertPlan.title.includes(snippet)) {
        findings.push(`alert-delivery-plan-reviewed title must include '${snippet}'.`);
      }
    }
    for (const snippet of [
      "npm run alerts:delivery-plan",
      "--bot-origin <production-bot-origin>",
      "--operator-workspace <private-workspace-dir>",
      "--notify-mode <webhook|sns|ses>",
      "--alert-channel <operator-alert-channel>",
      "--require-ready",
    ]) {
      if (!alertPlan.evidence.includes(snippet)) {
        findings.push(`alert-delivery-plan-reviewed evidence must include '${snippet}'.`);
      }
    }
    if (alertPlan.runbook !== "docs/alert-delivery-plan.md") {
      findings.push("alert-delivery-plan-reviewed runbook must be docs/alert-delivery-plan.md.");
    }
  }
}

function checkCliContract(findings) {
  const parsed = productionCutoverCli.parseArgs([
    "--",
    "--file",
    "config/production-cutover-checklist.json",
    "--status-file",
    "status.json",
    "--init-status",
    "init.json",
    "--json",
    "--summary",
    "--require-ready",
    "--quiet",
    "--force",
  ]);
  if (
    !objectsEqual(parsed, {
      file: "config/production-cutover-checklist.json",
      force: true,
      initStatusFile: "init.json",
      json: true,
      quiet: true,
      requireReady: true,
      statusFile: "status.json",
      summary: true,
    })
  ) {
    findings.push(`production cutover CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => productionCutoverCli.parseArgs(["--status-file"]),
    "--status-file requires a value.",
    findings
  );
  expectError(
    () => productionCutoverCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkStatusContract(findings) {
  const checklist = productionCutover.loadProductionCutoverChecklist(
    path.join(root, "config/production-cutover-checklist.json")
  );
  const skeleton = productionCutover.createProductionCutoverStatusSkeleton(checklist);
  const mergedSkeleton = productionCutover.mergeProductionCutoverStatus(checklist, skeleton);
  const skeletonSummary = productionCutover.summarizeProductionCutover(mergedSkeleton);
  if (skeletonSummary.ready || skeletonSummary.pending !== skeletonSummary.total) {
    findings.push("production cutover pending skeleton must summarize as not ready with every item pending.");
  }

  const completeStatus = {
    version: 1,
    release: checklist.release,
    items: Object.fromEntries(
      cutoverItems(checklist).map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `Reviewed public-safe evidence for ${item.id}.`,
        },
      ])
    ),
  };
  const complete = productionCutover.mergeProductionCutoverStatus(checklist, completeStatus, {
    requireComplete: true,
  });
  const completeSummary = productionCutover.assertProductionCutoverReady(complete);
  if (!completeSummary.ready || completeSummary.complete !== completeSummary.total) {
    findings.push("production cutover complete status must be ready.");
  }

  const deferredStatus = {
    ...completeStatus,
    items: {
      ...completeStatus.items,
      [cutoverItems(checklist)[0].id]: {
        status: "deferred",
        notes: "Accepted for dogfood-only release with named owner.",
      },
    },
  };
  const deferredSummary = productionCutover.summarizeProductionCutover(
    productionCutover.mergeProductionCutoverStatus(checklist, deferredStatus, {
      requireComplete: true,
    })
  );
  if (!deferredSummary.ready || !deferredSummary.hasDeferrals) {
    findings.push("production cutover deferred items with notes must be ready but flagged as deferrals.");
  }

  expectError(
    () =>
      productionCutover.mergeProductionCutoverStatus(
        checklist,
        { version: 1, release: checklist.release, items: {} },
        { requireComplete: true }
      ),
    /production cutover status is missing/,
    findings
  );
  expectError(
    () =>
      productionCutover.validateProductionCutoverStatus({
        version: 1,
        items: {
          "release-check": {
            status: "complete",
          },
        },
      }),
    "production cutover status.items.release-check.evidence must be set when status is complete.",
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-cutover-contract-"));
  const statusFile = path.join(tempDir, "production-cutover-status.json");
  productionCutover.writeProductionCutoverStatusFile(statusFile, skeleton);
  if (!fs.existsSync(statusFile)) {
    findings.push("production cutover init-status must write the status file.");
  }
  expectError(
    () => productionCutover.writeProductionCutoverStatusFile(statusFile, skeleton),
    `production cutover status file already exists: ${statusFile}`,
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
            title: "Cutover item\none",
            evidence: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890 evidence",
            runbook: "docs/production-cutover.md",
            status: "deferred",
            notes: "Deferred\nwith owner",
          },
        ],
      },
    ],
  };
  const markdown = productionCutover.renderProductionCutoverMarkdown(checklist);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "Phase\nOne",
    "Cutover item\none",
    "Deferred\nwith owner",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`production cutover Markdown must redact or normalize '${unsafe}'.`);
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
    "Cutover item one",
    "Deferred with owner",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`production cutover Markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/production-cutover.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "CUTOVER_STATUSES",
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "status === \"complete\" && !statusEvidence",
    "Deferred cutover items must be named in release notes",
    "replace(/\\r?\\n/g, \" \")",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/production-cutover.cjs";
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
    "README.md": ["npm run check:production-cutover"],
    "docs/production-cutover.md": [
      "npm run check:production-cutover",
      "production cutover contract check",
      "npm run container:publish-plan",
      "worker dispatch credential posture",
      "public repo/org disclosure allowlists",
      "AWS account ids",
    ],
    "docs/release-readiness.md": ["production cutover contract"],
    "docs/release-operations-map.md": ["npm run check:production-cutover"],
    "docs/release.md": [
      "npm run check:production-cutover",
      "production cutover contract",
    ],
    "docs/release-candidate.md": ["production cutover checker"],
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

function cutoverItems(checklist) {
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
  checkProductionCutoverContract,
  targetDocs,
};
