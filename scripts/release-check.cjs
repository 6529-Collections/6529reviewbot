#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const repoConfigTemplates = [
  ".github/6529bot.yml",
  "templates/dogfood-command-only-config.yml",
  "templates/dogfood-repository-config.yml",
  "templates/repository-config.yml",
];
const operatorWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-release-check-workspace-"));

runNode("scripts/check.cjs");
runNode("scripts/check-doc-links.cjs");
runNode("scripts/check-doc-index.cjs");
runNode("scripts/check-public-governance.cjs");
runNode("scripts/check-install-guide-contract.cjs");
runNode("scripts/check-dependabot-config.cjs");
runNode("scripts/check-container-image.cjs");
runNode("scripts/check-comment-commands.cjs");
runNode("scripts/check-review-workflow-kinds.cjs");
runNode("scripts/check-review-context-boundary.cjs");
runNode("scripts/check-model-defaults.cjs");
runNode("scripts/check-provider-contract.cjs");
runNode("scripts/check-provider-adapters.cjs");
runNode("scripts/check-ledger-privacy-contract.cjs");
runNode("scripts/check-webhook-replay-contract.cjs");
runNode("scripts/check-dogfood-target-contract.cjs");
runNode("scripts/check-dogfood-status-contract.cjs");
runNode("scripts/check-dogfood-readiness-contract.cjs");
runNode("scripts/check-dogfood-promotion-contract.cjs");
runNode("scripts/check-dogfood-go-live-contract.cjs");
runNode("scripts/check-operator-workspace-contract.cjs");
runNode("scripts/check-operator-evidence-contract.cjs");
runNode("scripts/check-production-cutover-contract.cjs");
runNode("scripts/check-security-review-status-contract.cjs");
runNode("scripts/check-review-bin-entrypoints.cjs");
runNode("scripts/check-review-comment-format.cjs");
runNode("scripts/check-admission-policy.cjs");
runNode("scripts/check-repository-config-boundary.cjs");
runNode("scripts/check-worker-adapter-contract.cjs");
runNode("scripts/check-admin-auth-contract.cjs");
runNode("scripts/check-usage-api-routes.cjs");
runNode("scripts/check-admin-snapshot-contract.cjs");
runNode("scripts/check-support-bundle-contract.cjs");
runNode("scripts/check-diagnostics-redaction.cjs");
runNode("scripts/check-budget-scopes.cjs");
runNode("scripts/check-run-control-scopes.cjs");
runNode("scripts/check-alert-dimensions.cjs");
runNode("scripts/check-alert-notifier-modes.cjs");
runNode("scripts/check-checklist-runbooks.cjs");
runNode("scripts/check-6529-io-env-template.cjs");
runNode("scripts/check-env-templates.cjs");
runNode("scripts/check-github-app-manifest-contract.cjs");
runNode("scripts/check-github-app-auth-contract.cjs");
runNode("scripts/check-github-app-routes-contract.cjs");
runNode("scripts/check-workflow-actions.cjs");
runNode("scripts/check-workflow-permissions.cjs");
runNode("scripts/check-public-artifacts.cjs");
runNode("scripts/check-preflight-fixtures.cjs");
runNode("scripts/check-preflight-contract.cjs");
runNode("scripts/check-release-gate-parity.cjs");
runNode("scripts/check-v0-gates-contract.cjs");
runNode("scripts/check-release-candidate-contract.cjs");
runNode("scripts/check-release-notes-template.cjs");
runNode("scripts/check-release-operations-map.cjs");
runNode("scripts/check-self-dogfood-replay.cjs");
runNode("scripts/smoke-test.cjs");
runNode("bin/validate-usage-api-openapi.cjs", ["docs/usage-api.openapi.json"]);
runNode("bin/validate-model-catalog.cjs", ["config/model-catalog.json"]);
runNode("bin/apply-budget-policies.cjs", ["--file", "config/budget-policies.example.json", "--quiet"]);
runNode("bin/apply-budget-policies.cjs", ["--file", "config/budget-policies.dogfood.example.json", "--quiet"]);
runNode("bin/apply-model-prices.cjs", ["--file", "config/model-prices.example.json"]);
runNode("bin/operator-workspace.cjs", ["--dir", operatorWorkspaceDir, "--quiet"]);
runNode("bin/dogfood-target.cjs", ["--mode", "command-only", "--require-ready", "--quiet"]);
runNode("bin/dogfood-target.cjs", ["--mode", "limited-initial", "--require-ready", "--quiet"]);
runNode("bin/dogfood-readiness.cjs", ["--json", "--quiet"]);
runNode("bin/dogfood-readiness.cjs", [
  "--operator-workspace",
  operatorWorkspaceDir,
  "--json",
  "--quiet",
]);
runNode("bin/dogfood-promotion.cjs", ["--json", "--quiet"]);
runNode("bin/dogfood-promotion.cjs", [
  "--operator-workspace",
  operatorWorkspaceDir,
  "--json",
  "--quiet",
]);
runNode("bin/dogfood-go-live.cjs", ["--json", "--quiet"]);
runNode("bin/dogfood-go-live.cjs", [
  "--operator-workspace",
  operatorWorkspaceDir,
  "--json",
  "--quiet",
]);
runNode("bin/dogfood-status.cjs", ["--json", "--quiet"]);
runNode("bin/dogfood-status.cjs", [
  "--status-file",
  "config/dogfood-status.example.json",
  "--summary",
  "--json",
  "--quiet",
]);
runNode("bin/security-review-status.cjs", ["--json", "--quiet"]);
runNode("bin/security-review-status.cjs", [
  "--status-file",
  "config/security-review-status.example.json",
  "--summary",
  "--json",
  "--quiet",
]);
runNode("bin/support-bundle.cjs", ["--json", "--quiet"]);
runNode("bin/operator-evidence.cjs", [
  "--file",
  "config/production-evidence.example.json",
  "--json",
  "--quiet",
]);
runNode("bin/production-cutover.cjs", ["--json", "--quiet"]);
runNode("bin/production-cutover.cjs", [
  "--status-file",
  "config/production-cutover-status.example.json",
  "--summary",
  "--json",
  "--quiet",
]);
runNode("bin/release-candidate.cjs", ["--json", "--quiet"]);
runNode("bin/release-candidate.cjs", [
  "--dogfood-status-file",
  "config/dogfood-status.example.json",
  "--json",
  "--quiet",
]);
runNode("bin/release-candidate.cjs", [
  "--security-review-status-file",
  "config/security-review-status.example.json",
  "--json",
  "--quiet",
]);
runNode("bin/release-candidate.cjs", [
  "--dogfood-status-file",
  "config/dogfood-status.example.json",
  "--security-review-status-file",
  "config/security-review-status.example.json",
  "--cutover-status-file",
  "config/production-cutover-status.example.json",
  "--json",
  "--quiet",
]);
runNode("bin/release-operations-map.cjs", ["--summary", "--json", "--quiet"]);
runNode("bin/v0-gates.cjs", ["--json", "--quiet"]);
runNode("bin/v0-gates.cjs", [
  "--status-file",
  "config/v0-release-status.example.json",
  "--json",
  "--quiet",
]);
runNode("bin/v0-gates.cjs", [
  "--status-file",
  "config/v0-release-status.example.json",
  "--summary",
  "--json",
  "--quiet",
]);
runNode("bin/render-github-app-manifest.cjs", ["--host", "https://reviewbot.example.com", "--quiet"]);
runNode("bin/validate-repository-config.cjs", repoConfigTemplates);
parseJsonDirectories(["infra/aws", "templates"]);
parseYamlDirectories(["templates", ".github/workflows"]);
run(gitBin(), ["diff", "--check"]);

console.log("release checks ok");

function parseYamlDirectories(directories) {
  for (const directory of directories) {
    const absoluteDirectory = path.join(root, directory);
    if (!fs.existsSync(absoluteDirectory)) {
      continue;
    }
    for (const file of fs.readdirSync(absoluteDirectory)) {
      if (!/\.ya?ml$/i.test(file)) {
        continue;
      }
      const absolutePath = path.join(absoluteDirectory, file);
      YAML.parse(fs.readFileSync(absolutePath, "utf8"));
    }
  }
}

function parseJsonDirectories(directories) {
  for (const directory of directories) {
    const absoluteDirectory = path.join(root, directory);
    if (!fs.existsSync(absoluteDirectory)) {
      continue;
    }
    for (const file of fs.readdirSync(absoluteDirectory)) {
      if (!/\.json$/i.test(file)) {
        continue;
      }
      JSON.parse(fs.readFileSync(path.join(absoluteDirectory, file), "utf8"));
    }
  }
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });
}

function runNode(script, args = []) {
  run(process.execPath, [path.join(root, script), ...args]);
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
