#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { safeErrorLine } = require("../src/diagnostics.cjs");

const REQUIRED_PATHS = [
  "/api/public/usage/summary",
  "/api/admin/usage/summary",
  "/api/admin/usage/events/recent",
  "/api/admin/budget/policies",
  "/api/admin/jobs/recent",
  "/api/admin/run-claims/recent",
  "/api/admin/status",
];

function main() {
  const file = process.argv[2] || "docs/usage-api.openapi.json";
  const result = validateUsageApiOpenApi(file);
  console.log(`${file}: ok`);
  console.log(`  paths: ${result.pathCount}`);
  console.log(`  schemas: ${result.schemaCount}`);
}

function validateUsageApiOpenApi(file) {
  const absolutePath = path.resolve(process.cwd(), file);
  const document = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (!String(document.openapi || "").startsWith("3.")) {
    throw new Error("OpenAPI document must declare a 3.x openapi version.");
  }
  if (!document.info?.title || !document.info?.version) {
    throw new Error("OpenAPI document must include info.title and info.version.");
  }
  for (const requiredPath of REQUIRED_PATHS) {
    const item = document.paths?.[requiredPath];
    if (!item?.get) {
      throw new Error(`OpenAPI document is missing GET ${requiredPath}.`);
    }
    if (!item.get.responses?.["200"]) {
      throw new Error(`OpenAPI document is missing 200 response for GET ${requiredPath}.`);
    }
  }
  const adminPaths = REQUIRED_PATHS.filter((item) => item.startsWith("/api/admin/"));
  for (const adminPath of adminPaths) {
    const security = document.paths[adminPath].get.security || [];
    if (!security.some((entry) => Object.prototype.hasOwnProperty.call(entry, "adminHmac"))) {
      throw new Error(`OpenAPI document is missing adminHmac security for GET ${adminPath}.`);
    }
  }
  if (!document.components?.securitySchemes?.adminHmac) {
    throw new Error("OpenAPI document is missing components.securitySchemes.adminHmac.");
  }
  return {
    pathCount: Object.keys(document.paths || {}).length,
    schemaCount: Object.keys(document.components?.schemas || {}).length,
  };
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
  REQUIRED_PATHS,
  validateUsageApiOpenApi,
};
