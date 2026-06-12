#!/usr/bin/env node

"use strict";

const {
  applyModelPrices,
  loadModelPriceFile,
  renderModelPriceSql,
} = require("../src/model-prices.cjs");
const { usageLedgerSettingsFromEnv } = require("../src/usage-ledger.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const document = loadModelPriceFile(args.file);
  const schema = args.schema || process.env.REVIEW_USAGE_DB_SCHEMA || "reviewbot";
  if (!args.apply) {
    const sql = renderModelPriceSql(schema, document);
    process.stdout.write(`${sql || "-- no model price rows"}\n`);
    return { applied: false, count: document.prices.length };
  }
  const settings = { ...usageLedgerSettingsFromEnv(), schema };
  const results = applyModelPrices(settings, document, {
    allowZeroPrice: args.allowZeroPrice,
  });
  process.stdout.write(
    `${JSON.stringify({ applied: true, statements: results.length }, null, 2)}\n`
  );
  return { applied: true, count: results.length };
}

function parseArgs(argv) {
  const result = { allowZeroPrice: false, apply: false, file: "config/model-prices.example.json" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      result.apply = true;
      continue;
    }
    if (arg === "--allow-zero-price") {
      result.allowZeroPrice = true;
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
  return `Apply model pricing rows to the reviewbot ledger.

Usage:
  npm run model-prices -- -- --file config/model-prices.example.json
  npm run model-prices -- -- --file prices.json --apply

Options:
  --file <path>    JSON price file. Default: config/model-prices.example.json
  --schema <name>  Database schema. Default: REVIEW_USAGE_DB_SCHEMA or reviewbot
  --apply          Apply through the RDS Data API. Default is dry-run SQL.
  --allow-zero-price
                   Permit zero-rate rows when the provider documents a free price.
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
