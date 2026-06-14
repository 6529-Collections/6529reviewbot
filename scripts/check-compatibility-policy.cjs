#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const requiredByFile = {
  "docs/compatibility-policy.md": [
    "# Compatibility Policy",
    "pre-v1 infrastructure",
    "exact release tag or commit SHA",
    "repository configuration files",
    "reusable workflow inputs",
    "review job payloads",
    "hidden review metadata",
    "comment commands and generated PR comment format",
    "public usage API and private admin API response shapes",
    "budget, run-control, and admission policy file shapes",
    "Pre-v1 releases may change compatibility-sensitive surfaces.",
    "Breaking pre-v1 changes are allowed only when release notes name the change",
    "defines the stable API surface",
    "npm run check:compatibility-policy",
  ],
  "README.md": ["Compatibility Policy", "docs/compatibility-policy.md"],
  "docs/README.md": ["Compatibility Policy", "compatibility-policy.md"],
  "docs/release.md": [
    "Compatibility Policy",
    "Treat these as breaking",
    "Every pre-v1 release should say",
  ],
  "docs/release-notes-template.md": [
    "Compatibility guarantees:",
    "Pre-v1 releases may change worker payloads",
    "Pin target repositories to an exact tag or commit SHA",
  ],
  "docs/release-notes-publication.md": [
    "Compatibility guarantees:",
    "exact tag/commit pinning",
  ],
  "docs/v0-release-plan.md": [
    "compatibility guarantees",
    "release notes",
  ],
  "docs/roadmap.md": ["v0 release notes and compatibility warnings"],
  "docs/release-readiness.md": ["release tags and compatibility guarantees"],
  "docs/reusable-workflow.md": ["compatibility and development bridge"],
  "package.json": ["check:compatibility-policy"],
  "scripts/release-check.cjs": ["scripts/check-compatibility-policy.cjs"],
  "scripts/smoke-test.cjs": ["compatibilityPolicyCheck", "checkCompatibilityPolicyContract"],
  "config/release-operations-map.json": [
    "compatibility-policy-contract",
    "check:compatibility-policy",
  ],
};

function main() {
  const result = checkCompatibilityPolicyContract();
  console.log(`compatibility policy ok (${result.surfaces} surfaces checked)`);
}

function checkCompatibilityPolicyContract(options = {}) {
  const findings = [];
  const texts = options.texts || {};
  for (const [file, snippets] of Object.entries(requiredByFile)) {
    const text = Object.prototype.hasOwnProperty.call(texts, file)
      ? texts[file]
      : fs.readFileSync(path.join(root, file), "utf8");
    checkSnippets(text, snippets, file, findings);
  }
  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`compatibility policy contract check found ${findings.length} issue(s).`);
  }
  return {
    surfaces: Object.keys(requiredByFile).length,
  };
}

function checkSnippets(text, snippets, file, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${file} must include '${snippet}'.`);
    }
  }
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
  checkCompatibilityPolicyContract,
};
