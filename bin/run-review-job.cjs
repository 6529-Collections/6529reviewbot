#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { runReviewJobLocally } = require("../src/worker-adapter.cjs");

function main() {
  const job = readJob(process.argv.slice(2));
  const result = runReviewJobLocally(job);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.accepted ? 0 : 1);
}

function readJob(args) {
  const fileIndex = args.indexOf("--job-file");
  if (fileIndex >= 0 && args[fileIndex + 1]) {
    return JSON.parse(fs.readFileSync(args[fileIndex + 1], "utf8"));
  }
  if (process.env.REVIEWBOT_JOB_JSON) {
    return JSON.parse(process.env.REVIEWBOT_JOB_JSON);
  }
  const stdin = fs.readFileSync(0, "utf8").trim();
  if (!stdin) {
    throw new Error("Pass --job-file, REVIEWBOT_JOB_JSON, or a job JSON document on stdin.");
  }
  return JSON.parse(stdin);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
}

module.exports = {
  readJob,
};
