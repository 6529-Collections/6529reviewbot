#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/install.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkInstallGuideContract();
  console.log(
    `install guide contract ok (${result.guideCases} guide cases, ${result.docs} docs checked)`
  );
}

function checkInstallGuideContract(options = {}) {
  const findings = [];
  const installText = options.installText || readText("docs/install.md");
  const centralEnvText =
    options.centralEnvText || readText("templates/dogfood-central-env.example");
  const commandOnlyConfigText =
    options.commandOnlyConfigText || readText("templates/dogfood-command-only-config.yml");

  checkSectionOrder(installText, findings);
  checkCommandPath(installText, findings);
  checkConservativeRuntimeDefaults(installText, centralEnvText, findings);
  checkCommandOnlyTargetPosture(installText, commandOnlyConfigText, findings);
  checkRollbackPath(installText, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`install guide contract check found ${findings.length} issue(s).`);
  }

  return {
    guideCases: 6,
    docs: targetDocs.length,
  };
}

function checkSectionOrder(text, findings) {
  const headings = [
    "## 1. Prepare The Bot Repository",
    "## 2. Create The GitHub App",
    "## 3. Configure Central Runtime",
    "## 4. Prepare The Ledger",
    "## 5. Start The App In Noop Mode",
    "## 6. Add A Worker Path",
    "## 7. Wire 6529.io Surfaces",
    "## 8. Onboard One Target Repository",
    "## 9. Move Gradually To Live Coverage",
    "## 10. Roll Back",
  ];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) {
      findings.push(`docs/install.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/install.md onboarding sections must stay in order.");
    }
    lastIndex = index;
  }
}

function checkCommandPath(text, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of [
    "npm install",
    "npm run release:check",
    "npm run check:install-guide",
    "npm run preflight",
    "npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet",
    "npm run check:github-app-manifest",
    "npm run check:github-app-auth",
    "npm run check:github-app-routes",
    "npm run github-app:convert -- -- --code <code> --output <private-json-path>",
    "npm run preflight -- -- --strict",
    "npm start",
    "npm run webhook:replay -- -- --payload payload.json --assume-empty-budget",
    "templates/review-job-workflow.yml",
    "npm run check:6529-io-env",
    "npm run dogfood:target -- -- --repository-config <target-repo>/.github/6529bot.yml --mode auto --require-ready",
    "npm run validate:repo-config -- <target-repo>/.github/6529bot.yml",
    "npm run dogfood:readiness",
    "npm --silent run dogfood:promotion",
    "npm --silent run dogfood:go-live",
    "/6529bot security",
  ]) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/install.md must include '${snippet}'.`);
    }
  }
}

function checkConservativeRuntimeDefaults(installText, centralEnvText, findings) {
  for (const setting of [
    "REVIEWBOT_ENABLED=true",
    "REVIEWBOT_PUBLIC_REPO_MODE=trusted",
    "REVIEWBOT_DRAFT_PR_MODE=skip",
    "REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github",
    "REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8",
    "REVIEWBOT_MAX_JOBS_PER_DELIVERY=8",
    "REVIEWBOT_WORKER_ADAPTER=noop",
    "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api",
    "REVIEWBOT_BUDGET_MODE=enforce",
    "REVIEWBOT_JOB_LEDGER_ENABLED=true",
    "REVIEW_USAGE_ENABLED=true",
  ]) {
    if (!installText.includes(setting)) {
      findings.push(`docs/install.md must include conservative default '${setting}'.`);
    }
    if (!centralEnvText.includes(setting)) {
      findings.push(`templates/dogfood-central-env.example must include '${setting}'.`);
    }
  }
}

function checkCommandOnlyTargetPosture(installText, commandOnlyConfigText, findings) {
  const normalizedInstallText = normalizeWhitespace(installText);
  const normalizedConfigText = normalizeWhitespace(commandOnlyConfigText);
  for (const snippet of [
    "templates/dogfood-command-only-config.yml",
    "Start with command-only mode",
  ]) {
    if (!normalizedInstallText.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/install.md must include '${snippet}'.`);
    }
  }
  for (const snippet of [
    "initial: []",
    "followup: []",
    "commands:",
    "enabled: true",
    "maxJobsPerDelivery: 2",
    "publicRepoMode: trusted",
    "dailyUsd: 5",
  ]) {
    if (!normalizedConfigText.includes(normalizeWhitespace(snippet))) {
      findings.push(`command-only dogfood posture must include '${snippet}'.`);
    }
  }
}

function checkRollbackPath(text, findings) {
  for (const snippet of [
    "REVIEWBOT_ENABLED=false",
    "REVIEWBOT_WORKER_ADAPTER=noop",
    "REVIEWBOT_PUBLIC_REPO_MODE=off",
    "REVIEWBOT_DISABLED_REPOS=<owner/repo>",
    "enabled: false",
    "uninstall the GitHub App from the target repository",
    "disable provider keys",
    "disable alert or AWS access",
  ]) {
    if (!text.includes(snippet)) {
      findings.push(`docs/install.md rollback path must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:install-guide"],
    "docs/install.md": [
      "npm run check:install-guide",
      "conservative dogfood installation",
    ],
    "docs/release-operations-map.md": ["npm run check:install-guide"],
    "docs/release.md": [
      "npm run check:install-guide",
      "installation guide contract",
    ],
    "docs/release-readiness.md": [
      "npm run check:install-guide",
      "Installation And Onboarding",
    ],
    "docs/roadmap.md": [
      "installation guide contract",
      "conservative dogfood",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkInstallGuideContract,
  targetDocs,
};
