#!/usr/bin/env node

"use strict";

const path = require("path");
const {
  DEFAULT_MODEL_CATALOG_PATH,
  loadModelCatalog,
} = require("../src/model-catalog.cjs");

const args = process.argv.slice(2).filter((item) => item !== "--");

if (args.includes("-h") || args.includes("--help")) {
  printUsage();
  process.exit(0);
}

const catalogPaths = args.length ? args : [DEFAULT_MODEL_CATALOG_PATH];
let failed = false;

for (const catalogPath of catalogPaths) {
  try {
    validateFile(catalogPath);
  } catch (error) {
    failed = true;
    console.error(`${catalogPath}: invalid: ${error.message}`);
  }
}

if (failed) {
  process.exitCode = 1;
}

function validateFile(catalogPath) {
  const absolutePath = path.resolve(process.cwd(), catalogPath);
  const catalog = loadModelCatalog({ path: absolutePath });
  console.log(`${catalogPath}: ok`);
  console.log(`  defaultProvider: ${catalog.defaultProvider}`);
  for (const [provider, config] of Object.entries(catalog.providers)) {
    console.log(
      `  ${provider}: ${config.defaultModel || "explicit required"}`
    );
  }
}

function printUsage() {
  console.log("Usage: node bin/validate-model-catalog.cjs [config/model-catalog.json]");
}
