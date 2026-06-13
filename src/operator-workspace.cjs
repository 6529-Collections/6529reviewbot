"use strict";

const fs = require("fs");
const path = require("path");
const {
  createDogfoodStatusSkeleton,
  assertDogfoodReady,
  loadDogfoodChecklist,
  loadDogfoodStatus,
  mergeDogfoodStatus,
  summarizeDogfood,
  writeDogfoodStatusFile,
} = require("./dogfood-status.cjs");
const {
  createOperatorEvidenceSkeleton,
  assertOperatorEvidenceReady,
  loadOperatorEvidence,
  summarizeOperatorEvidence,
  writeOperatorEvidenceFile,
} = require("./operator-evidence.cjs");
const {
  createProductionCutoverStatusSkeleton,
  assertProductionCutoverReady,
  loadProductionCutoverChecklist,
  loadProductionCutoverStatus,
  mergeProductionCutoverStatus,
  summarizeProductionCutover,
  writeProductionCutoverStatusFile,
} = require("./production-cutover.cjs");
const {
  createReleaseGateStatusSkeleton,
  assertReleaseGatesReady,
  loadReleaseGateStatus,
  loadReleaseGates,
  mergeReleaseGateStatus,
  summarizeReleaseGates,
  writeReleaseGateStatusFile,
} = require("./release-gates.cjs");
const {
  createSecurityReviewStatusSkeleton,
  assertSecurityReviewReady,
  loadSecurityReviewChecklist,
  loadSecurityReviewStatus,
  mergeSecurityReviewStatus,
  summarizeSecurityReview,
  writeSecurityReviewStatusFile,
} = require("./security-review-status.cjs");

const DEFAULT_OPERATOR_WORKSPACE_FILES = {
  dogfoodStatus: "dogfood-status.json",
  operatorEvidence: "operator-evidence.json",
  productionCutoverStatus: "production-cutover-status.json",
  readme: "README.md",
  releaseGateStatus: "v0-release-status.json",
  securityReviewStatus: "security-review-status.json",
};

function createOperatorWorkspace(options = {}) {
  if (!options.directory) {
    throw new Error("operator workspace --dir is required.");
  }
  const directory = path.resolve(options.directory);
  assertWorkspaceDirectory(directory, options);
  fs.mkdirSync(directory, { recursive: true });
  const targetFiles = Object.values(DEFAULT_OPERATOR_WORKSPACE_FILES).map((fileName) =>
    workspacePath(directory, fileName)
  );
  assertWritableWorkspaceFiles(targetFiles, options);

  const files = [];
  const releaseGates = loadReleaseGates(options.releaseGatesFile);
  const releaseGateStatusPath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus);
  const releaseGateStatus = writeReleaseGateStatusFile(
    releaseGateStatusPath,
    createReleaseGateStatusSkeleton(releaseGates),
    { force: options.force }
  );
  files.push(fileSummary("release-gate-status", releaseGateStatusPath, "Private v0 release gate status overlay."));

  const dogfoodChecklist = loadDogfoodChecklist(options.dogfoodChecklistFile);
  const dogfoodStatusPath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.dogfoodStatus);
  const dogfoodStatus = writeDogfoodStatusFile(
    dogfoodStatusPath,
    createDogfoodStatusSkeleton(dogfoodChecklist),
    { force: options.force }
  );
  files.push(fileSummary("dogfood-status", dogfoodStatusPath, "Private dogfood execution status overlay."));

  const securityReviewChecklist = loadSecurityReviewChecklist(options.securityReviewChecklistFile);
  const securityReviewStatusPath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.securityReviewStatus);
  const securityReviewStatus = writeSecurityReviewStatusFile(
    securityReviewStatusPath,
    createSecurityReviewStatusSkeleton(securityReviewChecklist),
    { force: options.force }
  );
  files.push(fileSummary("security-review-status", securityReviewStatusPath, "Private manual security-review status overlay."));

  const productionCutoverChecklist = loadProductionCutoverChecklist(options.productionCutoverChecklistFile);
  const productionCutoverStatusPath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus);
  const productionCutoverStatus = writeProductionCutoverStatusFile(
    productionCutoverStatusPath,
    createProductionCutoverStatusSkeleton(productionCutoverChecklist),
    { force: options.force }
  );
  files.push(fileSummary("production-cutover-status", productionCutoverStatusPath, "Private production cutover status overlay."));

  const operatorEvidencePath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.operatorEvidence);
  const operatorEvidence = writeOperatorEvidenceFile(
    operatorEvidencePath,
    createOperatorEvidenceSkeleton({
      commit: options.commit,
      date: options.date,
      environment: options.environment,
      operator: options.operator,
      privateEvidenceLocation: options.privateEvidenceLocation,
      productionCutoverStatusFile: DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus,
      publicSummaryLocation: options.publicSummaryLocation,
      release: options.release || releaseGates.release,
      releaseGateStatusFile: DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus,
    }),
    { force: options.force }
  );
  files.push(fileSummary("operator-evidence", operatorEvidencePath, "Private structured operator evidence file."));

  const readmePath = workspacePath(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.readme);
  writeWorkspaceReadme(readmePath, {
    directory,
    files,
    force: options.force,
    release: releaseGates.release,
  });
  files.push(fileSummary("readme", readmePath, "Private workspace command guide."));

  const workspace = {
    directory,
    release: releaseGates.release,
    files,
    summaries: {
      dogfood: summarizeDogfood(mergeDogfoodStatus(dogfoodChecklist, dogfoodStatus)),
      operatorEvidence: summarizeOperatorEvidence(operatorEvidence),
      productionCutover: summarizeProductionCutover(
        mergeProductionCutoverStatus(productionCutoverChecklist, productionCutoverStatus)
      ),
      releaseGates: summarizeReleaseGates(mergeReleaseGateStatus(releaseGates, releaseGateStatus)),
      securityReview: summarizeSecurityReview(
        mergeSecurityReviewStatus(securityReviewChecklist, securityReviewStatus)
      ),
    },
  };
  workspace.ready = operatorWorkspaceReady(workspace);
  return workspace;
}

function publicOperatorWorkspaceSummary(workspace, options = {}) {
  return {
    release: workspace.release,
    ready: workspace.ready,
    directory: options.showPaths ? workspace.directory : "[operator-workspace]",
    files: workspace.files.map((file) => ({
      id: file.id,
      file: options.showPaths ? file.path : path.basename(file.path),
      description: file.description,
    })),
    summaries: workspace.summaries,
  };
}

function checkOperatorWorkspace(options = {}) {
  if (!options.directory) {
    throw new Error("operator workspace --dir is required.");
  }
  const directory = path.resolve(options.directory);
  const filePaths = operatorWorkspaceFilePaths(directory);
  assertExistingWorkspaceFiles(Object.values(filePaths));

  const releaseGates = loadReleaseGates(options.releaseGatesFile);
  const releaseGateStatus = loadReleaseGateStatus(filePaths.releaseGateStatus);
  const releaseGatesWithStatus = mergeReleaseGateStatus(releaseGates, releaseGateStatus, {
    requireComplete: options.requireReady,
  });

  const dogfoodChecklist = loadDogfoodChecklist(options.dogfoodChecklistFile);
  const dogfoodStatus = loadDogfoodStatus(filePaths.dogfoodStatus);
  const dogfoodWithStatus = mergeDogfoodStatus(dogfoodChecklist, dogfoodStatus, {
    requireComplete: options.requireReady,
  });

  const securityReviewChecklist = loadSecurityReviewChecklist(options.securityReviewChecklistFile);
  const securityReviewStatus = loadSecurityReviewStatus(filePaths.securityReviewStatus);
  const securityReviewWithStatus = mergeSecurityReviewStatus(securityReviewChecklist, securityReviewStatus, {
    requireComplete: options.requireReady,
  });

  const productionCutoverChecklist = loadProductionCutoverChecklist(options.productionCutoverChecklistFile);
  const productionCutoverStatus = loadProductionCutoverStatus(filePaths.productionCutoverStatus);
  const productionCutoverWithStatus = mergeProductionCutoverStatus(
    productionCutoverChecklist,
    productionCutoverStatus,
    { requireComplete: options.requireReady }
  );

  const operatorEvidence = loadOperatorEvidence(filePaths.operatorEvidence);
  const workspace = {
    directory,
    release: releaseGates.release,
    files: workspaceFiles(directory),
    summaries: {
      dogfood: summarizeDogfood(dogfoodWithStatus),
      operatorEvidence: summarizeOperatorEvidence(operatorEvidence),
      productionCutover: summarizeProductionCutover(productionCutoverWithStatus),
      releaseGates: summarizeReleaseGates(releaseGatesWithStatus),
      securityReview: summarizeSecurityReview(securityReviewWithStatus),
    },
  };
  workspace.ready = operatorWorkspaceReady(workspace);
  if (options.requireReady) {
    assertOperatorWorkspaceReady(workspace, {
      dogfood: dogfoodWithStatus,
      operatorEvidence,
      productionCutover: productionCutoverWithStatus,
      releaseGates: releaseGatesWithStatus,
      securityReview: securityReviewWithStatus,
    });
  }
  return workspace;
}

function assertOperatorWorkspaceReady(workspace, documents = {}) {
  if (documents.releaseGates) {
    assertReleaseGatesReady(documents.releaseGates);
  }
  if (documents.dogfood) {
    assertDogfoodReady(documents.dogfood);
  }
  if (documents.securityReview) {
    assertSecurityReviewReady(documents.securityReview);
  }
  if (documents.productionCutover) {
    assertProductionCutoverReady(documents.productionCutover);
  }
  if (documents.operatorEvidence) {
    assertOperatorEvidenceReady(documents.operatorEvidence);
  }
  if (!operatorWorkspaceReady(workspace)) {
    const notReady = Object.entries(workspace.summaries)
      .filter(([_key, summary]) => !summary.ready)
      .map(([key, summary]) => `${key}: ${summary.pending} pending, ${summary.blocked} blocked`)
      .join("; ");
    throw new Error(`operator workspace is not ready: ${notReady}.`);
  }
  return workspace;
}

function renderOperatorWorkspaceSummaryMarkdown(workspace, options = {}) {
  const summary = publicOperatorWorkspaceSummary(workspace, options);
  const lines = [
    `# ${summary.release} Operator Workspace`,
    "",
    `Ready: ${summary.ready ? "yes" : "no"}`,
    `Directory: ${summary.directory}`,
    "",
    "Created private release-operator evidence skeletons. Keep this directory",
    "outside public commits unless an operator intentionally publishes redacted",
    "summaries.",
    "",
    "## Files",
  ];
  for (const file of summary.files) {
    lines.push(`- \`${file.file}\`: ${file.description}`);
  }
  lines.push("", "## Starting Commands", "");
  lines.push("```bash");
  lines.push(`npm run v0:gates -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus} --summary`);
  lines.push(`npm run dogfood:status -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.dogfoodStatus} --summary`);
  lines.push(`npm run security:review -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.securityReviewStatus} --summary`);
  lines.push(`npm run production:cutover -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus} --summary`);
  lines.push(`npm run operator:evidence -- -- --file ${DEFAULT_OPERATOR_WORKSPACE_FILES.operatorEvidence} --summary`);
  lines.push("```");
  return `${lines.join("\n")}\n`;
}

function operatorWorkspaceReady(workspace) {
  return Object.values(workspace.summaries).every((summary) => summary.ready);
}

function writeWorkspaceReadme(filePath, options = {}) {
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`operator workspace README already exists: ${filePath}`);
  }
  fs.writeFileSync(filePath, privateWorkspaceReadme(options), "utf8");
}

function assertWritableWorkspaceFiles(filePaths, options = {}) {
  if (options.force) {
    return;
  }
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      throw new Error(`operator workspace file already exists: ${filePath}`);
    }
  }
}

function assertExistingWorkspaceFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`operator workspace file is missing: ${filePath}`);
    }
  }
}

function privateWorkspaceReadme(options = {}) {
  const release = options.release || "v0.1.0";
  return `# ${release} Operator Workspace

This directory is intended for private release and dogfood evidence. Do not
commit it to the public repository.

## Files

- \`${DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus}\`: v0 release gate status.
- \`${DEFAULT_OPERATOR_WORKSPACE_FILES.dogfoodStatus}\`: command-only and limited initial-review dogfood status.
- \`${DEFAULT_OPERATOR_WORKSPACE_FILES.securityReviewStatus}\`: manual security-review status.
- \`${DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus}\`: live dogfood or production cutover status.
- \`${DEFAULT_OPERATOR_WORKSPACE_FILES.operatorEvidence}\`: structured operator evidence for public-safe summaries.

## Commands

\`\`\`bash
npm run v0:gates -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus} --summary
npm run dogfood:status -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.dogfoodStatus} --summary
npm run security:review -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.securityReviewStatus} --summary
npm run production:cutover -- -- --status-file ${DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus} --summary
npm run operator:evidence -- -- --file ${DEFAULT_OPERATOR_WORKSPACE_FILES.operatorEvidence} --summary
npm run release:candidate -- -- --operator-workspace . --strict-preflight
\`\`\`

Copy only redacted summaries or release-candidate output into public PRs,
issues, releases, or durable manager memory.
`;
}

function assertWorkspaceDirectory(directory, options = {}) {
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : "";
  if (repoRoot && isInside(repoRoot, directory) && !options.allowRepoDir) {
    throw new Error("operator workspace directory must be outside the public repository unless --allow-repo-dir is set.");
  }
}

function fileSummary(id, filePath, description) {
  return {
    id,
    path: filePath,
    description,
  };
}

function workspacePath(directory, fileName) {
  return path.join(directory, fileName);
}

function operatorWorkspaceFilePaths(directory) {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPERATOR_WORKSPACE_FILES).map(([id, fileName]) => [
      id,
      workspacePath(directory, fileName),
    ])
  );
}

function workspaceFiles(directory) {
  const paths = operatorWorkspaceFilePaths(directory);
  return [
    fileSummary("release-gate-status", paths.releaseGateStatus, "Private v0 release gate status overlay."),
    fileSummary("dogfood-status", paths.dogfoodStatus, "Private dogfood execution status overlay."),
    fileSummary("security-review-status", paths.securityReviewStatus, "Private manual security-review status overlay."),
    fileSummary("production-cutover-status", paths.productionCutoverStatus, "Private production cutover status overlay."),
    fileSummary("operator-evidence", paths.operatorEvidence, "Private structured operator evidence file."),
    fileSummary("readme", paths.readme, "Private workspace command guide."),
  ];
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

module.exports = {
  DEFAULT_OPERATOR_WORKSPACE_FILES,
  assertOperatorWorkspaceReady,
  checkOperatorWorkspace,
  createOperatorWorkspace,
  operatorWorkspaceReady,
  privateWorkspaceReadme,
  publicOperatorWorkspaceSummary,
  renderOperatorWorkspaceSummaryMarkdown,
};
