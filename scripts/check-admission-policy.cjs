#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const admissionPolicy = require("../src/admission-policy.cjs");

const root = path.resolve(__dirname, "..");
const admissionDocs = ["docs/admission-policy.md", "docs/configuration.md"];
const repoConfigTemplates = [
  ".github/6529bot.yml",
  "templates/dogfood-command-only-config.yml",
  "templates/dogfood-repository-config.yml",
  "templates/repository-config.yml",
];
const expectedRepoModes = ["trusted", "off", "open"];
const expectedDraftPrModes = ["skip", "allow"];
const expectedTrustedPermissions = ["none", "read", "triage", "write", "maintain", "admin"];
const expectedDefaults = {
  publicRepoMode: "trusted",
  privateRepoMode: "open",
  draftPrMode: "skip",
  trustedPermission: "write",
};

function main() {
  const result = checkAdmissionPolicy();
  console.log(
    `admission policy ok (${result.repoModes} repo modes, ${result.permissionLevels} permission levels, ${result.docs} docs/configs checked)`
  );
}

function checkAdmissionPolicy(options = {}) {
  const findings = [];

  checkConstants(findings);
  checkEnvParsing(findings);
  checkAdmissionDecisions(findings);
  checkDocs(options.docTexts || {}, findings);
  checkEnvExample(options.envExampleText, findings);
  checkRepoConfigs(options.repoConfigTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`admission policy check found ${findings.length} issue(s).`);
  }

  return {
    repoModes: expectedRepoModes.length,
    permissionLevels: expectedTrustedPermissions.length,
    docs: admissionDocs.length + repoConfigTemplates.length + 1,
  };
}

function checkConstants(findings) {
  if (!arraysEqual(admissionPolicy.ADMISSION_REPO_MODES, expectedRepoModes)) {
    findings.push(
      `ADMISSION_REPO_MODES must be ${JSON.stringify(expectedRepoModes)}, got ${JSON.stringify(
        admissionPolicy.ADMISSION_REPO_MODES
      )}.`
    );
  }
  if (!arraysEqual(admissionPolicy.DRAFT_PR_MODES, expectedDraftPrModes)) {
    findings.push(
      `DRAFT_PR_MODES must be ${JSON.stringify(expectedDraftPrModes)}, got ${JSON.stringify(
        admissionPolicy.DRAFT_PR_MODES
      )}.`
    );
  }
  if (!arraysEqual(admissionPolicy.TRUSTED_PERMISSION_ORDER, expectedTrustedPermissions)) {
    findings.push(
      `TRUSTED_PERMISSION_ORDER must be ${JSON.stringify(
        expectedTrustedPermissions
      )}, got ${JSON.stringify(admissionPolicy.TRUSTED_PERMISSION_ORDER)}.`
    );
  }
  if (!objectsEqual(admissionPolicy.DEFAULT_ADMISSION_POLICY, expectedDefaults)) {
    findings.push(
      `DEFAULT_ADMISSION_POLICY must be ${JSON.stringify(
        expectedDefaults
      )}, got ${JSON.stringify(admissionPolicy.DEFAULT_ADMISSION_POLICY)}.`
    );
  }
}

function checkEnvParsing(findings) {
  const defaults = admissionPolicy.admissionPolicyFromEnv({});
  for (const [key, value] of Object.entries(expectedDefaults)) {
    if (defaults[key] !== value) {
      findings.push(`default admission ${key} must be ${value}, got ${defaults[key]}.`);
    }
  }
  if (defaults.trustedUsers.size !== 0 || defaults.trustedTeams.size !== 0 || defaults.trustedOrganizations.size !== 0) {
    findings.push("default admission trusted user/team/org sets must be empty.");
  }
  if (defaults.allowedPrAuthors.size !== 0 || defaults.denyUsers.size !== 0) {
    findings.push("default admission allowed PR author and deny user sets must be empty.");
  }

  for (const mode of expectedRepoModes) {
    const policy = admissionPolicy.admissionPolicyFromEnv({
      REVIEWBOT_PUBLIC_REPO_MODE: mode,
      REVIEWBOT_PRIVATE_REPO_MODE: mode,
    });
    if (policy.publicRepoMode !== mode || policy.privateRepoMode !== mode) {
      findings.push(`repo mode ${mode} must parse for public and private repo modes.`);
    }
  }
  expectError(
    () => admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_PUBLIC_REPO_MODE: "anyone" }),
    `REVIEWBOT_PUBLIC_REPO_MODE must be one of: ${expectedRepoModes.join(", ")}`,
    findings
  );

  for (const mode of expectedDraftPrModes) {
    const policy = admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_DRAFT_PR_MODE: mode });
    if (policy.draftPrMode !== mode) {
      findings.push(`draft PR mode ${mode} must parse.`);
    }
  }
  expectError(
    () => admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_DRAFT_PR_MODE: "review" }),
    `REVIEWBOT_DRAFT_PR_MODE must be one of: ${expectedDraftPrModes.join(", ")}`,
    findings
  );

  for (const permission of expectedTrustedPermissions) {
    const policy = admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_TRUSTED_PERMISSION: permission });
    if (policy.trustedPermission !== permission) {
      findings.push(`trusted permission ${permission} must parse.`);
    }
  }
  expectError(
    () => admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_TRUSTED_PERMISSION: "owner" }),
    `REVIEWBOT_TRUSTED_PERMISSION must be one of: ${expectedTrustedPermissions.join(", ")}`,
    findings
  );

  if (!admissionPolicy.permissionAtLeast("maintain", "write")) {
    findings.push("maintain permission must satisfy write trust.");
  }
  if (admissionPolicy.permissionAtLeast("read", "write")) {
    findings.push("read permission must not satisfy write trust.");
  }
}

function checkAdmissionDecisions(findings) {
  const defaultPolicy = admissionPolicy.admissionPolicyFromEnv({});
  const publicEvent = normalizedEvent({ privateRepo: false });
  const privateEvent = normalizedEvent({ privateRepo: true });
  const draftEvent = normalizedEvent({ privateRepo: false, draft: true });

  expectDecision(
    "default public untrusted actor",
    admissionPolicy.evaluateAdmission(publicEvent, { login: "external", permission: "read" }, defaultPolicy),
    { status: "denied", allowed: false, code: "untrusted_actor", requestor: "external", trustedActor: false },
    findings
  );
  expectDecision(
    "default public write actor",
    admissionPolicy.evaluateAdmission(publicEvent, { login: "maintainer", permission: "write" }, defaultPolicy),
    { status: "allowed", allowed: true, code: "trusted_actor", requestor: "external", trustedActor: true },
    findings
  );
  expectDecision(
    "default private untrusted actor",
    admissionPolicy.evaluateAdmission(privateEvent, { login: "external", permission: "read" }, defaultPolicy),
    { status: "allowed", allowed: true, code: "repo_mode_open", requestor: "external", trustedActor: false },
    findings
  );
  expectDecision(
    "default draft PR",
    admissionPolicy.evaluateAdmission(draftEvent, { login: "maintainer", permission: "admin" }, defaultPolicy),
    { status: "skipped", allowed: false, code: "draft_pull_request", requestor: "external" },
    findings
  );

  const trustedUserPolicy = admissionPolicy.admissionPolicyFromEnv({
    REVIEWBOT_TRUSTED_USERS: "trusted-maintainer",
  });
  expectDecision(
    "configured trusted user",
    admissionPolicy.evaluateAdmission(publicEvent, { login: "trusted-maintainer", permission: "read" }, trustedUserPolicy),
    { status: "allowed", allowed: true, code: "trusted_actor", trustedActor: true },
    findings
  );

  const allowedPrAuthorPolicy = admissionPolicy.admissionPolicyFromEnv({
    REVIEWBOT_ALLOWED_PR_AUTHORS: "alice,bob",
    REVIEWBOT_TRUSTED_USERS: "alice,bob",
  });
  expectDecision(
    "configured allowed PR author",
    admissionPolicy.evaluateAdmission(
      { ...publicEvent, actor: "alice", prAuthor: "alice" },
      { login: "alice", permission: "read" },
      allowedPrAuthorPolicy
    ),
    { status: "allowed", allowed: true, code: "trusted_actor", requestor: "alice", trustedActor: true },
    findings
  );
  expectDecision(
    "configured blocked PR author",
    admissionPolicy.evaluateAdmission(
      { ...publicEvent, prAuthor: "mallory" },
      { login: "mallory", permission: "admin", isOrgMember: true },
      allowedPrAuthorPolicy
    ),
    { status: "denied", allowed: false, code: "blocked_pr_author", requestor: "external" },
    findings
  );
  expectDecision(
    "configured missing PR author",
    admissionPolicy.evaluateAdmission(
      { ...publicEvent, prAuthor: "" },
      { login: "admin", permission: "admin" },
      allowedPrAuthorPolicy
    ),
    { status: "denied", allowed: false, code: "missing_pr_author", requestor: "external" },
    findings
  );

  const denyPolicy = admissionPolicy.admissionPolicyFromEnv({
    REVIEWBOT_DENY_USERS: "maintainer",
  });
  expectDecision(
    "deny user wins over write permission",
    admissionPolicy.evaluateAdmission(publicEvent, { login: "maintainer", permission: "admin" }, denyPolicy),
    { status: "denied", allowed: false, code: "blocked_actor" },
    findings
  );
}

function checkDocs(docTexts, findings) {
  const requiredLines = [
    "REVIEWBOT_PUBLIC_REPO_MODE=trusted",
    "REVIEWBOT_PRIVATE_REPO_MODE=open",
    "REVIEWBOT_DRAFT_PR_MODE=skip",
    "REVIEWBOT_ALLOWED_PR_AUTHORS=",
    "REVIEWBOT_TRUSTED_PERMISSION=write",
  ];
  for (const docPath of admissionDocs) {
    const text = docTexts[docPath] || readText(docPath);
    for (const line of requiredLines) {
      if (!text.includes(line)) {
        findings.push(`${docPath} must include ${line}.`);
      }
    }
    for (const mode of expectedRepoModes) {
      if (!text.includes(mode)) {
        findings.push(`${docPath} must document repo mode '${mode}'.`);
      }
    }
    if (!normalizeWhitespace(text).includes("public repositories require trusted actors by default")) {
      findings.push(`${docPath} must state that public repositories require trusted actors by default.`);
    }
  }

  const admissionDoc = docTexts["docs/admission-policy.md"] || readText("docs/admission-policy.md");
  const normalizedAdmissionDoc = normalizeWhitespace(admissionDoc);
  for (const permission of ["write", "maintain", "admin"]) {
    if (!admissionDoc.includes(`\`${permission}\``)) {
      findings.push(`docs/admission-policy.md must document trusted permission '${permission}'.`);
    }
  }
  if (!normalizedAdmissionDoc.includes("fails closed for public repositories")) {
    findings.push("docs/admission-policy.md must describe public-repo fail-closed behavior.");
  }
  if (!normalizedAdmissionDoc.includes("prevent arbitrary pr authors or commenters from burning model budget")) {
    findings.push("docs/admission-policy.md must document the public-repo budget-abuse reason.");
  }
}

function checkEnvExample(text, findings) {
  const envText = text || readText(".env.example");
  const expectedLines = [
    "REVIEWBOT_PUBLIC_REPO_MODE=trusted",
    "REVIEWBOT_PRIVATE_REPO_MODE=open",
    "REVIEWBOT_DRAFT_PR_MODE=skip",
    "REVIEWBOT_ALLOWED_PR_AUTHORS=",
    "REVIEWBOT_TRUSTED_PERMISSION=write",
  ];
  for (const line of expectedLines) {
    if (!envText.includes(line)) {
      findings.push(`.env.example must include ${line}.`);
    }
  }
}

function checkRepoConfigs(repoConfigTexts, findings) {
  for (const configPath of repoConfigTemplates) {
    const text = repoConfigTexts[configPath] || readText(configPath);
    const config = YAML.parse(text);
    const admission = config?.admission || {};
    for (const [key, expected] of Object.entries(expectedDefaults)) {
      if (admission[key] !== expected) {
        findings.push(`${configPath} admission.${key} must be ${expected}, got ${admission[key]}.`);
      }
    }
    for (const key of ["trustedUsers", "trustedTeams", "trustedOrganizations", "denyUsers"]) {
      if (!Array.isArray(admission[key]) || admission[key].length !== 0) {
        findings.push(`${configPath} admission.${key} must be an empty array in public examples.`);
      }
    }
  }
}

function normalizedEvent(options = {}) {
  return {
    kind: "pull_request",
    trigger: "pull_request",
    actor: "external",
    prAuthor: "external",
    draft: Boolean(options.draft),
    reviewKinds: ["general"],
    repository: { private: Boolean(options.privateRepo) },
  };
}

function expectDecision(context, decision, expected, findings) {
  for (const [key, value] of Object.entries(expected)) {
    if (decision[key] !== value) {
      findings.push(`${context} decision ${key} must be ${JSON.stringify(value)}, got ${JSON.stringify(decision[key])}.`);
    }
  }
}

function expectError(fn, expectedMessage, findings) {
  try {
    fn();
    findings.push(`expected error '${expectedMessage}'.`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      findings.push(`expected error '${expectedMessage}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  checkAdmissionPolicy,
  expectedDefaults,
  expectedRepoModes,
  expectedTrustedPermissions,
};
