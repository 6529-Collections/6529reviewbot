#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const requiredByFile = {
  "docs/repository-rulesets.md": [
    "# Repository Rulesets",
    "require pull requests before merging",
    "require conversation resolution before merging",
    "`check` and `dependency-review`",
    "disallow force pushes and branch deletion",
    "Do not require CodeRabbit",
    "OpenSSF Scorecard runs on `main` after merge",
    "Protect release tag patterns such as `v*`",
    "prevent moving or deleting existing release tags",
    "npm run release:tag-plan",
    "npm run release:notes:check",
    "private operator evidence",
    "npm run check:repository-rulesets",
  ],
  ".github/PULL_REQUEST_TEMPLATE.md": [
    "npm run release:check",
    "npm run check:external-evidence-boundaries",
  ],
  "README.md": ["Repository Rulesets", "docs/repository-rulesets.md"],
  "docs/README.md": ["Repository Rulesets", "repository-rulesets.md"],
  "docs/release.md": [
    "Repository rulesets",
    "check:repository-rulesets",
    "main branch protection",
    "release tag ruleset",
  ],
  "docs/release-readiness.md": [
    "repository ruleset guidance",
    "main branch protection",
    "release tag protection",
  ],
  "docs/roadmap.md": [
    "repository ruleset guidance",
    "main branch protection",
    "release tag protection",
  ],
  "docs/external-evidence-boundaries.md": [
    "repository ruleset guidance",
    "live ruleset settings",
  ],
  "docs/release-operations-map.md": [
    "npm run check:repository-rulesets",
    "repository rulesets",
  ],
  "package.json": ["check:repository-rulesets"],
  "scripts/release-check.cjs": ["scripts/check-repository-rulesets-contract.cjs"],
  "scripts/smoke-test.cjs": [
    "repositoryRulesetsContractCheck",
    "checkRepositoryRulesetsContract",
  ],
  "config/release-operations-map.json": [
    "repository-ruleset-contract",
    "check:repository-rulesets",
  ],
};

function main() {
  const result = checkRepositoryRulesetsContract();
  console.log(`repository rulesets ok (${result.surfaces} surfaces checked)`);
}

function checkRepositoryRulesetsContract(options = {}) {
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
    throw new Error(`repository ruleset contract check found ${findings.length} issue(s).`);
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
  checkRepositoryRulesetsContract,
};
