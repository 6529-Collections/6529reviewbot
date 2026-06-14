#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const rootFiles = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  ".dockerignore",
  ".env.example",
  "Dockerfile",
  "GOVERNANCE.md",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
]);
const publicDirectories = [
  ".github/",
  "_manager/",
  "config/",
  "docs/",
  "infra/",
  "templates/",
];
const textExtensions = new Set([
  ".example",
  ".json",
  ".md",
  ".txt",
  ".yaml",
  ".yml",
]);
const allowedAwsAccountIds = new Set(["123456789012"]);
const reservedBotExampleHost = "reviewbot.example.com";
const shellFenceLanguages = new Set(["bash", "sh", "shell", "zsh", "powershell", "ps1"]);
const localPathStopChars = '\\s"\'<>`';
const windowsPathSeparator = String.raw`(?:\\+|/)`;
const localPrivateWindowsRoots = [
  `Users${windowsPathSeparator}[^\\\\/${localPathStopChars}]+`,
  `Documents and Settings${windowsPathSeparator}[^\\\\/${localPathStopChars}]+`,
  "private",
  "secrets?",
  "temp",
  "tmp",
].join("|");
const localPrivatePathPattern = new RegExp(
  [
    `\\b[A-Za-z]:${windowsPathSeparator}(?:${localPrivateWindowsRoots})(?:${windowsPathSeparator}[^${localPathStopChars}]*)?`,
    `\\B/(?:home|Users)/[A-Za-z0-9._-]+(?:/[^${localPathStopChars}]*)?`,
    `~/[^${localPathStopChars}]+`,
  ].join("|"),
  "g"
);

const staticRules = [
  {
    name: "aws_access_key_id",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: "github_token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    name: "github_fine_grained_token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    name: "provider_api_key",
    pattern: /\b(?:sk-ant-api03-|sk-or-v1-|sk-proj-|sk-)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "private_key_block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: "alert_webhook_url",
    pattern:
      /\bhttps:\/\/(?:hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}|(?:discord(?:app)?\.com)\/api\/webhooks\/[0-9]{10,}\/[A-Za-z0-9._-]{20,})\b/g,
  },
  {
    name: "local_private_path",
    pattern: localPrivatePathPattern,
  },
];

function main() {
  const files = repositoryFiles().filter(isPublicTextArtifact);
  const findings = [];
  for (const file of files) {
    const absolutePath = path.join(root, file);
    const content = fs.readFileSync(absolutePath, "utf8");
    findings.push(...scanFile(file, content));
  }
  if (findings.length) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}: ${finding.rule} (${finding.detail})`);
    }
    throw new Error(`public artifact scan found ${findings.length} possible secret or live identifier leak(s).`);
  }
  console.log(`public artifact scan ok (${files.length} files checked)`);
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
    .map((file) => slash(file));
}

function isPublicTextArtifact(file) {
  if (rootFiles.has(file)) {
    return true;
  }
  if (!publicDirectories.some((directory) => file.startsWith(directory))) {
    return false;
  }
  return textExtensions.has(path.extname(file).toLowerCase());
}

function scanFile(file, content) {
  const findings = [];
  for (const rule of staticRules) {
    findings.push(...findMatches(file, content, rule.name, rule.pattern));
  }
  const awsArnMatches = findAwsArns(content);
  findings.push(...findLiveAwsArns(file, content, awsArnMatches));
  findings.push(...findLiveAwsAccountIds(file, content, awsArnMatches));
  findings.push(...findReservedBotHostInShellBlocks(file, content));
  return findings;
}

function findMatches(file, content, rule, pattern) {
  const findings = [];
  for (const match of content.matchAll(pattern)) {
    findings.push({
      file,
      line: lineForIndex(content, match.index || 0),
      rule,
      detail: "value redacted",
    });
  }
  return findings;
}

function findLiveAwsAccountIds(file, content, awsArnMatches = findAwsArns(content)) {
  const findings = [];
  for (const match of content.matchAll(/\b\d{12}\b/g)) {
    if (allowedAwsAccountIds.has(match[0])) {
      continue;
    }
    const index = match.index || 0;
    if (awsArnMatches.some((arn) => index >= arn.index && index < arn.endIndex)) {
      continue;
    }
    findings.push({
      file,
      line: lineForIndex(content, index),
      rule: "aws_account_id",
      detail: "12 digit account id redacted",
    });
  }
  return findings;
}

function findAwsArns(content) {
  const arnPattern = /\barn:aws[a-z-]*:[^\s"'<>:]+:[^\s"'<>:]*:(\d{12}):[^\s"'<>]+/g;
  return [...content.matchAll(arnPattern)].map((match) => ({
    accountId: match[1],
    index: match.index || 0,
    endIndex: (match.index || 0) + match[0].length,
  }));
}

function findLiveAwsArns(file, content, awsArnMatches = findAwsArns(content)) {
  const findings = [];
  for (const match of awsArnMatches) {
    if (allowedAwsAccountIds.has(match.accountId)) {
      continue;
    }
    findings.push({
      file,
      line: lineForIndex(content, match.index),
      rule: "aws_arn",
      detail: "live-looking ARN redacted",
    });
  }
  return findings;
}

function findReservedBotHostInShellBlocks(file, content) {
  const findings = [];
  const fencePattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  for (const match of content.matchAll(fencePattern)) {
    const language = String(match[1] || "").trim().toLowerCase().split(/\s+/, 1)[0];
    if (!shellFenceLanguages.has(language)) {
      continue;
    }
    const block = match[2] || "";
    const blockOffset = (match.index || 0) + match[0].indexOf(block);
    let searchFrom = 0;
    while (searchFrom < block.length) {
      const index = block.indexOf(reservedBotExampleHost, searchFrom);
      if (index === -1) {
        break;
      }
      findings.push({
        file,
        line: lineForIndex(content, blockOffset + index),
        rule: "reserved_bot_host_shell_command",
        detail: "use <production-bot-origin> in shell command examples",
      });
      searchFrom = index + reservedBotExampleHost.length;
    }
  }
  return findings;
}

function lineForIndex(content, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

function slash(file) {
  return file.split(path.sep).join("/");
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
  findReservedBotHostInShellBlocks,
  findLiveAwsAccountIds,
  findLiveAwsArns,
  isPublicTextArtifact,
  repositoryFiles,
  scanFile,
};
