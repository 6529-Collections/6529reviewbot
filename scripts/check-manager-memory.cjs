#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const activeContextPath = "_manager/roadmap-execution/active-context.md";
const runLogPath = "_manager/roadmap-execution/run-log.md";
const targetDocs = [
  "README.md",
  "docs/manager-memory.md",
  "docs/release-operations-map.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkManagerMemoryContract();
  console.log(
    `manager memory ok (${result.sections} sections, latest PR #${result.latestPr}, ${result.docs} docs checked)`
  );
}

function checkManagerMemoryContract(options = {}) {
  const findings = [];
  const texts = options.texts || {};
  const activeContext = getText(activeContextPath, texts);
  const runLog = getText(runLogPath, texts);

  checkActiveContext(activeContext, findings);
  checkRunLog(runLog, findings);
  checkLatestMergedPr(activeContext, runLog, findings);
  checkSourceAnchors(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`manager memory contract check found ${findings.length} issue(s).`);
  }

  return {
    sections: activeContextHeadings().length,
    latestPr: latestMergedPr(runLog).number,
    docs: targetDocs.length,
  };
}

function checkActiveContext(text, findings) {
  for (const heading of activeContextHeadings()) {
    if (!text.includes(heading)) {
      findings.push(`${activeContextPath} must include '${heading}'.`);
    }
  }
  for (const snippet of [
    "First file to read after compaction: this file.",
    "Complete the `6529reviewbot` roadmap",
    "Repository: `D:\\repos\\6529reviewbot`",
    "Remote: `6529-Collections/6529reviewbot`",
    "Current branch:",
    "Current local changes:",
    "Current local validation:",
    "Use signed commits for 6529 repos.",
    "Keep frontend public/private dashboard PRs current",
    "GitHub App credentials and deployment target are not created yet.",
  ]) {
    if (!text.includes(snippet)) {
      findings.push(`${activeContextPath} must include '${snippet}'.`);
    }
  }
  if (/Current local validation:\s*pending\b/i.test(text)) {
    findings.push(`${activeContextPath} must not ship with pending local validation.`);
  }
  if (!/- Current local validation:\s*\r?\n\s+- `[^`]+` passed/m.test(text)) {
    findings.push(`${activeContextPath} must list passed local validation commands.`);
  }
  if (text.includes("Publish and merge the operator drill command and contract check.")) {
    findings.push(`${activeContextPath} still lists the already-merged operator drill as a next action.`);
  }
}

function checkRunLog(text, findings) {
  checkSnippets(text, [
    "Merged `6529reviewbot` PR #217 as `bddb158`",
    "Started `codex/manager-memory-contract` increment",
    "add `scripts/check-manager-memory.cjs` and `npm run check:manager-memory`",
  ], runLogPath, findings);
}

function checkLatestMergedPr(activeContext, runLog, findings) {
  const latest = latestMergedPr(runLog);
  if (!latest.number) {
    findings.push(`${runLogPath} must record at least one merged 6529reviewbot PR.`);
    return;
  }
  if (!activeContext.includes(`PR #${latest.number}`)) {
    findings.push(`${activeContextPath} must mention latest run-log PR #${latest.number}.`);
  }
  if (latest.sha && !activeContext.includes(`merge commit \`${latest.sha}\``)) {
    findings.push(`${activeContextPath} must mention latest run-log merge commit ${latest.sha}.`);
  }
  if (!latest.postMergeChecks) {
    findings.push(`${runLogPath} latest merged PR #${latest.number} must record post-merge CI and Scorecard.`);
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["check:manager-memory"],
    "scripts/release-check.cjs": ["scripts/check-manager-memory.cjs"],
    "scripts/smoke-test.cjs": [
      "managerMemoryContractCheck",
      "managerMemoryContractCheck.checkManagerMemoryContract",
    ],
    "config/release-operations-map.json": ["manager-memory-contract", "check:manager-memory"],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:manager-memory", "[Manager Memory](docs/manager-memory.md)"],
    "docs/manager-memory.md": [
      "npm run check:manager-memory",
      activeContextPath,
      runLogPath,
      "latest merged PR recorded in the run log",
    ],
    "docs/release-operations-map.md": ["npm run check:manager-memory", "durable manager memory"],
    "docs/release-readiness.md": ["npm run check:manager-memory", "manager memory"],
    "docs/roadmap.md": ["manager memory contract", "durable manager memory"],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function activeContextHeadings() {
  return [
    "## Current Goal",
    "## Current State",
    "## Key Decisions",
    "## Constraints",
    "## Next Actions",
    "## Open Risks",
  ];
}

function latestMergedPr(text) {
  const regex =
    /Merged `6529reviewbot` PR #(\d+) as `([0-9a-f]+)`; post-merge CI and OpenSSF\s+Scorecard completed successfully\./g;
  let latest = { number: 0, sha: "", postMergeChecks: false };
  let match;
  while ((match = regex.exec(text)) !== null) {
    const number = Number(match[1]);
    if (number > latest.number) {
      latest = {
        number,
        sha: match[2],
        postMergeChecks: true,
      };
    }
  }
  return latest;
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
  checkManagerMemoryContract,
  latestMergedPr,
};
