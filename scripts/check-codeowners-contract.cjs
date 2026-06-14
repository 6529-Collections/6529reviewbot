#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const codeownersPath = ".github/CODEOWNERS";
const requiredRules = [
  "* @punk6529",
  "/.github/ @punk6529",
  "/bin/ @punk6529",
  "/docs/ @punk6529",
  "/infra/ @punk6529",
  "/scripts/ @punk6529",
  "/src/ @punk6529",
  "/templates/ @punk6529",
  "/Dockerfile @punk6529",
  "/package.json @punk6529",
];

const requiredByFile = {
  [codeownersPath]: [
    "Default review ownership for 6529reviewbot.",
    "dedicated 6529 maintainer team",
    ...requiredRules,
  ],
  "GOVERNANCE.md": ["CODEOWNERS", "dedicated 6529 maintainer team"],
  "docs/repository-rulesets.md": [
    "CODEOWNERS",
    "code owner review",
    "dedicated 6529 maintainer team",
  ],
  "docs/release.md": ["check:codeowners", "CODEOWNERS"],
  "docs/release-readiness.md": ["CODEOWNERS", "code owner review"],
  "docs/roadmap.md": ["CODEOWNERS", "code owner review"],
  "docs/release-operations-map.md": ["npm run check:codeowners", "CODEOWNERS"],
  "package.json": ["check:codeowners"],
  "scripts/release-check.cjs": ["scripts/check-codeowners-contract.cjs"],
  "scripts/smoke-test.cjs": ["codeownersContractCheck", "checkCodeownersContract"],
  "config/release-operations-map.json": ["codeowners-contract", "check:codeowners"],
};

function main() {
  const result = checkCodeownersContract();
  console.log(`CODEOWNERS ok (${result.rules} rules, ${result.surfaces} surfaces checked)`);
}

function checkCodeownersContract(options = {}) {
  const findings = [];
  const texts = options.texts || {};
  for (const [file, snippets] of Object.entries(requiredByFile)) {
    const text = Object.prototype.hasOwnProperty.call(texts, file)
      ? texts[file]
      : fs.readFileSync(path.join(root, file), "utf8");
    checkSnippets(text, snippets, file, findings);
  }

  const codeowners = Object.prototype.hasOwnProperty.call(texts, codeownersPath)
    ? texts[codeownersPath]
    : fs.readFileSync(path.join(root, codeownersPath), "utf8");
  const rules = codeowners
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const rule of rules) {
    if (!isValidCodeownersRule(rule)) {
      findings.push(`${codeownersPath} has an invalid rule shape: ${rule}`);
    }
  }

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`CODEOWNERS contract check found ${findings.length} issue(s).`);
  }

  return {
    rules: rules.length,
    surfaces: Object.keys(requiredByFile).length,
  };
}

function isValidCodeownersRule(rule) {
  const owner = "@[A-Za-z0-9-]+(?:/[A-Za-z0-9_.-]+)?";
  return (
    new RegExp(`^/?[^#\\s]+\\s+${owner}$`).test(rule) ||
    new RegExp(`^\\*\\s+${owner}$`).test(rule)
  );
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
  checkCodeownersContract,
};
