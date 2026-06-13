#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { loadReleaseGates } = require("../src/release-gates.cjs");

const root = path.resolve(__dirname, "..");

function main(options = {}) {
  const gatesFile = options.gatesFile || path.join(root, "config/v0-release-gates.json");
  const planFile = options.planFile || path.join(root, "docs/v0-release-plan.md");
  const packageJsonFile = options.packageJsonFile || path.join(root, "package.json");
  const packageScripts = JSON.parse(fs.readFileSync(packageJsonFile, "utf8")).scripts || {};
  const gates = loadReleaseGates(gatesFile);
  const requiredGateCount = requiredGateCountFromPlan(planFile);
  if (gates.gates.length !== requiredGateCount) {
    throw new Error(
      `v0 release gate count mismatch: config has ${gates.gates.length}, ${planFile} has ${requiredGateCount}.`
    );
  }
  const evidenceReferences = checkEvidenceReferences(gates.gates, packageScripts, options.root || root);
  if (!options.quiet) {
    console.log(`release gate parity ok (${gates.gates.length} gates, ${evidenceReferences} evidence refs)`);
  }
  return { evidenceReferences, gates: gates.gates.length, requiredGateCount };
}

function requiredGateCountFromPlan(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const section = between(
    text,
    "## Required Gates Before Tagging",
    "Render the same gates as an operator checklist:",
    filePath
  );
  const gates = [...section.matchAll(/^\d+\.\s+/gm)];
  if (!gates.length) {
    throw new Error(`No numbered required gates found in ${filePath}.`);
  }
  return gates.length;
}

function between(text, start, end, source = "input") {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Missing release gate section start in ${source}: ${start}`);
  }
  const afterStart = startIndex + start.length;
  const endIndex = text.indexOf(end, afterStart);
  if (endIndex === -1) {
    throw new Error(`Missing release gate section end in ${source}: ${end}`);
  }
  return text.slice(afterStart, endIndex);
}

function checkEvidenceReferences(gates, packageScripts, repoRoot) {
  let count = 0;
  for (const gate of gates) {
    count += 1;
    const evidence = gate.evidence || "";
    if (evidence.startsWith("npm run ")) {
      checkNpmEvidence(evidence, packageScripts, gate.id);
    } else {
      checkPathEvidence(evidence, repoRoot, gate.id);
    }
  }
  return count;
}

function checkNpmEvidence(evidence, packageScripts, gateId) {
  const match = evidence.match(/^npm run ([a-z0-9][a-z0-9:_-]*)(?:\s|$)/);
  if (!match) {
    throw new Error(`release gate ${gateId} evidence command is not a supported npm run command: ${evidence}`);
  }
  const script = match[1];
  if (!Object.prototype.hasOwnProperty.call(packageScripts, script)) {
    throw new Error(`release gate ${gateId} evidence command references missing package script '${script}'.`);
  }
}

function checkPathEvidence(evidence, repoRoot, gateId) {
  if (!evidence || path.isAbsolute(evidence) || evidence.includes("..")) {
    throw new Error(`release gate ${gateId} evidence must be a relative public repo path or npm run command.`);
  }
  if (!/^(docs|infra|templates|config|\.github)\//.test(evidence) && !/^[A-Z0-9_.-]+\.md$/i.test(evidence)) {
    throw new Error(`release gate ${gateId} evidence must point to a public repo doc/template path.`);
  }
  const absolutePath = path.resolve(repoRoot, evidence);
  const relative = path.relative(repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`release gate ${gateId} evidence must stay inside the repository.`);
  }
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`release gate ${gateId} evidence does not exist: ${evidence}`);
  }
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
  checkEvidenceReferences,
  main,
  requiredGateCountFromPlan,
};
