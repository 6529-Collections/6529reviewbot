#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const releaseGates = require("../src/release-gates.cjs");
const communityGatesCli = require("../bin/community-release-gates.cjs");
const { checkEvidenceReferences } = require("./check-release-gate-parity.cjs");

const root = path.resolve(__dirname, "..");
const gatesFile = "config/community-release-gates.json";
const checklistFile = "docs/release-readiness.md";
const requiredGateIds = [
  "github-app",
  "central-runtime",
  "secret-boundary",
  "aws-iam",
  "budget-policies",
  "security-intake",
  "dashboard-plan",
  "public-dashboard",
  "private-admin",
  "operator-alerts",
  "trusted-dogfood",
  "remote-security-checks",
  "public-tag",
  "release-docs",
];

const requiredByDoc = {
  "README.md": ["npm run community:gates", "npm run check:community-release-gates"],
  "docs/release-readiness.md": [
    "npm run community:gates",
    "npm run check:community-release-gates",
    "config/community-release-gates.json",
  ],
  "docs/release.md": ["npm run community:gates", "npm run check:community-release-gates"],
  "docs/release-operations-map.md": [
    "npm run check:community-release-gates",
    "config/community-release-gates.json",
  ],
  "docs/roadmap.md": ["community-release gate contract"],
  "package.json": ["community:gates", "check:community-release-gates"],
  "scripts/release-check.cjs": ["scripts/check-community-release-gates-contract.cjs"],
  "scripts/smoke-test.cjs": [
    "communityReleaseGatesContractCheck",
    "checkCommunityReleaseGatesContract",
  ],
  "config/release-operations-map.json": ["community-release-gates", "check:community-release-gates"],
};

function main() {
  const result = checkCommunityReleaseGatesContract();
  console.log(
    `community release gates contract ok (${result.gates} gates, ${result.evidenceReferences} evidence refs, ${result.docs} docs checked)`
  );
}

function checkCommunityReleaseGatesContract(options = {}) {
  const findings = [];
  const packageScripts = packageScriptsFromText(options.packageJsonText);
  const gates = loadGates(options.gatesText, findings);
  if (gates) {
    checkGateConfig(gates, findings);
    checkEvidence(gates, packageScripts, findings);
    checkChecklistParity(gates, options.docTexts || {}, findings);
    checkStatusContract(gates, findings);
    checkCliContract(findings);
  }
  checkDocs(options.docTexts || {}, options.sourceTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`community release gates contract check found ${findings.length} issue(s).`);
  }

  return {
    docs: Object.keys(requiredByDoc).length,
    evidenceReferences: gates ? gates.gates.length : 0,
    gates: gates ? gates.gates.length : 0,
  };
}

function loadGates(gatesText, findings) {
  try {
    if (gatesText !== undefined) {
      return releaseGates.validateReleaseGates(JSON.parse(gatesText), gatesFile);
    }
    return releaseGates.loadReleaseGates(path.join(root, gatesFile));
  } catch (error) {
    findings.push(error.message);
    return null;
  }
}

function checkGateConfig(gates, findings) {
  if (gates.release !== "community-release") {
    findings.push("community release gates release must be 'community-release'.");
  }
  if (gates.checklist !== checklistFile) {
    findings.push(`community release gates checklist must be ${checklistFile}.`);
  }
  const ids = gates.gates.map((gate) => gate.id);
  if (JSON.stringify(ids) !== JSON.stringify(requiredGateIds)) {
    findings.push(`community release gate ids changed: ${ids.join(", ")}.`);
  }
  const byId = new Map(gates.gates.map((gate) => [gate.id, gate]));
  const requiredSnippets = {
    "github-app": ["6529bot", "GitHub App Registration Packet"],
    "central-runtime": ["central App server", "worker path", "6529 infrastructure"],
    "secret-boundary": ["Provider keys", "GitHub App secrets", "bot environment"],
    "aws-iam": ["AWS IAM/OIDC", "central bot runtime"],
    "budget-policies": ["central budget policies", "environment and repository caps"],
    "security-intake": ["private vulnerability reporting", "private security intake", "security-intake operator evidence"],
    "dashboard-plan": ["dashboard deployment plan", "auth-check URL", "require-ready"],
    "public-dashboard": ["public transparency dashboard", "repo/org disclosure allowlists"],
    "private-admin": ["private admin surface", "6529 auth", "HMAC admin auth bridge"],
    "operator-alerts": ["Scheduled operator alerts", "private operator channels"],
    "trusted-dogfood": ["Trusted 6529 repository dogfood", "promotion", "go-live"],
    "remote-security-checks": ["CI", "Dependency Review", "OpenSSF Scorecard"],
    "public-tag": ["Initial v0 tag plan", "pre-v1 compatibility warnings"],
    "release-docs": ["README", "changelog", "release notes", "example configs"],
  };
  for (const [id, snippets] of Object.entries(requiredSnippets)) {
    const gate = byId.get(id);
    if (!gate) {
      findings.push(`community release gates must include '${id}'.`);
      continue;
    }
    const title = normalizeWhitespace(gate.title).toLowerCase();
    for (const snippet of snippets) {
      if (!title.includes(normalizeWhitespace(snippet).toLowerCase())) {
        findings.push(`${id} gate title must include '${snippet}'.`);
      }
    }
  }
}

function checkEvidence(gates, packageScripts, findings) {
  try {
    checkEvidenceReferences(gates.gates, packageScripts, root);
  } catch (error) {
    findings.push(error.message);
  }
}

function checkChecklistParity(gates, docTexts, findings) {
  const text = getDocText(checklistFile, docTexts);
  const count = communityGateCountFromReadiness(text);
  if (count !== gates.gates.length) {
    findings.push(`${checklistFile} has ${count} community gates, config has ${gates.gates.length}.`);
  }
}

function communityGateCountFromReadiness(text) {
  const section = between(
    text,
    "## Community Release Gates",
    "Use `npm run release:check`",
    checklistFile
  );
  return [...section.matchAll(/^\d+\.\s+/gm)].length;
}

function checkStatusContract(gates, findings) {
  const skeleton = releaseGates.createReleaseGateStatusSkeleton(gates);
  const summary = releaseGates.summarizeReleaseGates(
    releaseGates.mergeReleaseGateStatus(gates, skeleton)
  );
  if (summary.ready || summary.pending !== gates.gates.length) {
    findings.push("community release gate skeleton must summarize as all pending.");
  }
  const completeStatus = {
    version: 1,
    release: gates.release,
    gates: Object.fromEntries(
      gates.gates.map((gate) => [
        gate.id,
        { status: "complete", evidence: `Reviewed community release evidence for ${gate.id}.` },
      ])
    ),
  };
  const complete = releaseGates.mergeReleaseGateStatus(gates, completeStatus, {
    requireComplete: true,
  });
  if (!releaseGates.assertReleaseGatesReady(complete).ready) {
    findings.push("complete community release gate status must be ready.");
  }
}

function checkCliContract(findings) {
  const output = captureStdout(() => communityGatesCli.main(["--summary"]));
  if (!output.includes("# community-release Release Gate Summary")) {
    findings.push("community:gates --summary must render the community release summary.");
  }
  const markdown = captureStdout(() => communityGatesCli.main([]));
  if (!markdown.includes(`Use this checklist with ${checklistFile}.`)) {
    findings.push("community:gates must render the release-readiness checklist source.");
  }
  if (!communityGatesCli.helpText().includes("broad community-release gates")) {
    findings.push("community:gates help must describe broad community-release gates.");
  }
}

function checkDocs(docTexts, sourceTexts, findings) {
  for (const [file, snippets] of Object.entries(requiredByDoc)) {
    const text =
      docTexts[file] !== undefined
        ? docTexts[file]
        : sourceTexts[file] !== undefined
          ? sourceTexts[file]
          : fs.readFileSync(path.join(root, file), "utf8");
    const normalizedText = normalizeWhitespace(text);
    for (const snippet of snippets) {
      if (!normalizedText.includes(normalizeWhitespace(snippet))) {
        findings.push(`${file} must include '${snippet}'.`);
      }
    }
  }
}

function packageScriptsFromText(packageJsonText) {
  const text = packageJsonText || fs.readFileSync(path.join(root, "package.json"), "utf8");
  return JSON.parse(text).scripts || {};
}

function getDocText(file, docTexts) {
  return docTexts[file] !== undefined
    ? docTexts[file]
    : fs.readFileSync(path.join(root, file), "utf8");
}

function between(text, start, end, source) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Missing community release gate section start in ${source}: ${start}`);
  }
  const afterStart = startIndex + start.length;
  const endIndex = text.indexOf(end, afterStart);
  if (endIndex === -1) {
    throw new Error(`Missing community release gate section end in ${source}: ${end}`);
  }
  return text.slice(afterStart, endIndex);
}

function captureStdout(fn) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk, encoding, callback) => {
    output += String(chunk);
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
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
  checkCommunityReleaseGatesContract,
  communityGateCountFromReadiness,
  requiredGateIds,
};
