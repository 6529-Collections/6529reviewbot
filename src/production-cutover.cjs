"use strict";

const fs = require("fs");
const { redactSensitiveText } = require("./diagnostics.cjs");

const CUTOVER_STATUSES = ["pending", "complete", "deferred", "blocked"];
const CUTOVER_TEXT_MAX_CHARS = 1000;

const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function loadProductionCutoverChecklist(filePath = "config/production-cutover-checklist.json") {
  return validateProductionCutoverChecklist(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function loadProductionCutoverStatus(filePath) {
  return validateProductionCutoverStatus(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateProductionCutoverChecklist(document, source = "production cutover checklist") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = stringField(document.release, `${source}.release`);
  const description = cutoverText(document.description, `${source}.description`);
  if (!Array.isArray(document.phases) || document.phases.length === 0) {
    throw new Error(`${source}.phases must be a non-empty array.`);
  }
  const seenPhases = new Set();
  const seenItems = new Set();
  const phases = document.phases.map((phase, phaseIndex) => {
    assertObject(phase, `${source}.phases[${phaseIndex}]`);
    const id = idField(phase.id, `${source}.phases[${phaseIndex}].id`);
    if (seenPhases.has(id)) {
      throw new Error(`${source}.phases[${phaseIndex}].id '${id}' is duplicated.`);
    }
    seenPhases.add(id);
    if (!Array.isArray(phase.items) || phase.items.length === 0) {
      throw new Error(`${source}.phases[${phaseIndex}].items must be a non-empty array.`);
    }
    return {
      id,
      title: cutoverText(phase.title, `${source}.phases[${phaseIndex}].title`),
      objective: optionalCutoverText(phase.objective),
      items: phase.items.map((item, itemIndex) => {
        assertObject(item, `${source}.phases[${phaseIndex}].items[${itemIndex}]`);
        const itemId = idField(item.id, `${source}.phases[${phaseIndex}].items[${itemIndex}].id`);
        if (seenItems.has(itemId)) {
          throw new Error(`${source}.phases[${phaseIndex}].items[${itemIndex}].id '${itemId}' is duplicated.`);
        }
        seenItems.add(itemId);
        return {
          id: itemId,
          phaseId: id,
          title: cutoverText(item.title, `${source}.phases[${phaseIndex}].items[${itemIndex}].title`),
          evidence: cutoverText(item.evidence, `${source}.phases[${phaseIndex}].items[${itemIndex}].evidence`),
          runbook: optionalCutoverText(item.runbook),
          required: item.required !== false,
          ...optionalCutoverItemStatus(item, `${source}.phases[${phaseIndex}].items[${itemIndex}]`),
        };
      }),
    };
  });
  return {
    version: 1,
    release,
    description,
    phases,
  };
}

function validateProductionCutoverStatus(document, source = "production cutover status") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = optionalString(document.release);
  assertObject(document.items, `${source}.items`);
  const items = {};
  for (const [rawId, rawStatus] of Object.entries(document.items)) {
    const id = idField(rawId, `${source}.items key`);
    assertObject(rawStatus, `${source}.items.${id}`);
    items[id] = optionalCutoverStatus(rawStatus, `${source}.items.${id}`);
  }
  return {
    version: 1,
    release,
    items,
  };
}

function mergeProductionCutoverStatus(checklistDocument, statusDocument, options = {}) {
  const checklist = validateProductionCutoverChecklist(checklistDocument);
  const status = validateProductionCutoverStatus(statusDocument);
  assertProductionCutoverStatusCompatible(checklist, status);
  const missingIds = missingProductionCutoverStatusIdsFromValidated(checklist, status);
  if (options.requireComplete && missingIds.length) {
    throw new Error(
      `production cutover status is missing ${missingIds.length} current item(s): ${missingIds.join(", ")}.`
    );
  }
  return {
    ...checklist,
    phases: checklist.phases.map((phase) => ({
      ...phase,
      items: phase.items.map((item) => ({
        ...item,
        ...(status.items[item.id] || { status: "pending" }),
      })),
    })),
  };
}

function assertProductionCutoverStatusCompatible(checklist, status) {
  if (status.release && status.release !== checklist.release) {
    throw new Error(
      `production cutover status release '${status.release}' does not match '${checklist.release}'.`
    );
  }
  const knownItemIds = new Set(cutoverItems(checklist).map((item) => item.id));
  for (const id of Object.keys(status.items)) {
    if (!knownItemIds.has(id)) {
      throw new Error(`production cutover status references unknown item '${id}'.`);
    }
  }
}

function missingProductionCutoverStatusIds(checklistDocument, statusDocument) {
  const checklist = validateProductionCutoverChecklist(checklistDocument);
  const status = validateProductionCutoverStatus(statusDocument);
  assertProductionCutoverStatusCompatible(checklist, status);
  return missingProductionCutoverStatusIdsFromValidated(checklist, status);
}

function missingProductionCutoverStatusIdsFromValidated(checklist, status) {
  return cutoverItems(checklist)
    .map((item) => item.id)
    .filter((id) => status.items[id] === undefined);
}

function createProductionCutoverStatusSkeleton(document, options = {}) {
  const checklist = validateProductionCutoverChecklist(document);
  const status = options.status || "pending";
  if (!CUTOVER_STATUSES.includes(status)) {
    throw new Error(`production cutover skeleton status must be one of: ${CUTOVER_STATUSES.join(", ")}.`);
  }
  return {
    version: 1,
    release: checklist.release,
    items: Object.fromEntries(
      cutoverItems(checklist).map((item) => [
        item.id,
        {
          status,
          notes: `Evidence target: ${item.evidence}`,
        },
      ])
    ),
  };
}

function writeProductionCutoverStatusFile(filePath, document, options = {}) {
  if (!filePath) {
    throw new Error("production cutover status output path is required.");
  }
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`production cutover status file already exists: ${filePath}`);
  }
  const status = validateProductionCutoverStatus(document);
  fs.writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

function summarizeProductionCutover(document) {
  const checklist = validateProductionCutoverChecklist(document);
  const counts = Object.fromEntries(CUTOVER_STATUSES.map((status) => [status, 0]));
  let required = 0;
  let requiredComplete = 0;
  for (const item of cutoverItems(checklist)) {
    const status = item.status || "pending";
    counts[status] += 1;
    if (item.required) {
      required += 1;
      if (status === "complete") {
        requiredComplete += 1;
      }
    }
  }
  return {
    release: checklist.release,
    total: cutoverItems(checklist).length,
    required,
    requiredComplete,
    complete: counts.complete,
    deferred: counts.deferred,
    pending: counts.pending,
    blocked: counts.blocked,
    ready: counts.pending === 0 && counts.blocked === 0,
    hasDeferrals: counts.deferred > 0,
  };
}

function assertProductionCutoverReady(document) {
  const summary = summarizeProductionCutover(document);
  if (!summary.ready) {
    throw new Error(
      `production cutover is not ready: ${summary.pending} pending, ${summary.blocked} blocked.`
    );
  }
  return summary;
}

function renderProductionCutoverMarkdown(document) {
  const checklist = validateProductionCutoverChecklist(document);
  const summary = summarizeProductionCutover(checklist);
  const lines = [
    `# ${publicCutoverText(checklist.release)} Production Cutover`,
    "",
    publicCutoverText(checklist.description),
    "",
    `Ready to cut over: ${summary.ready ? "yes" : "no"}`,
    `Complete: ${summary.complete}/${summary.total}`,
    `Deferred: ${summary.deferred}`,
    `Pending: ${summary.pending}`,
    `Blocked: ${summary.blocked}`,
    "",
  ];
  for (const phase of checklist.phases) {
    lines.push(`## ${publicCutoverText(phase.title)}`);
    if (phase.objective) {
      lines.push(publicCutoverText(phase.objective));
      lines.push("");
    }
    for (const item of phase.items) {
      const status = item.status || "pending";
      const checkbox = status === "complete" ? "x" : " ";
      const suffix = status === "pending" ? "" : ` _(${status})_`;
      const required = item.required ? "" : " _(optional)_";
      lines.push(`- [${checkbox}] **${item.id}**${suffix}${required}: ${publicCutoverText(item.title)}`);
      lines.push(`  Evidence: ${publicCutoverText(item.evidence)}`);
      if (item.runbook) {
        lines.push(`  Runbook: ${publicCutoverText(item.runbook)}`);
      }
      if (item.statusEvidence) {
        lines.push(`  Status evidence: ${publicCutoverText(item.statusEvidence)}`);
      }
      if (item.notes) {
        lines.push(`  Notes: ${publicCutoverText(item.notes)}`);
      }
    }
    lines.push("");
  }
  if (summary.hasDeferrals) {
    lines.push("Deferred cutover items must be named in release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function renderProductionCutoverSummaryMarkdown(document) {
  const summary = summarizeProductionCutover(document);
  const lines = [
    `# ${publicCutoverText(summary.release)} Production Cutover Summary`,
    "",
    `Ready to cut over: ${summary.ready ? "yes" : "no"}`,
    `Complete: ${summary.complete}/${summary.total}`,
    `Required complete: ${summary.requiredComplete}/${summary.required}`,
    `Deferred: ${summary.deferred}`,
    `Pending: ${summary.pending}`,
    `Blocked: ${summary.blocked}`,
  ];
  if (summary.hasDeferrals) {
    lines.push("");
    lines.push("Deferred items must be called out in release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n")}\n`;
}

function cutoverItems(checklist) {
  return checklist.phases.flatMap((phase) => phase.items);
}

function optionalCutoverStatus(value, source) {
  const status = enumField(value.status ?? "pending", CUTOVER_STATUSES, `${source}.status`);
  const statusEvidence = optionalCutoverText(value.evidence ?? value.statusEvidence);
  const notes = optionalCutoverText(value.notes);
  if (status === "complete" && !statusEvidence) {
    throw new Error(`${source}.evidence must be set when status is complete.`);
  }
  if ((status === "deferred" || status === "blocked") && !notes) {
    throw new Error(`${source}.notes must explain ${status} items.`);
  }
  return {
    status,
    statusEvidence,
    notes,
  };
}

function optionalCutoverItemStatus(value, source) {
  if (value.status === undefined && value.statusEvidence === undefined && value.notes === undefined) {
    return {};
  }
  const normalized = optionalCutoverStatus(
    {
      status: value.status,
      evidence: value.statusEvidence,
      notes: value.notes,
    },
    source
  );
  return normalized;
}

function publicCutoverText(value) {
  let text = redactSensitiveText(value);
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, CUTOVER_TEXT_MAX_CHARS).replace(/\r?\n/g, " ");
}

function cutoverText(value, source, maxChars = CUTOVER_TEXT_MAX_CHARS) {
  return publicCutoverText(stringField(value, source)).slice(0, maxChars);
}

function optionalCutoverText(value, maxChars = CUTOVER_TEXT_MAX_CHARS) {
  const text = optionalString(value);
  return text ? publicCutoverText(text).slice(0, maxChars) : "";
}

function assertObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

function stringField(value, source) {
  const text = optionalString(value);
  if (!text) {
    throw new Error(`${source} must be a non-empty string.`);
  }
  return text;
}

function optionalString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
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
  CUTOVER_STATUSES,
  assertProductionCutoverReady,
  createProductionCutoverStatusSkeleton,
  loadProductionCutoverChecklist,
  loadProductionCutoverStatus,
  mergeProductionCutoverStatus,
  missingProductionCutoverStatusIds,
  publicCutoverText,
  renderProductionCutoverMarkdown,
  renderProductionCutoverSummaryMarkdown,
  summarizeProductionCutover,
  validateProductionCutoverChecklist,
  validateProductionCutoverStatus,
  writeProductionCutoverStatusFile,
};
