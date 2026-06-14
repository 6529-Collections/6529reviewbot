#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const alertDeliveryPlanCli = require("../bin/alert-delivery-plan.cjs");
const containerPublishPlanCli = require("../bin/container-publish-plan.cjs");
const dashboardDeploymentPlanCli = require("../bin/dashboard-deployment-plan.cjs");
const dogfoodGoLiveCli = require("../bin/dogfood-go-live.cjs");
const dogfoodPromotionCli = require("../bin/dogfood-promotion.cjs");
const dogfoodReadinessCli = require("../bin/dogfood-readiness.cjs");
const productionDeploymentPlanCli = require("../bin/production-deployment-plan.cjs");
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
  checkProductionHandoffCommands(validated);
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

function checkProductionHandoffCommands(map) {
  const expectations = [
    {
      id: "container-publish-plan",
      script: "container:publish-plan",
      parseArgs: containerPublishPlanCli.parseArgs,
      fields: {
        image: "<operator-registry>/6529reviewbot",
        release: "v0.1.0",
        requireReady: true,
      },
    },
    {
      id: "production-deployment-plan",
      script: "production:deployment-plan",
      parseArgs: productionDeploymentPlanCli.parseArgs,
      fields: {
        host: "<production-bot-origin>",
        image: "<operator-registry>/6529reviewbot",
        operatorWorkspace: "<private-workspace-dir>",
        workerDispatchInstallationId: "<central-repo-installation-id>",
        release: "v0.1.0",
        requireReady: true,
      },
    },
    {
      id: "dashboard-deployment-plan",
      script: "dashboard:deployment-plan",
      parseArgs: dashboardDeploymentPlanCli.parseArgs,
      fields: {
        frontendOrigin: "<6529-io-origin>",
        botOrigin: "<production-bot-origin>",
        operatorWorkspace: "<private-workspace-dir>",
        authCheckUrl: "<6529-auth-check-url>",
        release: "v0.1.0",
        requireReady: true,
      },
    },
    {
      id: "alert-delivery-plan",
      script: "alerts:delivery-plan",
      parseArgs: alertDeliveryPlanCli.parseArgs,
      fields: {
        botOrigin: "<production-bot-origin>",
        operatorWorkspace: "<private-workspace-dir>",
        notifyMode: "<webhook|sns|ses>",
        alertChannel: "<operator-alert-channel>",
        release: "v0.1.0",
        requireReady: true,
      },
    },
  ];
  checkParsedCommandExpectations(map, expectations, "production handoff");
}

function checkDogfoodReadyModeCommands(map) {
  const expectations = [
    {
      id: "dogfood-readiness",
      script: "dogfood:readiness",
      parseArgs: dogfoodReadinessCli.parseArgs,
      fields: {
        operatorWorkspaceDir: "<private-workspace-dir>",
        modelPriceFile: "<reviewed-model-price-file.json>",
        strictPreflight: true,
        requireReady: true,
      },
    },
    {
      id: "dogfood-promotion",
      script: "dogfood:promotion",
      parseArgs: dogfoodPromotionCli.parseArgs,
      fields: {
        operatorWorkspaceDir: "<private-workspace-dir>",
        modelPriceFile: "<reviewed-model-price-file.json>",
        strictPreflight: true,
        requireReady: true,
      },
    },
    {
      id: "dogfood-go-live",
      script: "dogfood:go-live",
      parseArgs: dogfoodGoLiveCli.parseArgs,
      fields: {
        operatorWorkspaceDir: "<private-workspace-dir>",
        modelPriceFile: "<reviewed-model-price-file.json>",
        strictPreflight: true,
        requireReady: true,
      },
    },
  ];
  checkParsedCommandExpectations(map, expectations, "dogfood ready-mode");
}

function checkParsedCommandExpectations(map, expectations, label) {
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
    const parsed = expectation.parseArgs(argv);
    for (const [field, expected] of Object.entries(expectation.fields)) {
      if (parsed[field] !== expected) {
        throw new Error(
          `${expectation.id} ${label} command must parse ${field} as ${JSON.stringify(expected)}.`
        );
      }
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
  checkParsedCommandExpectations,
  checkProductionHandoffCommands,
  checkReleaseNotesPublicationTools,
  checkReleaseTagPlanTools,
  checkReleaseOperationsDoc,
  checkReleaseOperationsMap,
};
