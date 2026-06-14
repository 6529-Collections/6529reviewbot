#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "CHANGELOG.md",
  "AGENTS.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
];

const README_LINKS = [
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
  "GOVERNANCE.md",
  "LICENSE",
];

function main() {
  const findings = [];
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, file))) {
      findings.push(`missing required public governance file: ${file}`);
    }
  }

  const packageJson = JSON.parse(read("package.json"));
  if (packageJson.license !== "MIT") {
    findings.push("package.json license must be MIT.");
  }

  const license = read("LICENSE");
  if (!/^MIT License/m.test(license)) {
    findings.push("LICENSE must contain the MIT License heading.");
  }

  const readme = read("README.md");
  for (const target of README_LINKS) {
    if (!readme.includes(`(${target})`)) {
      findings.push(`README.md must link to ${target}.`);
    }
  }

  const contributing = read("CONTRIBUTING.md");
  if (!contributing.includes("(SECURITY.md)")) {
    findings.push("CONTRIBUTING.md must point security reports to SECURITY.md.");
  }

  const support = read("SUPPORT.md");
  if (!support.includes("(SECURITY.md)")) {
    findings.push("SUPPORT.md must point security reports to SECURITY.md.");
  }

  findings.push(...checkPullRequestTemplate());
  findings.push(...checkIssueTemplates());

  if (findings.length) {
    for (const finding of findings) {
      console.error(finding);
    }
    throw new Error(`public governance check found ${findings.length} issue(s).`);
  }

  console.log(`public governance ok (${REQUIRED_FILES.length} files checked)`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function checkPullRequestTemplate() {
  const findings = [];
  const template = read(".github/PULL_REQUEST_TEMPLATE.md");
  for (const snippet of [
    "External Evidence Boundaries",
    "../docs/external-evidence-boundaries.md",
    "distinguish local validation from operator-owned",
    "npm run check:external-evidence-boundaries",
  ]) {
    if (!template.includes(snippet)) {
      findings.push(`PULL_REQUEST_TEMPLATE.md must include '${snippet}'.`);
    }
  }
  return findings;
}

function checkIssueTemplates() {
  const findings = [];
  const bugReport = read(".github/ISSUE_TEMPLATE/bug_report.yml");
  if (!bugReport.includes("Do not include secrets")) {
    findings.push("bug_report.yml must warn reporters not to include secrets.");
  }
  if (!bugReport.includes("npm run support:bundle")) {
    findings.push("bug_report.yml must request sanitized support bundle output.");
  }
  if (!bugReport.includes("Do not paste secrets or private payloads")) {
    findings.push("bug_report.yml must warn against pasting private payloads.");
  }

  const featureRequest = read(".github/ISSUE_TEMPLATE/feature_request.yml");
  if (!featureRequest.includes("Do not include secrets")) {
    findings.push("feature_request.yml must warn reporters not to include secrets.");
  }
  if (!featureRequest.includes("Security and cost considerations")) {
    findings.push("feature_request.yml must ask for security and cost considerations.");
  }

  const config = read(".github/ISSUE_TEMPLATE/config.yml");
  if (!/blank_issues_enabled:\s*false/.test(config)) {
    findings.push("issue template config must disable blank issues.");
  }
  if (!config.includes("/security/policy")) {
    findings.push("issue template config must link to the private security policy.");
  }
  return findings;
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
  REQUIRED_FILES,
  README_LINKS,
};
