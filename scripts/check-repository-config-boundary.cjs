#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const repositoryConfig = require("../src/repository-config.cjs");
const { admissionPolicyFromEnv } = require("../src/admission-policy.cjs");
const { budgetPolicyFromEnv } = require("../src/budget-admission.cjs");
const { parseReviewLanes } = require("../src/review-job.cjs");

const root = path.resolve(__dirname, "..");
const boundaryDocs = ["docs/repository-config.md", "docs/architecture.md"];
const expectedConfigPaths = [
  ".github/6529bot.yml",
  ".github/6529bot.yaml",
  ".github/6529bot.json",
  ".6529reviewbot.yml",
  ".6529reviewbot.yaml",
  ".6529reviewbot.json",
];

function main() {
  const result = checkRepositoryConfigBoundary();
  console.log(
    `repository config boundary ok (${result.configPaths} paths, ${result.boundaryChecks} boundary checks, ${result.docs} docs checked)`
  );
}

function checkRepositoryConfigBoundary(options = {}) {
  const findings = [];

  checkConfigPolicy(findings);
  checkBaseRefBoundary(findings);
  checkJobPolicyBoundary(findings);
  checkAdmissionBoundary(findings);
  checkBudgetBoundary(findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`repository config boundary check found ${findings.length} issue(s).`);
  }

  return {
    configPaths: expectedConfigPaths.length,
    boundaryChecks: 5,
    docs: boundaryDocs.length,
  };
}

function checkConfigPolicy(findings) {
  const policy = repositoryConfig.repositoryConfigPolicyFromEnv({});
  if (policy.source !== "none") {
    findings.push(`default repository config source must be none, got ${policy.source}.`);
  }
  if (policy.required !== false) {
    findings.push("repository config must be optional by default.");
  }
  if (policy.maxBytes !== repositoryConfig.DEFAULT_MAX_CONFIG_BYTES) {
    findings.push(
      `default repository config max bytes must be ${repositoryConfig.DEFAULT_MAX_CONFIG_BYTES}, got ${policy.maxBytes}.`
    );
  }
  if (!arraysEqual(policy.paths, expectedConfigPaths)) {
    findings.push(`default repository config paths must be ${JSON.stringify(expectedConfigPaths)}, got ${JSON.stringify(policy.paths)}.`);
  }
  expectError(
    () => repositoryConfig.repositoryConfigPolicyFromEnv({ REVIEWBOT_REPOSITORY_CONFIG_PATHS: "../6529bot.yml" }),
    /Invalid repository config path/,
    "unsafe repository config paths must be rejected",
    findings
  );
}

function checkBaseRefBoundary(findings) {
  const event = {
    baseSha: "base-sha-from-target-repo",
    headSha: "untrusted-pr-head",
    repository: { defaultBranch: "main" },
  };
  const ref = repositoryConfig.repositoryConfigRefForEvent(event);
  if (ref !== event.baseSha) {
    findings.push(`repository config ref must prefer baseSha, got ${ref}.`);
  }
  const defaultRef = repositoryConfig.repositoryConfigRefForEvent({
    repository: { defaultBranch: "main" },
  });
  if (defaultRef !== "main") {
    findings.push(`repository config ref must fall back to default branch, got ${defaultRef}.`);
  }
}

function checkJobPolicyBoundary(findings) {
  const basePolicy = {
    maxJobsPerDelivery: 4,
    lanes: parseReviewLanes("anthropic:claude-opus-4-8,openai:gpt-5.5"),
  };
  const config = repositoryConfig.parseRepositoryConfigText(
    [
      "version: 1",
      "limits:",
      "  maxJobsPerDelivery: 8",
      "lanes:",
      "  - provider: anthropic",
      "    model: claude-opus-4-8",
      "  - provider: openrouter",
      "    model: anthropic/claude-sonnet-4",
      "",
    ].join("\n"),
    "boundary.yml"
  );
  const merged = repositoryConfig.mergeRepositoryJobPolicy(basePolicy, config);
  if (merged.maxJobsPerDelivery !== 4) {
    findings.push(`repository config must not raise maxJobsPerDelivery, got ${merged.maxJobsPerDelivery}.`);
  }
  const lanes = merged.lanes.map((lane) => `${lane.provider}:${lane.model}`);
  if (!arraysEqual(lanes, ["anthropic:claude-opus-4-8"])) {
    findings.push(`repository config lanes must be intersected with central lanes, got ${JSON.stringify(lanes)}.`);
  }

  const narrowerConfig = repositoryConfig.parseRepositoryConfigText(
    "version: 1\nlimits:\n  maxJobsPerDelivery: 2\n",
    "boundary.yml"
  );
  const narrowerMerged = repositoryConfig.mergeRepositoryJobPolicy(basePolicy, narrowerConfig);
  if (narrowerMerged.maxJobsPerDelivery !== 2) {
    findings.push(`repository config must be able to lower maxJobsPerDelivery, got ${narrowerMerged.maxJobsPerDelivery}.`);
  }
  if (narrowerMerged.lanes.length !== basePolicy.lanes.length) {
    findings.push("omitting repository config lanes must keep the central lane set.");
  }
}

function checkAdmissionBoundary(findings) {
  const base = admissionPolicyFromEnv({
    REVIEWBOT_PUBLIC_REPO_MODE: "trusted",
    REVIEWBOT_PRIVATE_REPO_MODE: "trusted",
    REVIEWBOT_DRAFT_PR_MODE: "allow",
    REVIEWBOT_TRUSTED_PERMISSION: "write",
    REVIEWBOT_TRUSTED_USERS: "central-maintainer",
  });
  const config = repositoryConfig.parseRepositoryConfigText(
    [
      "version: 1",
      "admission:",
      "  publicRepoMode: open",
      "  privateRepoMode: open",
      "  draftPrMode: skip",
      "  trustedPermission: admin",
      "  trustedUsers: [repo-maintainer]",
      "  denyUsers: [blocked-user]",
      "",
    ].join("\n"),
    "boundary.yml"
  );
  const merged = repositoryConfig.mergeRepositoryAdmissionPolicy(base, config);
  const expected = {
    publicRepoMode: "trusted",
    privateRepoMode: "trusted",
    draftPrMode: "skip",
    trustedPermission: "admin",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (merged[key] !== value) {
      findings.push(`merged admission ${key} must be ${value}, got ${merged[key]}.`);
    }
  }
  for (const login of ["central-maintainer", "repo-maintainer"]) {
    if (!merged.trustedUsers.has(login)) {
      findings.push(`merged admission trusted users must include ${login}.`);
    }
  }
  if (!merged.denyUsers.has("blocked-user")) {
    findings.push("merged admission deny users must include repository-level deny users.");
  }

  const offConfig = repositoryConfig.parseRepositoryConfigText(
    "version: 1\nadmission:\n  publicRepoMode: off\n",
    "boundary.yml"
  );
  const offMerged = repositoryConfig.mergeRepositoryAdmissionPolicy(base, offConfig);
  if (offMerged.publicRepoMode !== "off") {
    findings.push(`repository config must be able to tighten public repo mode to off, got ${offMerged.publicRepoMode}.`);
  }
}

function checkBudgetBoundary(findings) {
  const base = budgetPolicyFromEnv({
    REVIEWBOT_BUDGET_MODE: "warn",
    REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD: "2",
    REVIEWBOT_BUDGET_REPO_DAILY_USD: "10",
    REVIEWBOT_BUDGET_REPO_MONTHLY_USD: "100",
    REVIEWBOT_BUDGET_PR_DAILY_USD: "3",
  });
  const config = repositoryConfig.parseRepositoryConfigText(
    [
      "version: 1",
      "budget:",
      "  mode: off",
      "  defaultEstimatedCostUsd: 1",
      "  caps:",
      "    repo:",
      "      dailyUsd: 25",
      "      weeklyUsd: 40",
      "      monthlyUsd: 50",
      "    requestor:",
      "      dailyUsd: 5",
      "",
    ].join("\n"),
    "boundary.yml"
  );
  const merged = repositoryConfig.mergeRepositoryBudgetPolicy(base, config);
  if (merged.mode !== "warn") {
    findings.push(`repository config must not loosen budget mode from warn to off, got ${merged.mode}.`);
  }
  if (merged.defaultEstimatedCostUsd !== 2) {
    findings.push(`repository config must not lower default estimated cost, got ${merged.defaultEstimatedCostUsd}.`);
  }
  if (merged.caps.repo.dailyBudgetUsd !== 10) {
    findings.push(`repository config must not raise repo daily cap, got ${merged.caps.repo.dailyBudgetUsd}.`);
  }
  if (merged.caps.repo.weeklyBudgetUsd !== 40) {
    findings.push(`repository config must add missing repo weekly cap, got ${merged.caps.repo.weeklyBudgetUsd}.`);
  }
  if (merged.caps.repo.monthlyBudgetUsd !== 50) {
    findings.push(`repository config must lower repo monthly cap, got ${merged.caps.repo.monthlyBudgetUsd}.`);
  }
  if (merged.caps.requestor.dailyBudgetUsd !== 5) {
    findings.push(`repository config must add requestor daily cap, got ${merged.caps.requestor.dailyBudgetUsd}.`);
  }
  if (merged.caps.pr.dailyBudgetUsd !== 3) {
    findings.push(`central PR daily cap must remain in force, got ${merged.caps.pr.dailyBudgetUsd}.`);
  }

  const enforceConfig = repositoryConfig.parseRepositoryConfigText(
    "version: 1\nbudget:\n  mode: enforce\n  defaultEstimatedCostUsd: 3\n",
    "boundary.yml"
  );
  const enforceMerged = repositoryConfig.mergeRepositoryBudgetPolicy(base, enforceConfig);
  if (enforceMerged.mode !== "enforce") {
    findings.push(`repository config must be able to tighten budget mode to enforce, got ${enforceMerged.mode}.`);
  }
  if (enforceMerged.defaultEstimatedCostUsd !== 3) {
    findings.push(`repository config must be able to raise default estimated cost, got ${enforceMerged.defaultEstimatedCostUsd}.`);
  }
}

function checkDocs(docTexts, findings) {
  const requiredSnippets = [
    "config is read from the base ref, not the PR head",
    "select provider/model lanes from the centrally allowed lane set",
    "introduce a provider/model lane that central App policy did not allow",
    "raise central budget caps",
    "make central admission policy less restrictive",
    "off > trusted > open",
    "enforce > warn > off",
    "taking the lower non-empty cap",
    "taking the lower value between central policy and repo config",
  ];
  const repositoryDoc = docTexts["docs/repository-config.md"] || readText("docs/repository-config.md");
  const normalizedRepositoryDoc = normalizeWhitespace(repositoryDoc);
  for (const snippet of requiredSnippets) {
    if (!normalizedRepositoryDoc.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/repository-config.md must include '${snippet}'.`);
    }
  }

  const architectureDoc = normalizeWhitespace(docTexts["docs/architecture.md"] || readText("docs/architecture.md"));
  if (!architectureDoc.includes("tighter budget/admission rules")) {
    findings.push("docs/architecture.md must describe repository config as a narrowing layer.");
  }
  if (!architectureDoc.includes("cannot expand model/provider access")) {
    findings.push("docs/architecture.md must state repository config cannot expand model/provider access.");
  }
}

function expectError(fn, pattern, context, findings) {
  try {
    fn();
    findings.push(`${context}.`);
  } catch (error) {
    if (!pattern.test(error.message)) {
      findings.push(`${context}; got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
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
  checkRepositoryConfigBoundary,
  expectedConfigPaths,
};
