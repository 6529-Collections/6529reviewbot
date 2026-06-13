"use strict";

const fs = require("fs");
const {
  CUTOVER_STATUSES: DOGFOOD_STATUSES,
  createProductionCutoverStatusSkeleton,
  loadProductionCutoverChecklist,
  loadProductionCutoverStatus,
  mergeProductionCutoverStatus,
  publicCutoverText,
  summarizeProductionCutover,
  validateProductionCutoverChecklist,
  validateProductionCutoverStatus,
} = require("./production-cutover.cjs");

const DEFAULT_DOGFOOD_CHECKLIST_PATH = "config/dogfood-checklist.json";

function loadDogfoodChecklist(filePath = DEFAULT_DOGFOOD_CHECKLIST_PATH) {
  return loadProductionCutoverChecklist(filePath);
}

function loadDogfoodStatus(filePath) {
  return loadProductionCutoverStatus(filePath);
}

function validateDogfoodChecklist(document, source = "dogfood checklist") {
  return validateProductionCutoverChecklist(document, source);
}

function validateDogfoodStatus(document, source = "dogfood status") {
  return validateProductionCutoverStatus(document, source);
}

function mergeDogfoodStatus(checklistDocument, statusDocument, options = {}) {
  const merged = mergeProductionCutoverStatus(checklistDocument, statusDocument, {
    ...options,
    requireComplete: false,
  });
  const missingIds = missingDogfoodStatusIds(checklistDocument, statusDocument);
  if (options.requireComplete && missingIds.length) {
    throw new Error(
      `dogfood status is missing ${missingIds.length} current item(s): ${missingIds.join(", ")}.`
    );
  }
  return merged;
}

function createDogfoodStatusSkeleton(document, options = {}) {
  return createProductionCutoverStatusSkeleton(document, options);
}

function writeDogfoodStatusFile(filePath, document, options = {}) {
  if (!filePath) {
    throw new Error("dogfood status output path is required.");
  }
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`dogfood status file already exists: ${filePath}`);
  }
  const status = validateDogfoodStatus(document);
  fs.writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

function summarizeDogfood(document) {
  return summarizeProductionCutover(document);
}

function assertDogfoodReady(document) {
  const summary = summarizeDogfood(document);
  if (!summary.ready) {
    throw new Error(`dogfood execution is not ready: ${summary.pending} pending, ${summary.blocked} blocked.`);
  }
  return summary;
}

function missingDogfoodStatusIds(checklistDocument, statusDocument) {
  const checklist = validateDogfoodChecklist(checklistDocument);
  const status = validateDogfoodStatus(statusDocument);
  const knownIds = new Set(dogfoodItems(checklist).map((item) => item.id));
  for (const id of Object.keys(status.items)) {
    if (!knownIds.has(id)) {
      throw new Error(`dogfood status references unknown item '${id}'.`);
    }
  }
  return dogfoodItems(checklist)
    .map((item) => item.id)
    .filter((id) => status.items[id] === undefined);
}

function renderDogfoodMarkdown(document) {
  const checklist = validateDogfoodChecklist(document);
  const summary = summarizeDogfood(checklist);
  const lines = [
    `# ${publicCutoverText(checklist.release)} Dogfood Execution`,
    "",
    publicCutoverText(checklist.description),
    "",
    `Ready for next dogfood step: ${summary.ready ? "yes" : "no"}`,
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
    lines.push("Deferred dogfood items must be named in release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function renderDogfoodSummaryMarkdown(document) {
  const summary = summarizeDogfood(document);
  const lines = [
    `# ${publicCutoverText(summary.release)} Dogfood Execution Summary`,
    "",
    `Ready for next dogfood step: ${summary.ready ? "yes" : "no"}`,
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

function dogfoodItems(checklist) {
  return checklist.phases.flatMap((phase) => phase.items);
}

module.exports = {
  DEFAULT_DOGFOOD_CHECKLIST_PATH,
  DOGFOOD_STATUSES,
  assertDogfoodReady,
  createDogfoodStatusSkeleton,
  loadDogfoodChecklist,
  loadDogfoodStatus,
  mergeDogfoodStatus,
  missingDogfoodStatusIds,
  renderDogfoodMarkdown,
  renderDogfoodSummaryMarkdown,
  summarizeDogfood,
  validateDogfoodChecklist,
  validateDogfoodStatus,
  writeDogfoodStatusFile,
};
