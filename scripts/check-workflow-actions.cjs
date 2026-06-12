#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const workflowDirectories = [".github/workflows", "templates"];
const pinnedShaPattern = /^[0-9a-f]{40}$/;

const failures = [];
let checked = 0;

for (const directory of workflowDirectories) {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) {
    continue;
  }
  for (const file of fs.readdirSync(absoluteDirectory)) {
    if (!/\.ya?ml$/i.test(file)) {
      continue;
    }
    const absolutePath = path.join(absoluteDirectory, file);
    checked += checkWorkflowFile(absolutePath);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log(`workflow action refs ok (${checked} step uses checked)`);
}

function checkWorkflowFile(absolutePath) {
  const relativePath = path.relative(root, absolutePath);
  const document = YAML.parse(fs.readFileSync(absolutePath, "utf8"));
  if (!document?.jobs || typeof document.jobs !== "object") {
    return 0;
  }
  let count = 0;
  for (const [jobName, job] of Object.entries(document.jobs)) {
    if (!job || typeof job !== "object" || !Array.isArray(job.steps)) {
      continue;
    }
    job.steps.forEach((step, index) => {
      if (!step || typeof step !== "object" || !step.uses) {
        return;
      }
      count += 1;
      validateStepActionRef({
        file: relativePath,
        jobName,
        stepIndex: index + 1,
        uses: step.uses,
      });
    });
  }
  return count;
}

function validateStepActionRef(context) {
  const uses = String(context.uses);
  if (uses.startsWith("./")) {
    return;
  }
  const separator = uses.lastIndexOf("@");
  if (separator === -1) {
    failures.push(`${formatContext(context)} must pin the action by commit SHA.`);
    return;
  }
  const ref = uses.slice(separator + 1);
  if (!pinnedShaPattern.test(ref)) {
    failures.push(
      `${formatContext(context)} must pin '${uses}' by a 40-character commit SHA.`
    );
  }
}

function formatContext(context) {
  return `${context.file} job '${context.jobName}' step ${context.stepIndex}`;
}
