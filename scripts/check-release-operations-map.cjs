#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const dogfoodGoLiveCli = require("../bin/dogfood-go-live.cjs");
const dogfoodPromotionCli = require("../bin/dogfood-promotion.cjs");
const dogfoodReadinessCli = require("../bin/dogfood-readiness.cjs");
const {
  DEFAULT_RELEASE_OPERATIONS_MAP_PATH,
  loadReleaseOperationsMap,
  summarizeReleaseOperationsMap,
  validateReleaseOperationsMap,
} = require("../src/release-operations-map.cjs");

const root = path.resolve(__dirname, "..");

function checkReleaseOperationsMap(options = {}) {
  const file = options.file || DEFAULT_RELEASE_OPERATIONS_MAP_PATH;
  const docFile = options.docFile || path.join(root, "docs", "release-operations-map.md");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const map = loadReleaseOperationsMap(file);
  const validated = validateReleaseOperationsMap(map, file, {
    checkDocs: true,
    packageScripts: packageJson.scripts || {},
    repoRoot: root,
  });
  checkReleaseNotesPublicationTools(validated);
  checkReleaseTagPlanTools(validated);
  checkDogfoodReadyModeCommands(validated);
  checkReleaseOperationsDoc(validated, docFile);
  return summarizeReleaseOperationsMap(validated);
}

function checkReleaseNotesPublicationTools(map) {
  const tools = map.phases.flatMap((phase) => phase.tools);
  const contractTool = tools.find((tool) => tool.id === "release-notes-publication-contract");
  if (!contractTool) {
    throw new Error("release operations map must include release-notes-publication-contract.");
  }
  if (!contractTool.purpose.includes("vague or failed validation results")) {
    throw new Error("release-notes-publication-contract purpose must mention vague or failed validation results.");
  }
  const publicationTool = tools.find((tool) => tool.id === "release-notes-publication");
  if (!publicationTool) {
    throw new Error("release operations map must include release-notes-publication.");
  }
  if (!publicationTool.purpose.includes("explicit validation evidence")) {
    throw new Error("release-notes-publication purpose must mention explicit validation evidence.");
  }
}

function checkReleaseTagPlanTools(map) {
  const tools = map.phases.flatMap((phase) => phase.tools);
  const contractTool = tools.find((tool) => tool.id === "release-tag-plan-contract");
  if (!contractTool) {
    throw new Error("release operations map must include release-tag-plan-contract.");
  }
  if (!contractTool.purpose.includes("release notes title match")) {
    throw new Error("release-tag-plan-contract purpose must mention release notes title match.");
  }
  if (!contractTool.purpose.includes("local tag availability")) {
    throw new Error("release-tag-plan-contract purpose must mention local tag availability.");
  }
  if (!contractTool.purpose.includes("remote tag availability")) {
    throw new Error("release-tag-plan-contract purpose must mention remote tag availability.");
  }
  const tagPlanTool = tools.find((tool) => tool.id === "release-tag-plan");
  if (!tagPlanTool) {
    throw new Error("release operations map must include release-tag-plan.");
  }
  if (!tagPlanTool.purpose.includes("remote tag availability")) {
    throw new Error("release-tag-plan purpose must mention remote tag availability.");
  }
}

function checkDogfoodReadyModeCommands(map) {
  const expectations = [
    {
      id: "dogfood-readiness",
      script: "dogfood:readiness",
      parseArgs: dogfoodReadinessCli.parseArgs,
    },
    {
      id: "dogfood-promotion",
      script: "dogfood:promotion",
      parseArgs: dogfoodPromotionCli.parseArgs,
    },
    {
      id: "dogfood-go-live",
      script: "dogfood:go-live",
      parseArgs: dogfoodGoLiveCli.parseArgs,
    },
  ];
  const tools = map.phases.flatMap((phase) => phase.tools);
  for (const expectation of expectations) {
    const tool = tools.find((item) => item.id === expectation.id);
    if (!tool) {
      throw new Error(`release operations map must include ${expectation.id}.`);
    }
    if (tool.script !== expectation.script) {
      throw new Error(`${expectation.id} must use ${expectation.script}.`);
    }
    const argv = argvForTool(tool);
    for (const flag of [
      "--operator-workspace",
      "--model-price-file",
      "--strict-preflight",
      "--require-ready",
    ]) {
      if (!argv.includes(flag)) {
        throw new Error(`${expectation.id} release operation command must include ${flag}.`);
      }
    }
    const parsed = expectation.parseArgs(argv);
    if (!parsed.requireReady || !parsed.strictPreflight) {
      throw new Error(`${expectation.id} release operation command must parse as strict ready mode.`);
    }
    if (parsed.operatorWorkspaceDir !== "<private-workspace-dir>") {
      throw new Error(`${expectation.id} release operation command must use <private-workspace-dir>.`);
    }
    if (parsed.modelPriceFile !== "<reviewed-model-price-file.json>") {
      throw new Error(`${expectation.id} release operation command must use <reviewed-model-price-file.json>.`);
    }
  }
}

function argvForTool(tool) {
  return tool.args.split(/\s+/).filter(Boolean);
}

function checkReleaseOperationsDoc(map, docFile) {
  const doc = fs.readFileSync(docFile, "utf8");
  const localQualityPhase = map.phases.find((phase) => phase.id === "local-quality");
  if (!localQualityPhase) {
    throw new Error("release operations map must include the local-quality phase.");
  }
  const missing = localQualityPhase.tools
    .map((tool) => `npm run ${tool.script}`)
    .filter((command) => !doc.includes(command));
  if (missing.length) {
    throw new Error(
      `docs/release-operations-map.md is missing local quality command(s): ${missing.join(", ")}`
    );
  }
}

if (require.main === module) {
  try {
    const summary = checkReleaseOperationsMap();
    console.log(
      `release operations map ok (${summary.phaseCount} phases, ${summary.toolCount} tools)`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkDogfoodReadyModeCommands,
  checkReleaseNotesPublicationTools,
  checkReleaseTagPlanTools,
  checkReleaseOperationsDoc,
  checkReleaseOperationsMap,
};
