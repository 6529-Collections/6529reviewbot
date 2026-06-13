#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const checklistFiles = [
  "config/dogfood-checklist.json",
  "config/production-cutover-checklist.json",
  "config/security-review-checklist.json",
];

function checkChecklistRunbooks(options = {}) {
  const files = options.files || checklistFiles;
  const repoRoot = options.root || root;
  let count = 0;
  for (const file of files) {
    const document = JSON.parse(fs.readFileSync(path.resolve(repoRoot, file), "utf8"));
    for (const item of checklistItems(document, file)) {
      count += 1;
      checkRunbookPath(item.runbook, `${file}:${item.id}`, repoRoot);
    }
  }
  return { files: files.length, runbooks: count };
}

function checklistItems(document, source) {
  if (!document || typeof document !== "object" || !Array.isArray(document.phases)) {
    throw new Error(`${source} must include phases.`);
  }
  const items = [];
  for (const phase of document.phases) {
    if (!phase || typeof phase !== "object" || !Array.isArray(phase.items)) {
      throw new Error(`${source} phase must include items.`);
    }
    for (const item of phase.items) {
      if (!item || typeof item !== "object") {
        throw new Error(`${source} item must be an object.`);
      }
      if (!item.id || typeof item.id !== "string") {
        throw new Error(`${source} item is missing id.`);
      }
      if (!item.runbook || typeof item.runbook !== "string") {
        throw new Error(`${source}:${item.id} is missing runbook.`);
      }
      items.push(item);
    }
  }
  return items;
}

function checkRunbookPath(runbook, label, repoRoot) {
  if (path.isAbsolute(runbook) || runbook.includes("..")) {
    throw new Error(`${label} runbook must be a relative public repo path.`);
  }
  if (!/^(docs|infra|templates|config|\.github)\//.test(runbook) && !/^[A-Z0-9_.-]+\.md$/i.test(runbook)) {
    throw new Error(`${label} runbook must point to a public repo doc or template path.`);
  }
  const absolutePath = path.resolve(repoRoot, runbook);
  const relative = path.relative(repoRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} runbook must stay inside the repository.`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`${label} runbook does not exist: ${runbook}`);
  }
}

if (require.main === module) {
  try {
    const summary = checkChecklistRunbooks();
    console.log(`checklist runbooks ok (${summary.runbooks} links in ${summary.files} files)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkChecklistRunbooks,
  checklistFiles,
};
