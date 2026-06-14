#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const requiredByFile = {
  "docs/external-evidence-boundaries.md": [
    "# External Evidence Boundaries",
    "operator-owned external evidence",
    "What This Repository Can Prove",
    "What Operators Must Prove Externally",
    "Public Artifact Rule",
    "Release Notes Rule",
    "production GitHub App exists",
    "private conversion summary",
    "App id/slug custody",
    "webhook ping evidence",
    "selected-repository allowlist",
    "rotation ownership",
    "operator-owned registry",
    "AWS IAM/OIDC",
    "`iam-and-secrets`",
    "runtime secret-store access principals",
    "break-glass revoke paths",
    "provider keys",
    "`provider-console-readiness`",
    "6529.io production public and private dashboard routes",
    "operator-owned private channel",
    "target repositories have reviewed `.github/6529bot.yml` configuration",
    "manual security review, production cutover, dogfood promotion, and go-live",
    "local validation from external operator evidence",
    "npm run check:external-evidence-boundaries",
  ],
  "README.md": [
    "External Evidence Boundaries",
    "docs/external-evidence-boundaries.md",
    "npm run check:external-evidence-boundaries",
  ],
  "docs/README.md": ["External Evidence Boundaries", "external-evidence-boundaries.md"],
  "docs/release.md": [
    "External evidence boundaries",
    "check:external-evidence-boundaries",
    "local validation from external operator evidence",
  ],
  "docs/release-readiness.md": [
    "external evidence boundary contract",
    "local validation distinct from operator-owned production, dashboard, alert, dogfood, and cutover evidence",
  ],
  "docs/roadmap.md": [
    "external evidence boundary contract",
    "local validation distinct from operator-owned production, dashboard, alert, dogfood, and cutover evidence",
  ],
  "docs/release-operations-map.md": [
    "npm run check:external-evidence-boundaries",
    "external evidence boundaries",
  ],
  "docs/release-notes-publication.md": [
    "local validation",
    "operator evidence",
  ],
  "package.json": ["check:external-evidence-boundaries"],
  "scripts/release-check.cjs": ["scripts/check-external-evidence-boundaries.cjs"],
  "scripts/smoke-test.cjs": [
    "externalEvidenceBoundariesCheck",
    "checkExternalEvidenceBoundariesContract",
  ],
  "config/release-operations-map.json": [
    "external-evidence-boundary-contract",
    "check:external-evidence-boundaries",
  ],
};

function main() {
  const result = checkExternalEvidenceBoundariesContract();
  console.log(`external evidence boundaries ok (${result.surfaces} surfaces checked)`);
}

function checkExternalEvidenceBoundariesContract(options = {}) {
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
    throw new Error(
      `external evidence boundaries contract check found ${findings.length} issue(s).`
    );
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
  checkExternalEvidenceBoundariesContract,
};
