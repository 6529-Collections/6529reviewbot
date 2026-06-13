#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function main() {
  const markdownFiles = repositoryFiles().filter((file) => file.endsWith(".md"));
  const findings = [];
  for (const file of markdownFiles) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    findings.push(...checkMarkdownLinks(file, content));
  }
  if (findings.length) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}: ${finding.message}`);
    }
    throw new Error(`documentation link check found ${findings.length} broken local link(s).`);
  }
  console.log(`documentation links ok (${markdownFiles.length} files checked)`);
}

function checkMarkdownLinks(file, content) {
  const findings = [];
  const directory = path.dirname(file);
  let inFence = false;
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    for (const target of markdownLinkTargets(line)) {
      const normalized = normalizeLocalLinkTarget(target);
      if (!normalized) {
        continue;
      }
      const absoluteTarget = path.resolve(root, directory, normalized);
      if (!isInsideRoot(absoluteTarget) || !fs.existsSync(absoluteTarget)) {
        findings.push({
          file,
          line: index + 1,
          message: `broken local link '${target}'`,
        });
      }
    }
  }
  return findings;
}

function markdownLinkTargets(line) {
  const targets = [];
  const pattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  for (const match of line.matchAll(pattern)) {
    const target = match[1].trim();
    if (target) {
      targets.push(target);
    }
  }
  return targets;
}

function normalizeLocalLinkTarget(target) {
  const withoutTitle = stripOptionalTitle(target.trim());
  const withoutAngleBrackets =
    withoutTitle.startsWith("<") && withoutTitle.endsWith(">")
      ? withoutTitle.slice(1, -1).trim()
      : withoutTitle;
  if (
    !withoutAngleBrackets ||
    withoutAngleBrackets.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(withoutAngleBrackets)
  ) {
    return "";
  }
  return decodeURIComponent(withoutAngleBrackets.split("#")[0]);
}

function stripOptionalTitle(target) {
  const match = target.match(/^([^"' \t]+)(?:\s+["'][^"']*["'])?$/);
  return match ? match[1] : target;
}

function isInsideRoot(absolutePath) {
  const relative = path.relative(root, absolutePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function repositoryFiles() {
  return [...new Set([...gitFiles(["ls-files", "-z"]), ...gitFiles(["ls-files", "-z", "--others", "--exclude-standard"])])]
    .sort();
}

function gitFiles(args) {
  const output = execFileSync(gitBin(), args, {
    cwd: root,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter(Boolean)
    .map((file) => file.split(path.sep).join("/"));
}

function gitBin() {
  if (process.env.GIT_BIN) {
    return process.env.GIT_BIN;
  }
  const windowsGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  if (process.platform === "win32" && fs.existsSync(windowsGit)) {
    return windowsGit;
  }
  return "git";
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
  checkMarkdownLinks,
  markdownLinkTargets,
  normalizeLocalLinkTarget,
  repositoryFiles,
};
