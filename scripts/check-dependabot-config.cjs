#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, ".github", "dependabot.yml");
const requiredUpdates = [
  {
    ecosystem: "github-actions",
    directory: "/",
    interval: "weekly",
    labels: ["dependencies", "github-actions"],
  },
  {
    ecosystem: "npm",
    directory: "/",
    interval: "weekly",
    labels: ["dependencies", "npm"],
  },
];

function main() {
  if (!fs.existsSync(configPath)) {
    throw new Error(".github/dependabot.yml is required.");
  }
  const document = YAML.parse(fs.readFileSync(configPath, "utf8"));
  const findings = validateDependabotConfig(document);
  if (findings.length) {
    for (const finding of findings) {
      console.error(finding);
    }
    throw new Error(`dependabot config check found ${findings.length} issue(s).`);
  }
  console.log(`dependabot config ok (${requiredUpdates.length} ecosystems checked)`);
}

function validateDependabotConfig(document) {
  const findings = [];
  if (!document || typeof document !== "object") {
    return ["dependabot config must be a YAML object."];
  }
  if (document.version !== 2) {
    findings.push("dependabot config version must be 2.");
  }
  const updates = Array.isArray(document.updates) ? document.updates : [];
  if (!updates.length) {
    findings.push("dependabot config must include updates.");
  }
  for (const required of requiredUpdates) {
    const update = updates.find(
      (item) =>
        item?.["package-ecosystem"] === required.ecosystem &&
        item?.directory === required.directory
    );
    if (!update) {
      findings.push(
        `dependabot config must include ${required.ecosystem} updates for ${required.directory}.`
      );
      continue;
    }
    if (update.schedule?.interval !== required.interval) {
      findings.push(
        `${required.ecosystem} updates must run ${required.interval}.`
      );
    }
    const labels = new Set(Array.isArray(update.labels) ? update.labels : []);
    for (const label of required.labels) {
      if (!labels.has(label)) {
        findings.push(`${required.ecosystem} updates must include '${label}' label.`);
      }
    }
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
  requiredUpdates,
  validateDependabotConfig,
};
