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
    allowStaleSource: args.allowStaleSource,
    maxSourceAgeDays: args.maxSourceAgeDays,
  });
  process.stdout.write(
    `${JSON.stringify({ applied: true, statements: results.length }, null, 2)}\n`
  );
  return { applied: true, count: results.length };
}

function parseArgs(argv) {
  const result = {
    allowStaleSource: false,
    allowZeroPrice: false,
    apply: false,
    file: "config/model-prices.example.json",
  };
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
    if (arg === "--allow-stale-source") {
      result.allowStaleSource = true;
      continue;
    }
    if (arg === "--file" || arg === "--schema" || arg === "--max-source-age-days") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      if (arg === "--max-source-age-days") {
        result.maxSourceAgeDays = parseNonNegativeNumber(value, arg);
      } else {
        result[arg.slice(2)] = value;
      }
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

function parseNonNegativeNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
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
  --max-source-age-days <days>
                   Maximum age for sourceCheckedAt during apply. Default: 30.
  --allow-stale-source
                   Apply rows with stale or future-dated sourceCheckedAt evidence
                   after recording an explicit operator acceptance in release notes.
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
