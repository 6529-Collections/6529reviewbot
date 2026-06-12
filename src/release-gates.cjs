"use strict";

const fs = require("fs");

function loadReleaseGates(filePath = "config/v0-release-gates.json") {
  return validateReleaseGates(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateReleaseGates(document, source = "release gates") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = stringField(document.release, `${source}.release`);
  const description = stringField(document.description, `${source}.description`);
  if (!Array.isArray(document.gates) || document.gates.length === 0) {
    throw new Error(`${source}.gates must be a non-empty array.`);
  }
  const seen = new Set();
  const gates = document.gates.map((gate, index) => {
    assertObject(gate, `${source}.gates[${index}]`);
    const id = idField(gate.id, `${source}.gates[${index}].id`);
    if (seen.has(id)) {
      throw new Error(`${source}.gates[${index}].id '${id}' is duplicated.`);
    }
    seen.add(id);
    return {
      id,
      title: stringField(gate.title, `${source}.gates[${index}].title`),
      evidence: stringField(gate.evidence, `${source}.gates[${index}].evidence`),
    };
  });
  return {
    version: 1,
    release,
    description,
    gates,
  };
}

function renderReleaseGatesMarkdown(document) {
  const gates = validateReleaseGates(document);
  const lines = [
    `# ${gates.release} Release Gates`,
    "",
    gates.description,
    "",
    "Use this checklist with docs/v0-release-plan.md. If a gate is intentionally",
    "deferred, the release notes must say so plainly and describe the risk.",
    "",
  ];
  for (const gate of gates.gates) {
    lines.push(`- [ ] **${gate.id}**: ${gate.title}`);
    lines.push(`  Evidence: ${gate.evidence}`);
  }
  return `${lines.join("\n")}\n`;
}

function assertObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

function stringField(value, source) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${source} must be a non-empty string.`);
  }
  return text;
}

function idField(value, source) {
  const text = stringField(value, source);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(text)) {
    throw new Error(`${source} must use lowercase letters, digits, and hyphens.`);
  }
  return text;
}

module.exports = {
  loadReleaseGates,
  renderReleaseGatesMarkdown,
  validateReleaseGates,
};
