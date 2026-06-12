#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  applyLedgerSchema,
  ledgerSchemaStatements,
  renderLedgerSchema,
} = require("../src/ledger-schema.cjs");
const { usageLedgerSettingsFromEnv } = require("../src/usage-ledger.cjs");

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const envSettings = usageLedgerSettingsFromEnv();
  const settings = {
    ...envSettings,
    schema: options.schema || envSettings.schema,
  };
  if (!options.apply) {
    process.stdout.write(`${renderLedgerSchema(settings.schema)}\n`);
    process.stdout.write(
      "\nDry run only. Re-run with --apply from a configured operator environment to execute these statements.\n"
    );
    return;
  }

  const results = applyLedgerSchema(settings, {
    schema: settings.schema,
    statements: ledgerSchemaStatements(settings.schema),
  });
  for (const result of results) {
    process.stdout.write(`applied ${result.name}\n`);
  }
  process.stdout.write(`ledger schema applied to ${settings.schema}\n`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    schema: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--schema") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--schema requires a value.");
      }
      index += 1;
      options.schema = value;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node bin/apply-ledger-schema.cjs [options]

Print or apply the Aurora PostgreSQL schema used by the 6529reviewbot usage,
budget, and job ledgers.

Options:
  --schema <name>  Schema name. Defaults to REVIEW_USAGE_DB_SCHEMA or reviewbot.
  --apply          Execute the statements through the RDS Data API.
  -h, --help       Show this help.

Default behavior is a dry run that prints SQL and does not contact AWS.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorLine(error));
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
};
