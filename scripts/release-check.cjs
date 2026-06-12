#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const repoConfigTemplates = [
  "templates/dogfood-command-only-config.yml",
  "templates/dogfood-repository-config.yml",
  "templates/repository-config.yml",
];

runNode("scripts/check.cjs");
runNode("scripts/smoke-test.cjs");
runNode("bin/validate-model-catalog.cjs", ["config/model-catalog.json"]);
runNode("bin/apply-model-prices.cjs", ["--file", "config/model-prices.example.json"]);
runNode("bin/support-bundle.cjs", ["--json", "--quiet"]);
runNode("bin/validate-repository-config.cjs", repoConfigTemplates);
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
