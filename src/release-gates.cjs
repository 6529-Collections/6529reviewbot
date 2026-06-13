"use strict";

const fs = require("fs");
const { redactSensitiveText } = require("./diagnostics.cjs");

const RELEASE_GATE_STATUSES = ["pending", "complete", "deferred", "blocked"];
const RELEASE_GATE_TEXT_MAX_CHARS = 1000;
const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function loadReleaseGates(filePath = "config/v0-release-gates.json") {
  return validateReleaseGates(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function loadReleaseGateStatus(filePath) {
  return validateReleaseGateStatus(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateReleaseGates(document, source = "release gates") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = releaseGateText(document.release, `${source}.release`);
  const description = releaseGateText(document.description, `${source}.description`);
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
      title: releaseGateText(gate.title, `${source}.gates[${index}].title`),
      evidence: releaseGateText(gate.evidence, `${source}.gates[${index}].evidence`),
      ...optionalGateStatus(gate, `${source}.gates[${index}]`, { evidenceKey: "statusEvidence" }),
    };
  });
  return {
    version: 1,
    release,
    description,
    gates,
  };
}

function validateReleaseGateStatus(document, source = "release gate status") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = optionalReleaseGateText(document.release);
  assertObject(document.gates, `${source}.gates`);
  const gates = {};
  for (const [rawId, rawStatus] of Object.entries(document.gates)) {
    const id = idField(rawId, `${source}.gates key`);
    assertObject(rawStatus, `${source}.gates.${id}`);
    const statusInput = { ...rawStatus };
    if (statusInput.evidence === undefined && statusInput.statusEvidence !== undefined) {
      statusInput.evidence = statusInput.statusEvidence;
    }
    gates[id] = optionalGateStatus(statusInput, `${source}.gates.${id}`);
  }
  return {
    version: 1,
    release,
    gates,
  };
}

function missingReleaseGateStatusIds(gatesDocument, statusDocument) {
  const gates = validateReleaseGates(gatesDocument);
  const status = validateReleaseGateStatus(statusDocument);
  assertReleaseGateStatusCompatible(gates, status);
  return missingReleaseGateStatusIdsFromValidated(gates, status);
}

function mergeReleaseGateStatus(gatesDocument, statusDocument, options = {}) {
  const gates = validateReleaseGates(gatesDocument);
  const status = validateReleaseGateStatus(statusDocument);
  assertReleaseGateStatusCompatible(gates, status);
  const missingIds = missingReleaseGateStatusIdsFromValidated(gates, status);
  if (options.requireComplete && missingIds.length) {
    throw new Error(
      `release gate status is missing ${missingIds.length} current gate(s): ${missingIds.join(", ")}.`
    );
  }
  return {
    ...gates,
    gates: gates.gates.map((gate) => ({
      ...gate,
      ...(status.gates[gate.id] || { status: "pending" }),
    })),
  };
}

function assertReleaseGateStatusCompatible(gates, status) {
  if (status.release && status.release !== gates.release) {
    throw new Error(`release gate status release '${status.release}' does not match '${gates.release}'.`);
  }
  const knownGateIds = new Set(gates.gates.map((gate) => gate.id));
  for (const id of Object.keys(status.gates)) {
    if (!knownGateIds.has(id)) {
      throw new Error(`release gate status references unknown gate '${id}'.`);
    }
  }
}

function missingReleaseGateStatusIdsFromValidated(gates, status) {
  return gates.gates
    .map((gate) => gate.id)
    .filter((id) => status.gates[id] === undefined);
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
    const status = gate.status || "pending";
    const checkbox = status === "complete" ? "x" : " ";
    const suffix = status === "pending" ? "" : ` _(${status})_`;
    lines.push(`- [${checkbox}] **${gate.id}**${suffix}: ${gate.title}`);
    lines.push(`  Evidence: ${gate.evidence}`);
    if (gate.statusEvidence) {
      lines.push(`  Status evidence: ${gate.statusEvidence}`);
    }
    if (gate.notes) {
      lines.push(`  Notes: ${gate.notes}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function summarizeReleaseGates(document) {
  const gates = validateReleaseGates(document);
  const counts = Object.fromEntries(RELEASE_GATE_STATUSES.map((status) => [status, 0]));
  for (const gate of gates.gates) {
    counts[gate.status || "pending"] += 1;
  }
  return {
    release: gates.release,
    total: gates.gates.length,
    complete: counts.complete,
    deferred: counts.deferred,
    pending: counts.pending,
    blocked: counts.blocked,
    ready: counts.pending === 0 && counts.blocked === 0,
    hasDeferrals: counts.deferred > 0,
  };
}

function createReleaseGateStatusSkeleton(document, options = {}) {
  const gates = validateReleaseGates(document);
  const status = options.status || "pending";
  if (!RELEASE_GATE_STATUSES.includes(status)) {
    throw new Error(`release gate skeleton status must be one of: ${RELEASE_GATE_STATUSES.join(", ")}.`);
  }
  return {
    version: 1,
    release: gates.release,
    gates: Object.fromEntries(
      gates.gates.map((gate) => [
        gate.id,
        {
          status,
          notes: `Evidence target: ${gate.evidence}`,
        },
      ])
    ),
  };
}

function writeReleaseGateStatusFile(filePath, document, options = {}) {
  if (!filePath) {
    throw new Error("release gate status output path is required.");
  }
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`release gate status file already exists: ${filePath}`);
  }
  const status = validateReleaseGateStatus(document);
  fs.writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

function renderReleaseGateSummaryMarkdown(document) {
  const summary = summarizeReleaseGates(document);
  const lines = [
    `# ${summary.release} Release Gate Summary`,
    "",
    `Ready to tag: ${summary.ready ? "yes" : "no"}`,
    `Complete: ${summary.complete}/${summary.total}`,
    `Deferred: ${summary.deferred}`,
    `Pending: ${summary.pending}`,
    `Blocked: ${summary.blocked}`,
  ];
  if (summary.hasDeferrals) {
    lines.push("");
    lines.push("Deferred gates must be called out in the release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n")}\n`;
}

function assertReleaseGatesReady(document) {
  const summary = summarizeReleaseGates(document);
  if (!summary.ready) {
    throw new Error(
      `release gates are not ready: ${summary.pending} pending, ${summary.blocked} blocked.`
    );
  }
  return summary;
}

function optionalGateStatus(value, source, options = {}) {
  const evidenceKey = options.evidenceKey || "evidence";
  if (value.status === undefined && value[evidenceKey] === undefined && value.notes === undefined) {
    return {};
  }
  const status = enumField(value.status ?? "pending", RELEASE_GATE_STATUSES, `${source}.status`);
  const statusEvidence = optionalReleaseGateText(value[evidenceKey]);
  const notes = optionalReleaseGateText(value.notes);
  if (status === "complete" && !statusEvidence) {
    throw new Error(`${source}.${evidenceKey} must be set when status is complete.`);
  }
  if ((status === "deferred" || status === "blocked") && !notes) {
    throw new Error(`${source}.notes must explain ${status} gates.`);
  }
  return {
    status,
    statusEvidence,
    notes,
  };
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

function releaseGateText(value, source, maxChars = RELEASE_GATE_TEXT_MAX_CHARS) {
  return publicReleaseGateText(stringField(value, source), maxChars);
}

function optionalString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalReleaseGateText(value, maxChars = RELEASE_GATE_TEXT_MAX_CHARS) {
  const text = optionalString(value);
  return text ? publicReleaseGateText(text, maxChars) : "";
}

function publicReleaseGateText(value, maxChars = RELEASE_GATE_TEXT_MAX_CHARS) {
  let text = redactSensitiveText(value);
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .slice(0, maxChars)
    .replace(/\r?\n/g, " ");
}

function enumField(value, allowed, source) {
  const text = stringField(value, source);
  if (!allowed.includes(text)) {
    throw new Error(`${source} must be one of: ${allowed.join(", ")}.`);
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
  assertReleaseGatesReady,
  createReleaseGateStatusSkeleton,
  loadReleaseGateStatus,
  loadReleaseGates,
  mergeReleaseGateStatus,
  missingReleaseGateStatusIds,
  renderReleaseGateSummaryMarkdown,
  renderReleaseGatesMarkdown,
  summarizeReleaseGates,
  validateReleaseGateStatus,
  validateReleaseGates,
  writeReleaseGateStatusFile,
};
