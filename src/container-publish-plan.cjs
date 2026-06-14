"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const { safeErrorLine } = require("./diagnostics.cjs");
const { normalizeImageRepositoryRef } = require("./image-repository-ref.cjs");
const { normalizeReleaseVersion } = require("./release-notes-draft.cjs");
const { parseAheadBehind } = require("./release-tag-plan.cjs");
const { checkContainerImage } = require("../scripts/check-container-image.cjs");

const DEFAULT_IMAGE = "<operator-registry>/6529reviewbot";
const DEFAULT_NODE_IMAGE = "node:22-bookworm-slim";
const DRY_RUN_NOTICE =
  "This command does not build, push, scan, or publish container images.";

function collectContainerPublishPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.tag || options.version || "v0.1.0");
  const image = normalizeImageRef(options.image || options.imageRef || DEFAULT_IMAGE);
  const nodeImage = normalizeRuntimeImage(options.nodeImage || DEFAULT_NODE_IMAGE, "node image");
  const git = options.git || collectGitState(options);
  const errors = [];
  const warnings = [];
  const containerCheck = collectContainerCheck(options, errors);

  if (!options.allowNonMain && git.branch !== "main") {
    errors.push(`container images should be planned from main; current branch is '${git.branch || "unknown"}'.`);
  }
  if (image === DEFAULT_IMAGE) {
    const message = "operator-owned image repository was not supplied.";
    if (options.requireImage) {
      errors.push(message);
    } else {
      warnings.push(`${message} Pass --image before publishing.`);
    }
  }
  if (git.dirty) {
    errors.push("working tree must be clean before planning a container publish.");
  }
  if (git.upstream) {
    if (git.ahead > 0) {
      errors.push(`local branch is ${git.ahead} commit(s) ahead of ${git.upstream}; push or reset before publishing.`);
    }
    if (git.behind > 0) {
      errors.push(`local branch is ${git.behind} commit(s) behind ${git.upstream}; pull before publishing.`);
    }
  } else {
    warnings.push("no upstream branch was detected; verify remote main before publishing.");
  }
  if (image !== DEFAULT_IMAGE) {
    warnings.push("image reference is operator-supplied; review command output before sharing publicly.");
  }

  const ready = errors.length === 0;
  return {
    version: 1,
    release,
    image,
    nodeImage,
    ready,
    generatedAt: (options.now || new Date()).toISOString(),
    git: publicGitState(git),
    containerCheck,
    errors,
    warnings,
    commands: publishCommands({
      image,
      release,
      nodeImage,
      commit: git.commit,
    }),
  };
}

function collectGitState(options = {}) {
  const cwd = options.root || process.cwd();
  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const commit = gitOutput(["rev-parse", "HEAD"], cwd);
  const status = gitOutput(["status", "--porcelain"], cwd);
  const upstream = gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd, {
    optional: true,
  });
  const aheadBehind = upstream
    ? gitOutput(["rev-list", "--left-right", "--count", "HEAD...@{u}"], cwd, {
        optional: true,
      })
    : "";
  const [ahead, behind] = parseAheadBehind(aheadBehind);
  return {
    branch,
    commit,
    dirty: Boolean(status.trim()),
    upstream,
    ahead,
    behind,
  };
}

function collectContainerCheck(options, errors) {
  if (options.containerCheckResult) {
    return {
      ready: true,
      ...options.containerCheckResult,
    };
  }
  try {
    const result = checkContainerImage();
    return {
      ready: true,
      ...result,
    };
  } catch (error) {
    errors.push(`container image contract: ${safeErrorLine(error)}`);
    return {
      ready: false,
    };
  }
}

function normalizeImageRef(value) {
  return normalizeImageRepositoryRef(value, {
    defaultValue: DEFAULT_IMAGE,
    label: "container image reference",
    requiredMessage: "container image reference is required.",
    digestMessage: "container image reference must not include a digest; record digests after push.",
    tagMessage: "container image reference must not include a tag; use --tag or --release instead.",
    lowercaseMessage: "container image reference repository must be lowercase.",
  });
}

function normalizeRuntimeImage(value, label) {
  const text = String(value || "").trim();
  if (!text || !/^[A-Za-z0-9._:/@-]+$/.test(text)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return text;
}

function publicGitState(git) {
  return {
    branch: String(git.branch || ""),
    commit: String(git.commit || ""),
    dirty: Boolean(git.dirty),
    upstream: String(git.upstream || ""),
    ahead: wholeNumber(git.ahead),
    behind: wholeNumber(git.behind),
  };
}

function publishCommands({ image, release, nodeImage, commit }) {
  const tag = `${image}:${release}`;
  const safeCommit = /^[0-9a-f]{7,40}$/i.test(String(commit || "")) ? commit : "<reviewed-commit-sha>";
  return [
    "npm run check:container-image",
    `docker build --pull --build-arg NODE_IMAGE=${nodeImage} -t ${tag} .`,
    `docker push ${tag}`,
    `docker inspect --format='{{index .RepoDigests 0}}' ${tag}`,
    `Run the operator vulnerability scan for ${tag}.`,
    `Record image digest, builder identity, source commit ${safeCommit}, and vulnerability scan summary in private operator evidence.`,
  ];
}

function formatContainerPublishPlanMarkdown(plan) {
  const lines = [
    `# Container Publish Plan ${plan.release}`,
    "",
    `Ready to publish: ${plan.ready ? "yes" : "no"}`,
    `Generated: ${plan.generatedAt}`,
    DRY_RUN_NOTICE,
    "",
    "## Source",
    "",
    `- branch: ${plan.git.branch || "unknown"}`,
    `- commit: ${plan.git.commit || "unknown"}`,
    `- dirty: ${plan.git.dirty ? "yes" : "no"}`,
    `- upstream: ${plan.git.upstream || "none"}`,
    `- ahead/behind: ${plan.git.ahead}/${plan.git.behind}`,
    "",
    "## Image",
    "",
    `- image: ${plan.image}`,
    `- tag: ${plan.release}`,
    `- node image: ${plan.nodeImage}`,
    `- container contract: ${plan.containerCheck.ready ? "passed" : "failed"}`,
    "",
    "## Commands",
    "",
    ...plan.commands.map((command) => `- \`${command}\``),
  ];
  if (plan.errors.length) {
    lines.push("", "## Errors", "", ...plan.errors.map((error) => `- ${error}`));
  }
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "", ...plan.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function gitOutput(args, cwd, options = {}) {
  try {
    return childProcess.execFileSync(gitBin(), args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", options.optional ? "ignore" : "pipe"],
    }).trim();
  } catch (error) {
    if (options.optional) {
      return "";
    }
    throw error;
  }
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function gitBin() {
  if (process.env.GIT_BIN) {
    return process.env.GIT_BIN;
  }
  const windowsGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  if (process.platform === "win32" && fs.existsSync(windowsGit)) {
    return windowsGit;
  }
  return "git";
}

module.exports = {
  DEFAULT_IMAGE,
  DEFAULT_NODE_IMAGE,
  DRY_RUN_NOTICE,
  collectContainerPublishPlan,
  formatContainerPublishPlanMarkdown,
  normalizeImageRef,
  publishCommands,
};
