"use strict";

const fs = require("fs");
const {
  CUTOVER_STATUSES: SECURITY_REVIEW_STATUSES,
  createProductionCutoverStatusSkeleton,
  loadProductionCutoverChecklist,
  loadProductionCutoverStatus,
  mergeProductionCutoverStatus,
  publicCutoverText,
  summarizeProductionCutover,
  validateProductionCutoverChecklist,
  validateProductionCutoverStatus,
} = require("./production-cutover.cjs");

const DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH = "config/security-review-checklist.json";

function loadSecurityReviewChecklist(filePath = DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH) {
  return loadProductionCutoverChecklist(filePath);
}

function loadSecurityReviewStatus(filePath) {
  return loadProductionCutoverStatus(filePath);
}

function validateSecurityReviewChecklist(document, source = "security review checklist") {
  return validateProductionCutoverChecklist(document, source);
}

function validateSecurityReviewStatus(document, source = "security review status") {
  return validateProductionCutoverStatus(document, source);
}

function mergeSecurityReviewStatus(checklistDocument, statusDocument, options = {}) {
  return mergeProductionCutoverStatus(checklistDocument, statusDocument, options);
}

function createSecurityReviewStatusSkeleton(document, options = {}) {
  return createProductionCutoverStatusSkeleton(document, options);
}

function writeSecurityReviewStatusFile(filePath, document, options = {}) {
  if (!filePath) {
    throw new Error("security review status output path is required.");
  }
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`security review status file already exists: ${filePath}`);
  }
  const status = validateSecurityReviewStatus(document);
  fs.writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  return status;
}

function summarizeSecurityReview(document) {
  return summarizeProductionCutover(document);
}

function assertSecurityReviewReady(document) {
  const summary = summarizeSecurityReview(document);
  if (!summary.ready) {
    throw new Error(`security review is not ready: ${summary.pending} pending, ${summary.blocked} blocked.`);
  }
  return summary;
}

function missingSecurityReviewStatusIds(checklistDocument, statusDocument) {
  const checklist = validateSecurityReviewChecklist(checklistDocument);
  const status = validateSecurityReviewStatus(statusDocument);
  const knownItemIds = new Set(securityReviewItems(checklist).map((item) => item.id));
  for (const id of Object.keys(status.items)) {
    if (!knownItemIds.has(id)) {
      throw new Error(`security review status references unknown item '${id}'.`);
    }
  }
  return securityReviewItems(checklist)
    .map((item) => item.id)
    .filter((id) => status.items[id] === undefined);
}

function renderSecurityReviewMarkdown(document) {
  const checklist = validateSecurityReviewChecklist(document);
  const summary = summarizeSecurityReview(checklist);
  const lines = [
    `# ${publicCutoverText(checklist.release)} Security Review`,
    "",
    publicCutoverText(checklist.description),
    "",
    `Security review ready: ${summary.ready ? "yes" : "no"}`,
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
    lines.push("Deferred security-review items must be named in release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function renderSecurityReviewSummaryMarkdown(document) {
  const summary = summarizeSecurityReview(document);
  const lines = [
    `# ${publicCutoverText(summary.release)} Security Review Summary`,
    "",
    `Security review ready: ${summary.ready ? "yes" : "no"}`,
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

function securityReviewItems(checklist) {
  return checklist.phases.flatMap((phase) => phase.items);
}

module.exports = {
  DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH,
  SECURITY_REVIEW_STATUSES,
  assertSecurityReviewReady,
  createSecurityReviewStatusSkeleton,
  loadSecurityReviewChecklist,
  loadSecurityReviewStatus,
  mergeSecurityReviewStatus,
  missingSecurityReviewStatusIds,
  renderSecurityReviewMarkdown,
  renderSecurityReviewSummaryMarkdown,
  summarizeSecurityReview,
  validateSecurityReviewChecklist,
  validateSecurityReviewStatus,
  writeSecurityReviewStatusFile,
};
