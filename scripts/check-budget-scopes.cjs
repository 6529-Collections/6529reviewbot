#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { BUDGET_SCOPES } = require("../src/budget-admission.cjs");
const { validateBudgetPolicyFile } = require("../src/budget-policies.cjs");
const { renderLedgerSchema } = require("../src/ledger-schema.cjs");

const root = path.resolve(__dirname, "..");
const expectedBudgetScopes = [
  "global",
  "org",
  "repo",
  "requestor",
  "pr",
  "provider",
  "model",
  "review_kind",
];
const dogfoodExamplePath = "config/budget-policies.dogfood.example.json";
const dogfoodExampleScopes = expectedBudgetScopes.filter((scope) => scope !== "pr");
const budgetScopeDocs = [
  "docs/budget-policies.md",
  "docs/budget-admission.md",
];

function main() {
  const result = checkBudgetScopes();
  console.log(
    `budget scopes ok (${result.scopes} scopes, ${result.dogfoodScopes} dogfood example scopes checked)`
  );
}

function checkBudgetScopes(options = {}) {
  const findings = [];
  const scopes = options.scopes || BUDGET_SCOPES;

  checkCanonicalScopes(scopes, findings);
  checkBudgetPolicyValidator(scopes, findings);
  checkLedgerSchema(scopes, options.ledgerSchemaText, findings);
  checkBudgetDocs(scopes, options.docTexts || {}, findings);
  checkDogfoodExample(options.dogfoodExample, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`budget scope check found ${findings.length} issue(s).`);
  }

  return {
    scopes: scopes.length,
    dogfoodScopes: dogfoodExampleScopes.length,
  };
}

function checkCanonicalScopes(scopes, findings) {
  if (!arraysEqual(scopes, expectedBudgetScopes)) {
    findings.push(
      `src/budget-admission.cjs BUDGET_SCOPES must be ${JSON.stringify(
        expectedBudgetScopes
      )}, got ${JSON.stringify(scopes)}.`
    );
  }
}

function checkBudgetPolicyValidator(scopes, findings) {
  try {
    const validated = validateBudgetPolicyFile({
      version: 1,
      currency: "USD",
      policies: scopes.map((scope) => ({
        scopeType: scope,
        scopeValue: sampleScopeValue(scope),
        dailyUsd: 1,
      })),
    }, "synthetic budget scope contract");
    const validatedScopes = validated.policies.map((policy) => policy.scopeType);
    if (!arraysEqual(validatedScopes, scopes)) {
      findings.push(
        `budget policy validator normalized scopes to ${JSON.stringify(
          validatedScopes
        )}, expected ${JSON.stringify(scopes)}.`
      );
    }
  } catch (error) {
    findings.push(`budget policy validator must accept every canonical scope: ${error.message}`);
  }
}

function checkLedgerSchema(scopes, text, findings) {
  const rendered = text || renderLedgerSchema("reviewbot");
  const expectedConstraint = `scope_type in (${scopes.map(sqlString).join(", ")})`;
  const constraintCount = countOccurrences(rendered, expectedConstraint);
  if (constraintCount < 2) {
    findings.push(
      `ledger schema must render the canonical budget scope constraint twice; found ${constraintCount}.`
    );
  }
  if (!/set scope_type = 'requestor'\s+where scope_type = 'requester'/.test(rendered)) {
    findings.push("ledger schema must normalize legacy requester scope rows to requestor.");
  }
}

function checkBudgetDocs(scopes, docTexts, findings) {
  for (const docPath of budgetScopeDocs) {
    const text = docTexts[docPath] || readText(docPath);
    for (const scope of scopes) {
      const pattern = new RegExp(`^- \`${escapeRegExp(scope)}\`(?:,|$)`, "m");
      if (!pattern.test(text)) {
        findings.push(`${docPath} must list the '${scope}' budget scope.`);
      }
    }
  }

  const ledgerDocPath = "docs/aws-usage-ledger.md";
  const ledgerDoc = normalizeWhitespace(docTexts[ledgerDocPath] || readText(ledgerDocPath));
  const canonicalSentence =
    `The budget policy table uses the app's canonical budget scope vocabulary: ${scopePhrase(
      scopes
    )}.`;
  if (!ledgerDoc.includes(canonicalSentence)) {
    findings.push(`${ledgerDocPath} must describe the canonical budget scope vocabulary.`);
  }
  if (!ledgerDoc.includes("normalizes the older `requester` spelling to `requestor`")) {
    findings.push(`${ledgerDocPath} must document requester to requestor normalization.`);
  }

  const policiesDocPath = "docs/budget-policies.md";
  const policiesDoc = normalizeWhitespace(docTexts[policiesDocPath] || readText(policiesDocPath));
  if (!policiesDoc.includes("Dogfood examples intentionally omit `pr` rows")) {
    findings.push(`${policiesDocPath} must document why the public dogfood example omits pr rows.`);
  }
}

function checkDogfoodExample(document, findings) {
  const dogfood =
    document ||
    JSON.parse(fs.readFileSync(path.join(root, dogfoodExamplePath), "utf8"));
  try {
    validateBudgetPolicyFile(dogfood, dogfoodExamplePath);
  } catch (error) {
    findings.push(`${dogfoodExamplePath} must be a valid budget policy file: ${error.message}`);
    return;
  }
  const scopes = dogfood.policies.map((policy) => policy.scopeType);
  if (!arraysEqual(scopes, dogfoodExampleScopes)) {
    findings.push(
      `${dogfoodExamplePath} scopes must be ${JSON.stringify(
        dogfoodExampleScopes
      )}, got ${JSON.stringify(scopes)}.`
    );
  }
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
  throw new Error(`No sample value configured for budget scope '${scope}'.`);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function scopePhrase(scopes) {
  const quoted = scopes.map((scope) => `\`${scope}\``);
  return `${quoted.slice(0, -1).join(", ")}, and ${quoted.at(-1)}`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function countOccurrences(text, needle) {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  checkBudgetScopes,
  dogfoodExampleScopes,
  expectedBudgetScopes,
  sampleScopeValue,
  scopePhrase,
};
