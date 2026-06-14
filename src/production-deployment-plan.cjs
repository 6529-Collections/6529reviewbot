"use strict";

const { normalizeImageRepositoryRef } = require("./image-repository-ref.cjs");
const { normalizeReleaseVersion } = require("./release-notes-draft.cjs");

const DEFAULT_HOST = "<production-bot-origin>";
const DEFAULT_IMAGE = "<operator-registry>/6529reviewbot";
const DEFAULT_WORKSPACE = "<private-workspace-dir>";
const REVIEWED_MODEL_PRICE_FILE = "<reviewed-model-price-file.json>";
const DRY_RUN_NOTICE =
  "This command does not create GitHub Apps, convert manifest codes, deploy services, run checks, or send traffic.";

function collectProductionDeploymentPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.version || "v0.1.0");
  const host = normalizeOrigin(options.host || options.origin || DEFAULT_HOST);
  const image = normalizeImageRef(options.image || DEFAULT_IMAGE);
  const workspace = normalizeWorkspace(options.operatorWorkspace || options.workspace || DEFAULT_WORKSPACE);
  const errors = [];
  const warnings = [];

  if (options.requireInputs) {
    if (host === DEFAULT_HOST) {
      errors.push("production bot origin was not supplied.");
    }
    if (image === DEFAULT_IMAGE) {
      errors.push("operator-owned image repository was not supplied.");
    }
    if (workspace === DEFAULT_WORKSPACE) {
      errors.push("private operator workspace was not supplied.");
    }
  } else {
    if (host === DEFAULT_HOST) {
      warnings.push("production bot origin was not supplied; using placeholder commands.");
    }
    if (image === DEFAULT_IMAGE) {
      warnings.push("operator-owned image repository was not supplied; using placeholder commands.");
    }
    if (workspace === DEFAULT_WORKSPACE) {
      warnings.push("private operator workspace was not supplied; using placeholder commands.");
    }
  }

  if (host !== DEFAULT_HOST || image !== DEFAULT_IMAGE || workspace !== DEFAULT_WORKSPACE) {
    warnings.push("deployment plan output can include private operator paths, origins, or registry names.");
  }

  const ready = errors.length === 0;
  return {
    version: 1,
    release,
    ready,
    generatedAt: (options.now || new Date()).toISOString(),
    inputs: {
      host,
      image,
      operatorWorkspace: workspace,
    },
    errors,
    warnings,
    phases: deploymentPhases({
      release,
      host,
      image,
      workspace,
    }),
  };
}

function deploymentPhases({ release, host, image, workspace }) {
  const cutoverStatus = `${workspace}/production-cutover-status.json`;
  return [
    {
      id: "github-app-registration",
      title: "GitHub App Registration",
      commands: [
        `npm run github-app:manifest -- -- --host ${host} --quiet`,
        "npm run github-app:convert -- -- --code <manifest-code> --output <private-json-path>",
      ],
      evidence: "Record the App id, installation scope, credential custody, and webhook secret presence in private operator evidence.",
    },
    {
      id: "container-image",
      title: "Container Image",
      commands: [
        `npm run container:publish-plan -- -- --image ${image} --release ${release} --require-ready`,
      ],
      evidence: "Record image digest, builder identity, source commit, and vulnerability scan summary in private operator evidence.",
    },
    {
      id: "operator-workspace",
      title: "Operator Workspace",
      commands: [
        `npm run operator:workspace -- -- --dir ${workspace} --check`,
      ],
      evidence: "Keep release-gate, dogfood, security-review, production-cutover, and operator-evidence overlays in the private workspace.",
    },
    {
      id: "runtime-preflight",
      title: "Runtime Preflight",
      commands: [
        "npm run preflight -- -- --strict",
        `npm run admin:snapshot -- -- --base-url ${host} --require-ok`,
      ],
      evidence: "Record strict preflight and admin snapshot summaries without raw private rows or secrets.",
    },
    {
      id: "cutover-and-dogfood",
      title: "Cutover And Dogfood",
      commands: [
        `npm run production:cutover -- -- --status-file ${cutoverStatus} --require-ready`,
        `npm --silent run dogfood:promotion -- -- --operator-workspace ${workspace} --model-price-file ${REVIEWED_MODEL_PRICE_FILE} --strict-preflight --require-ready`,
        `npm --silent run dogfood:go-live -- -- --operator-workspace ${workspace} --model-price-file ${REVIEWED_MODEL_PRICE_FILE} --strict-preflight --require-ready`,
      ],
      evidence: "Record go/no-go output, accepted deferrals, rollback posture, and first dogfood traffic decision.",
    },
  ];
}

function formatProductionDeploymentPlanMarkdown(plan) {
  const lines = [
    `# Production Deployment Plan ${plan.release}`,
    "",
    `Ready to execute: ${plan.ready ? "yes" : "no"}`,
    `Generated: ${plan.generatedAt}`,
    DRY_RUN_NOTICE,
    "",
    "## Inputs",
    "",
    `- host: ${plan.inputs.host}`,
    `- image: ${plan.inputs.image}`,
    `- operator workspace: ${plan.inputs.operatorWorkspace}`,
  ];

  for (const phase of plan.phases) {
    lines.push("", `## ${phase.title}`, "");
    for (const command of phase.commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push(`- Evidence: ${phase.evidence}`);
  }
  if (plan.errors.length) {
    lines.push("", "## Errors", "", ...plan.errors.map((error) => `- ${error}`));
  }
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "", ...plan.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function normalizeOrigin(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) {
    throw new Error("production bot origin is required.");
  }
  if (text === DEFAULT_HOST) {
    return text;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    throw new Error("production bot origin must be an https URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("production bot origin must use https.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("production bot origin must not include a path, query, or hash.");
  }
  return parsed.origin;
}

function normalizeImageRef(value) {
  return normalizeImageRepositoryRef(value, {
    defaultValue: DEFAULT_IMAGE,
    label: "operator-owned image repository",
    requiredMessage: "operator-owned image repository is required.",
  });
}

function normalizeWorkspace(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("private operator workspace is required.");
  }
  if (text === DEFAULT_WORKSPACE) {
    return text;
  }
  if (/[\s`"';&|<>]/.test(text)) {
    throw new Error("private operator workspace contains unsupported shell characters.");
  }
  return text.replace(/\\/g, "/").replace(/\/+$/, "");
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_IMAGE,
  DEFAULT_WORKSPACE,
  DRY_RUN_NOTICE,
  collectProductionDeploymentPlan,
  deploymentPhases,
  formatProductionDeploymentPlanMarkdown,
  normalizeImageRef,
  normalizeOrigin,
  normalizeWorkspace,
};
