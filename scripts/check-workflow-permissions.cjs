#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const workflowDirectories = [".github/workflows", "templates"];
const allowedPermissions = {
  contents: new Set(["read"]),
  "id-token": new Set(["write"]),
  issues: new Set(["write"]),
  "pull-requests": new Set(["read"]),
};

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
    checkWorkflowFile(path.join(absoluteDirectory, file));
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log(`workflow permissions ok (${checked} permission block(s) checked)`);
}

function checkWorkflowFile(absolutePath) {
  const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
  const document = YAML.parse(fs.readFileSync(absolutePath, "utf8"));
  if (!document || typeof document !== "object" || !document.jobs) {
    return;
  }
  validatePermissionsBlock(relativePath, "workflow", document.permissions);
  for (const [jobName, job] of Object.entries(document.jobs || {})) {
    if (!job || typeof job !== "object" || !Object.hasOwn(job, "permissions")) {
      continue;
    }
    validatePermissionsBlock(relativePath, `job '${jobName}'`, job.permissions);
  }
}

function validatePermissionsBlock(file, label, permissions) {
  checked += 1;
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    failures.push(`${file} ${label} must declare an explicit permissions map.`);
    return;
  }
  for (const [permission, value] of Object.entries(permissions)) {
    const allowedValues = allowedPermissions[permission];
    if (!allowedValues) {
      failures.push(`${file} ${label} uses unsupported permission '${permission}'.`);
      continue;
    }
    if (!allowedValues.has(String(value))) {
      failures.push(
        `${file} ${label} permission '${permission}' must be one of: ${[
          ...allowedValues,
        ].join(", ")}.`
      );
    }
  }
}
