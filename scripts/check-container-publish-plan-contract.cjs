#!/usr/bin/env node

"use strict";

const {
  collectContainerPublishPlan,
  formatContainerPublishPlanMarkdown,
  isPlaceholderImageRepository,
  normalizeImageRef,
} = require("../src/container-publish-plan.cjs");
const containerPublishPlanCli = require("../bin/container-publish-plan.cjs");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/container-publish-plan.md",
  "docs/container-deployment.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
  "docs/release-operations-map.md",
];

function main() {
  const result = checkContainerPublishPlanContract();
  console.log(
    `container publish plan contract ok (${result.planCases} plan cases, ${result.docs} docs checked)`
  );
}

function checkContainerPublishPlanContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyPlan(findings);
  checkDirtyPlan(findings);
  checkMissingImagePlan(findings);
  checkPlaceholderImagePlan(findings);
  checkImageValidation(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`container publish plan contract check found ${findings.length} issue(s).`);
  }

  return {
    planCases: 6,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectContainerPublishPlan({
    release: "0.2.0",
    image: "ghcr.io/6529-collections/6529reviewbot",
    now: new Date("2026-06-13T00:00:00.000Z"),
    git: cleanMainGit(),
    containerCheckResult: {
      runtimeCopies: 6,
      dockerignoreEntries: 15,
    },
  });
  if (!plan.ready) {
    findings.push(`clean main container publish plan must be ready: ${plan.errors.join("; ")}`);
  }
  if (plan.release !== "v0.2.0") {
    findings.push("container publish plan must normalize versions with a v prefix.");
  }
  const markdown = formatContainerPublishPlanMarkdown(plan);
  for (const snippet of [
    "Ready to publish: yes",
    "This command does not build, push, scan, or publish container images.",
    "npm run check:container-image",
    "docker build --pull",
    "docker push ghcr.io/6529-collections/6529reviewbot:v0.2.0",
    "vulnerability scan",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`ready container publish plan markdown must include '${snippet}'.`);
    }
  }
}

function checkPlaceholderImagePlan(findings) {
  const plan = collectContainerPublishPlan({
    release: "v0.2.0",
    image: "registry.example.com/6529reviewbot",
    requireImage: true,
    git: cleanMainGit(),
    containerCheckResult: {
      runtimeCopies: 6,
      dockerignoreEntries: 15,
    },
  });
  if (plan.ready) {
    findings.push("required container publish plans must block documentation/example image registries.");
  }
  if (!plan.errors.some((error) => error.includes("documentation, example, local, or reserved registries"))) {
    findings.push("container placeholder registry errors must explain the reserved-registry requirement.");
  }
  if (!isPlaceholderImageRepository("registry.example.com/6529reviewbot")) {
    findings.push("container publish plan must classify example registries as placeholders.");
  }
  if (!isPlaceholderImageRepository("localhost:5000/6529reviewbot")) {
    findings.push("container publish plan must classify local registries as placeholders.");
  }
}

function checkDirtyPlan(findings) {
  const plan = collectContainerPublishPlan({
    release: "v0.2.0",
    git: {
      ...cleanMainGit(),
      dirty: true,
    },
    containerCheckResult: {
      runtimeCopies: 6,
      dockerignoreEntries: 15,
    },
  });
  if (plan.ready) {
    findings.push("dirty working tree must block container publish readiness.");
  }
  if (!plan.errors.some((error) => error.includes("working tree must be clean"))) {
    findings.push("dirty working tree error must explain the cleanup requirement.");
  }
}

function checkMissingImagePlan(findings) {
  const plan = collectContainerPublishPlan({
    release: "v0.2.0",
    requireImage: true,
    git: cleanMainGit(),
    containerCheckResult: {
      runtimeCopies: 6,
      dockerignoreEntries: 15,
    },
  });
  if (plan.ready) {
    findings.push("required container publish plans must block placeholder image refs.");
  }
  if (!plan.errors.some((error) => error.includes("operator-owned image repository"))) {
    findings.push("missing image error must explain the operator-owned repository requirement.");
  }
}

function checkImageValidation(findings) {
  try {
    normalizeImageRef("https://registry.example.com/6529reviewbot");
    findings.push("container publish plan must reject image refs that include URL schemes.");
  } catch (error) {
    if (!String(error.message).includes("URL scheme")) {
      findings.push("container image URL scheme rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com/6529reviewbot:latest");
    findings.push("container publish plan must reject image refs that include tags.");
  } catch (error) {
    if (!String(error.message).includes("must not include a tag")) {
      findings.push("container image tag rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com/team:latest/6529reviewbot");
    findings.push("container publish plan must reject image refs with tag-like path segments.");
  } catch (error) {
    if (!String(error.message).includes("must not include a tag")) {
      findings.push("container image path-segment tag rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com/6529reviewbot@sha256:abc");
    findings.push("container publish plan must reject image refs that include digests.");
  } catch (error) {
    if (!String(error.message).includes("must not include a digest")) {
      findings.push("container image digest rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com//6529reviewbot");
    findings.push("container publish plan must reject image refs with empty path segments.");
  } catch (error) {
    if (!String(error.message).includes("empty path segments")) {
      findings.push("container image empty-segment rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com/6529ReviewBot");
    findings.push("container publish plan must reject image refs with uppercase repository characters.");
  } catch (error) {
    if (!String(error.message).includes("lowercase")) {
      findings.push("container image uppercase rejection should be explicit.");
    }
  }
  if (normalizeImageRef("registry.example.com:5000/6529reviewbot") !== "registry.example.com:5000/6529reviewbot") {
    findings.push("container publish plan must allow numeric registry ports.");
  }
  try {
    normalizeImageRef("registry.example.com:port/6529reviewbot");
    findings.push("container publish plan must reject image refs with non-numeric registry ports.");
  } catch (error) {
    if (!String(error.message).includes("registry port")) {
      findings.push("container image non-numeric port rejection should be explicit.");
    }
  }
}

function checkCli(findings) {
  try {
    containerPublishPlanCli.parseArgs(["--nope"]);
    findings.push("container publish plan CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("container publish plan CLI unknown-argument error should be explicit.");
    }
  }

  const plan = containerPublishPlanCli.main([
    "--image",
    "ghcr.io/6529-collections/6529reviewbot",
    "--release",
    "v0.2.0",
    "--require-ready",
    "--quiet",
  ], {
    git: cleanMainGit(),
    containerCheckResult: {
      runtimeCopies: 6,
      dockerignoreEntries: 15,
    },
    noExitCode: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push("container publish plan CLI must return ready for clean main and valid image contract.");
  }
}

function cleanMainGit() {
  return {
    branch: "main",
    commit: "abcdef1234567890abcdef1234567890abcdef12",
    dirty: false,
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
  };
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["container:publish-plan", "check:container-publish-plan"],
    "src/container-publish-plan.cjs": [
      "collectContainerPublishPlan",
      "checkContainerImage",
      "isPlaceholderImageRepository",
      "normalizeImageRepositoryRef",
      "This command does not build, push, scan, or publish container images.",
    ],
    "src/placeholder-hosts.cjs": [
      "isPlaceholderImageRepository",
      "isPlaceholderOrigin",
      "PLACEHOLDER_HOSTS",
    ],
    "src/image-repository-ref.cjs": [
      "normalizeImageRepositoryRef",
      "URL scheme",
      "empty path segments",
      "registry port",
      "lowercase",
    ],
    "bin/container-publish-plan.cjs": [
      "npm run container:publish-plan",
      "--require-ready",
      "This command does not build, push, scan, or publish container images.",
    ],
    "scripts/release-check.cjs": ["scripts/check-container-publish-plan-contract.cjs"],
    "scripts/smoke-test.cjs": [
      "containerPublishPlanContractCheck",
      "containerPublishPlanContractCheck.checkContainerPublishPlanContract",
    ],
    "config/release-operations-map.json": [
      "container-publish-plan-contract",
      "container-publish-plan",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run container:publish-plan",
      "npm run check:container-publish-plan",
      "[Container Publish Plan](docs/container-publish-plan.md)",
    ],
    "docs/container-publish-plan.md": [
      "npm run container:publish-plan",
      "--require-ready",
      "without a URL scheme",
      "empty path segments",
      "registry port",
      "lowercase",
      "documentation, example, local, or reserved registries",
      "does not build, push, scan, or publish container images",
      "npm run check:container-publish-plan",
    ],
    "docs/container-deployment.md": [
      "npm run container:publish-plan",
      "image digest, builder identity, source commit, and vulnerability scan",
    ],
    "docs/release-readiness.md": [
      "container publish plan",
      "npm run check:container-publish-plan",
    ],
    "docs/roadmap.md": [
      "container publish plan",
      "operator-owned registry",
    ],
    "docs/release-operations-map.md": [
      "npm run check:container-publish-plan",
      "container:publish-plan",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkContainerPublishPlanContract,
};
