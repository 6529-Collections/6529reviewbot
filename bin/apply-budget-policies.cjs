#!/usr/bin/env node

"use strict";

const {
  applyBudgetPolicies,
  loadBudgetPolicyFile,
  renderBudgetPolicySql,
} = require("../src/budget-policies.cjs");
const { usageLedgerSettingsFromEnv } = require("../src/usage-ledger.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const document = loadBudgetPolicyFile(args.file);
  const schema = args.schema || process.env.REVIEW_USAGE_DB_SCHEMA || "reviewbot";
  if (!args.apply) {
    if (args.quiet) {
      return { applied: false, count: document.policies.length };
    }
    const sql = renderBudgetPolicySql(schema, document);
    process.stdout.write(`${sql || "-- no budget policy rows"}\n`);
    return { applied: false, count: document.policies.length };
  }
  const settings = { ...usageLedgerSettingsFromEnv(), schema };
  const results = applyBudgetPolicies(settings, document);
  if (!args.quiet) {
    process.stdout.write(
      `${JSON.stringify({ applied: true, statements: results.length }, null, 2)}\n`
    );
  }
  return { applied: true, count: results.length };
}

function parseArgs(argv) {
  const result = {
    apply: false,
    file: "config/budget-policies.example.json",
    quiet: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      result.apply = true;
      continue;
    }
    if (arg === "--quiet") {
      result.quiet = true;
      continue;
    }
    if (arg === "--file" || arg === "--schema") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      result[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }
  return result;
}

function helpText() {
  return `Apply central budget policy rows to the reviewbot ledger.

Usage:
  npm run budget-policies -- -- --file config/budget-policies.example.json
  npm run budget-policies -- -- --file budget-policies.json --apply

Options:
  --file <path>    JSON budget policy file. Default: config/budget-policies.example.json
  --schema <name>  Database schema. Default: REVIEW_USAGE_DB_SCHEMA or reviewbot
  --apply          Apply through the RDS Data API. Default is dry-run SQL.
  --quiet          Validate without printing SQL or apply summaries.
`;
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
  main,
  parseArgs,
};
