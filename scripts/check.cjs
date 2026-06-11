#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = listFiles(root).filter((file) => file.endsWith(".cjs"));

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

for (const file of listFiles(root).filter((item) => /\.(md|yml|yaml|json|cjs)$/.test(item))) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.endsWith("\n")) {
    throw new Error(`${path.relative(root, file)} must end with a newline.`);
  }
}

console.log(`checked ${files.length} CommonJS files`);

function listFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "coverage", "dist", "tmp"].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}
