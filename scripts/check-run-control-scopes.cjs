#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { BUDGET_SCOPES } = require("../src/budget-admission.cjs");
const {
  RUN_CONTROL_SCOPES,
  runControlPolicyFromEnv,
  runControlScopeValue,
} = require("../src/run-control.cjs");
const { buildRunClaimQuery } = require("../src/run-control-ledger.cjs");

const root = path.resolve(__dirname, "..");
const runControlScopeDocs = [
  "README.md",
  ".env.example",
  "docs/run-control.md",
  "docs/configuration.md",
];

function main() {
  const result = checkRunControlScopes();
  console.log(
    `run-control scopes ok (${result.scopes} scopes, ${result.docs} docs/env files checked)`
  );
}

function checkRunControlScopes(options = {}) {
  const findings = [];
  const scopes = options.scopes || RUN_CONTROL_SCOPES;
  const budgetScopes = options.budgetScopes || BUDGET_SCOPES;

  checkScopeConstants(scopes, budgetScopes, findings);
  checkEnvPolicyParsing(scopes, findings);
  checkScopeValueMapping(scopes, findings);
  checkLedgerClaimQuery(scopes, findings);
  checkDocs(scopes, options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`run-control scope check found ${findings.length} issue(s).`);
  }

  return {
    scopes: scopes.length,
    docs: runControlScopeDocs.length,
  };
}

function checkScopeConstants(scopes, budgetScopes, findings) {
  if (!arraysEqual(scopes, budgetScopes)) {
    findings.push(
      `src/run-control.cjs RUN_CONTROL_SCOPES must match BUDGET_SCOPES: expected ${JSON.stringify(
        budgetScopes
      )}, got ${JSON.stringify(scopes)}.`
    );
  }
}

function checkEnvPolicyParsing(scopes, findings) {
  const env = {
    REVIEWBOT_RUN_CONTROL_MODE: "enforce",
    REVIEWBOT_RUN_CONTROL_DEDUPE_ENABLED: "true",
  };
  scopes.forEach((scope, index) => {
    env[runControlEnvName(scope)] = String(index + 1);
  });
  const policy = runControlPolicyFromEnv(env);
  const policyScopes = Object.keys(policy.maxConcurrent || {});
  if (!arraysEqual(policyScopes, scopes)) {
    findings.push(
      `runControlPolicyFromEnv maxConcurrent keys must be ${JSON.stringify(
        scopes
      )}, got ${JSON.stringify(policyScopes)}.`
    );
  }
  for (const [index, scope] of scopes.entries()) {
    const expected = index + 1;
    if (policy.maxConcurrent[scope] !== expected) {
      findings.push(`${runControlEnvName(scope)} must populate maxConcurrent.${scope}.`);
    }
  }
}

function checkScopeValueMapping(scopes, findings) {
  const subject = sampleSubject();
  for (const scope of scopes) {
    const actual = runControlScopeValue(subject, scope);
    const expected = sampleScopeValue(scope);
    if (actual !== expected) {
      findings.push(
        `runControlScopeValue must map '${scope}' to '${expected}', got '${actual}'.`
      );
    }
  }
}

function checkLedgerClaimQuery(scopes, findings) {
  const policy = runControlPolicyFromEnv(runControlEnv(scopes));
  const query = buildRunClaimQuery("reviewbot", sampleJob(), policy);
  const scopeTypeParams = query.parameters
    .filter((param) => /^scope_type_[0-9]+$/.test(param.name))
    .sort((left, right) => Number(left.name.split("_").at(-1)) - Number(right.name.split("_").at(-1)))
    .map((param) => param.value.stringValue);
  if (!arraysEqual(scopeTypeParams, scopes)) {
    findings.push(
      `run-control ledger cap parameters must be ${JSON.stringify(
        scopes
      )}, got ${JSON.stringify(scopeTypeParams)}.`
    );
  }
  for (const scope of scopes) {
    if (!query.sql.includes(`caps.scope_type = '${scope}'`)) {
      findings.push(`run-control ledger active-count SQL must handle '${scope}'.`);
    }
  }
}

function checkDocs(scopes, docTexts, findings) {
  for (const docPath of runControlScopeDocs) {
    const text = docTexts[docPath] || readText(docPath);
    for (const scope of scopes) {
      const envName = runControlEnvName(scope);
      if (!text.includes(envName)) {
        findings.push(`${docPath} must include ${envName}.`);
      }
    }
  }

  const runControlDoc = normalizeWhitespace(docTexts["docs/run-control.md"] || readText("docs/run-control.md"));
  const expectedSentence = `Supported run-control scopes are ${scopePhrase(scopes)}.`;
  if (!runControlDoc.includes(expectedSentence)) {
    findings.push("docs/run-control.md must list the supported run-control scopes.");
  }
}

function runControlEnv(scopes) {
  const env = {
    REVIEWBOT_RUN_CONTROL_MODE: "enforce",
    REVIEWBOT_RUN_CONTROL_DEDUPE_ENABLED: "true",
  };
  scopes.forEach((scope) => {
    env[runControlEnvName(scope)] = "1";
  });
  return env;
}

function runControlEnvName(scope) {
  return `REVIEWBOT_RUN_CONTROL_${String(scope).toUpperCase()}_MAX_CONCURRENT`;
}

function sampleJob() {
  return {
    id: "rj_scope_contract",
    runKey: "rk_scope_contract",
    repository: { fullName: "6529-Collections/6529reviewbot" },
    prNumber: 123,
    requestor: "maintainer",
    headSha: "abc123",
    reviewKind: "security",
    provider: "anthropic",
    model: "claude-opus-4-8",
    lane: "anthropic:claude-opus-4-8",
    deliveryId: "delivery-1",
  };
}

function sampleSubject() {
  return {
    org: "6529-Collections",
    repo: "6529-Collections/6529reviewbot",
    pr: "6529-Collections/6529reviewbot#123",
    requestor: "maintainer",
    provider: "anthropic",
    model: "claude-opus-4-8",
    reviewKind: "security",
  };
}

function sampleScopeValue(scope) {
  if (scope === "global") {
    return "*";
  }
  if (scope === "org") {
    return "6529-Collections";
  }
  if (scope === "repo") {
    return "6529-Collections/6529reviewbot";
  }
  if (scope === "requestor") {
    return "maintainer";
  }
  if (scope === "pr") {
    return "6529-Collections/6529reviewbot#123";
  }
  if (scope === "provider") {
    return "anthropic";
  }
  if (scope === "model") {
    return "claude-opus-4-8";
  }
  if (scope === "review_kind") {
    return "security";
  }
  throw new Error(`No sample value configured for run-control scope '${scope}'.`);
}

function scopePhrase(scopes) {
  const quoted = scopes.map((scope) => `\`${scope}\``);
  return `${quoted.slice(0, -1).join(", ")}, and ${quoted.at(-1)}`;
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
  checkRunControlScopes,
  runControlEnvName,
  sampleScopeValue,
  scopePhrase,
};
