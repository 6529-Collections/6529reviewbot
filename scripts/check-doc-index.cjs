#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  markdownLinkTargets,
  normalizeLocalLinkTarget,
} = require("./check-doc-links.cjs");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const indexFile = path.join(docsDir, "README.md");

function main() {
  if (!fs.existsSync(indexFile)) {
    throw new Error("docs/README.md is required as the canonical docs index.");
  }

  const indexedDocs = docsIndexLinks(fs.readFileSync(indexFile, "utf8"));
  const docs = fs
    .readdirSync(docsDir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => `docs/${file}`)
    .sort();

  const missing = docs.filter((file) => !indexedDocs.has(file));
  if (missing.length) {
    throw new Error(`docs index is missing: ${missing.join(", ")}`);
  }

  const rootReadme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  if (!rootReadme.includes("(docs/README.md)")) {
    throw new Error("README.md must link to docs/README.md.");
  }

  console.log(`docs index ok (${docs.length} docs indexed)`);
}

function docsIndexLinks(content) {
  const links = new Set();
  for (const line of content.split(/\r?\n/)) {
    for (const target of markdownLinkTargets(line)) {
      const normalized = normalizeLocalLinkTarget(target);
      if (!normalized || !normalized.endsWith(".md")) {
        continue;
      }
      const resolved = path.resolve(docsDir, normalized);
      if (!isInside(resolved, docsDir)) {
        continue;
      }
      links.add(path.relative(root, resolved).split(path.sep).join("/"));
    }
  }
  return links;
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
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
  docsIndexLinks,
};
