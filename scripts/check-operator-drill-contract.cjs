#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  formatOperatorDrillMarkdown,
  operatorDrillNextCommands,
  runOperatorDrill,
} = require("../src/operator-drill.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/operator-drill.md",
  "docs/operator-workspace.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkOperatorDrillContract();
  console.log(
    `operator drill contract ok (${result.drillCases} drill cases, ${result.commands} commands, ${result.docs} docs checked)`
  );
}

function checkOperatorDrillContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const sourceTexts = options.sourceTexts || {};

  checkDefaultDrill(findings);
  checkProvidedWorkspaceDrill(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`operator drill contract check found ${findings.length} issue(s).`);
  }

  return {
    drillCases: 2,
    commands: operatorDrillNextCommands().length,
    docs: targetDocs.length,
  };
}

function checkDefaultDrill(findings) {
  const report = runOperatorDrill({
    env: {},
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  if (report.ready !== false) {
    findings.push("default operator drill must not mark generated pending evidence ready.");
  }
  if (report.inputs.operatorWorkspace !== "[operator-workspace]") {
    findings.push("default operator drill must redact the temporary workspace path.");
  }
  if (report.inputs.workspaceMode !== "temporary" || !report.inputs.temporaryWorkspaceCleanedUp) {
    findings.push("default operator drill must create and clean up a temporary workspace.");
  }
  if (report.summaries.dogfoodReadiness.ready !== true) {
    findings.push("operator drill must prove static dogfood readiness inputs parse.");
  }
  if (report.summaries.dogfoodPromotion.summary.ok < 4) {
    findings.push("operator drill must include target, central-input, replay, and workspace promotion gates.");
  }
  if (!report.summaries.dogfoodGoLive.gates.some((gate) => gate.id === "production-cutover")) {
    findings.push("operator drill must include the production cutover go-live gate.");
  }
  const markdown = formatOperatorDrillMarkdown(report);
  for (const snippet of [
    "# 6529bot Operator Drill",
    "without calling GitHub, AWS, or model providers",
    "Workspace: [operator-workspace] (temporary)",
    "Temporary workspace cleanup: yes",
    "dogfood readiness: ready",
    "npm --silent run dogfood:go-live",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`operator drill Markdown must include '${snippet}'.`);
    }
  }
  if (markdown.includes(os.tmpdir())) {
    findings.push("operator drill Markdown must not include temporary workspace paths.");
  }
}

function checkProvidedWorkspaceDrill(findings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-operator-drill-contract-"));
  try {
    const report = runOperatorDrill({
      directory,
      env: {},
      force: true,
      now: new Date("2026-06-13T00:00:00.000Z"),
      root,
    });
    if (report.inputs.workspaceMode !== "operator-provided") {
      findings.push("operator drill with --dir must report operator-provided workspace mode.");
    }
    if (report.inputs.temporaryWorkspaceCleanedUp) {
      findings.push("operator drill with --dir must not claim temporary cleanup.");
    }
    const expectedFile = path.join(directory, "v0-release-status.json");
    if (!fs.existsSync(expectedFile)) {
      findings.push("operator drill with --dir must create the standard workspace skeleton.");
    }
    const markdown = formatOperatorDrillMarkdown(report);
    if (markdown.includes(directory)) {
      findings.push("operator drill with --dir must redact private workspace paths in Markdown.");
    }
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "src/operator-drill.cjs": [
      "runOperatorDrill",
      "createOperatorWorkspace",
      "collectReleaseCandidateBundle",
      "collectDogfoodReadiness",
      "collectDogfoodPromotionPacket",
      "collectDogfoodGoLivePacket",
      "fs.rmSync(directory, { force: true, recursive: true })",
      "\"[operator-workspace]\"",
      "operatorDrillNextCommands",
    ],
    "bin/operator-drill.cjs": [
      "npm run operator:drill",
      "--skip-self-dogfood-replay",
      "Use npm --silent run when copying output from commands that include private paths.",
    ],
    "scripts/release-check.cjs": [
      "scripts/check-operator-drill-contract.cjs",
    ],
    "scripts/smoke-test.cjs": [
      "operatorDrillContractCheck.checkOperatorDrillContract",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run operator:drill",
      "npm run check:operator-drill",
      "[Operator Drill](docs/operator-drill.md)",
    ],
    "docs/operator-drill.md": [
      "npm run operator:drill",
      "public-safe release and dogfood operator drill",
      "without calling GitHub, AWS, or model providers",
      "npm --silent run operator:drill -- -- --dir <private-workspace-dir>",
      "npm run check:operator-drill",
    ],
    "docs/operator-workspace.md": [
      "npm run operator:drill",
      "Operator Drill",
    ],
    "docs/release-operations-map.md": [
      "npm run check:operator-drill",
      "npm run operator:drill",
    ],
    "docs/release.md": [
      "npm run check:operator-drill",
      "operator drill",
    ],
    "docs/release-readiness.md": [
      "npm run check:operator-drill",
      "operator drill",
    ],
    "docs/roadmap.md": [
      "operator drill",
      "release-candidate, dogfood readiness, promotion, and go-live",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return readText(relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkOperatorDrillContract,
};
