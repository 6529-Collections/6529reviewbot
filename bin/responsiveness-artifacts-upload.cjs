#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  responsivenessArtifactSettingsFromEnv,
  uploadResponsivenessArtifacts,
  writeGitHubOutput,
} = require("../src/responsiveness-artifacts.cjs");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const settings = responsivenessArtifactSettingsFromEnv();
  const result = uploadResponsivenessArtifacts(settings, {
    workspace: args.workspace || process.env.REVIEWBOT_RESPONSIVENESS_WORKSPACE,
    token: args.token,
    context: {
      repo: args.repo || process.env.GH_REPO || process.env.TARGET_REPO,
      prNumber: args.prNumber || process.env.PR_NUMBER,
      headSha: args.headSha || process.env.PR_HEAD_SHA,
      workflowRunId: args.workflowRunId || process.env.GITHUB_RUN_ID,
      jobId: args.jobId || process.env.REVIEWBOT_JOB_ID,
    },
    log: (message) => console.warn(message),
  });
  if (args.githubActionsOutput) {
    writeGitHubOutput(result);
  }
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(
      `responsiveness artifact upload ${result.uploaded ? "uploaded" : "skipped"} (${result.screenshots?.length || 0} screenshots)`
    );
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--github-actions-output") {
      result.githubActionsOutput = true;
      continue;
    }
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value.`);
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorLine(error));
    process.exit(1);
  }
}
