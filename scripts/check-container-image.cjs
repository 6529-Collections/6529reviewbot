#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dockerfilePath = path.join(root, "Dockerfile");
const dockerignorePath = path.join(root, ".dockerignore");

const requiredDockerignoreEntries = [
  ".git",
  ".github",
  "_manager",
  "coverage",
  "dist",
  "docs",
  "infra",
  "node_modules",
  "tmp",
  ".env",
  ".env.*",
  "*.log",
  "Dockerfile*",
  "README.md",
  "CHANGELOG.md",
];

const requiredRuntimeCopies = [
  "COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules",
  "COPY --chown=node:node package.json package-lock.json ./",
  "COPY --chown=node:node bin ./bin",
  "COPY --chown=node:node config ./config",
  "COPY --chown=node:node src ./src",
  "COPY --chown=node:node templates ./templates",
];

function main() {
  const result = checkContainerImage();
  console.log(
    `container image contract ok (${result.runtimeCopies} runtime copy rules, ${result.dockerignoreEntries} ignore entries checked)`
  );
}

function checkContainerImage(options = {}) {
  const dockerfile = options.dockerfile || fs.readFileSync(dockerfilePath, "utf8");
  const dockerignore = options.dockerignore || fs.readFileSync(dockerignorePath, "utf8");
  const findings = [
    ...checkDockerfile(dockerfile),
    ...checkDockerignore(dockerignore),
  ];
  if (findings.length) {
    for (const finding of findings) {
      console.error(finding);
    }
    throw new Error(`container image contract check found ${findings.length} issue(s).`);
  }
  return {
    runtimeCopies: requiredRuntimeCopies.length,
    dockerignoreEntries: requiredDockerignoreEntries.length,
  };
}

function checkDockerfile(content) {
  const findings = [];
  const lines = normalizedLines(content);
  const runtimeStart = findLineIndex(lines, /^FROM\s+\$\{NODE_IMAGE\}\s+AS\s+runtime$/);
  const userNode = findLineIndex(lines, /^USER\s+node$/);
  const cmd = findLineIndex(lines, /^CMD\s+\["node",\s*"bin\/server\.cjs"\]$/);
  if (!lines.includes("# syntax=docker/dockerfile:1")) {
    findings.push("Dockerfile must declare the Dockerfile v1 syntax.");
  }
  if (!lines.includes("ARG NODE_IMAGE=node:22-bookworm-slim")) {
    findings.push("Dockerfile must default to node:22-bookworm-slim.");
  }
  if (!lines.includes("FROM ${NODE_IMAGE} AS dependencies")) {
    findings.push("Dockerfile must use a dependencies stage from NODE_IMAGE.");
  }
  const installsProductionDependencies =
    lines.includes("RUN npm ci --omit=dev --ignore-scripts \\") &&
    lines.includes("&& npm cache clean --force");
  if (!installsProductionDependencies) {
    findings.push(
      "Dockerfile dependencies stage must install production dependencies with ignored scripts and clean npm cache."
    );
  }
  if (runtimeStart === -1) {
    findings.push("Dockerfile must use a runtime stage from NODE_IMAGE.");
  }
  if (!content.includes("NODE_ENV=production")) {
    findings.push("Dockerfile runtime stage must set NODE_ENV=production.");
  }
  if (!content.includes("PORT=8080")) {
    findings.push("Dockerfile runtime stage must default PORT=8080.");
  }
  if (!content.includes("apt-get install -y --no-install-recommends ca-certificates")) {
    findings.push("Dockerfile must install only required runtime CA certificates without recommended packages.");
  }
  if (!content.includes("rm -rf /var/lib/apt/lists/*")) {
    findings.push("Dockerfile must remove apt package lists after installing runtime packages.");
  }
  for (const copy of requiredRuntimeCopies) {
    if (!lines.includes(copy)) {
      findings.push(`Dockerfile is missing runtime copy rule: ${copy}`);
    }
  }
  for (const forbidden of ["COPY .", "ADD .", ".env", "_manager", ".git", "docs", "infra"]) {
    const offendingLine = lines.find(
      (line) => /^(?:COPY|ADD)\b/.test(line) && line.includes(forbidden)
    );
    if (offendingLine) {
      findings.push(`Dockerfile must not copy '${forbidden}' into the runtime image: ${offendingLine}`);
    }
  }
  if (userNode === -1) {
    findings.push("Dockerfile must switch to USER node before runtime startup.");
  } else if (cmd !== -1 && userNode > cmd) {
    findings.push("Dockerfile must switch to USER node before CMD.");
  }
  if (!content.includes("HEALTHCHECK") || !content.includes("/healthz")) {
    findings.push("Dockerfile must define a /healthz health check.");
  }
  if (cmd === -1) {
    findings.push("Dockerfile must start bin/server.cjs with node.");
  }
  return findings;
}

function checkDockerignore(content) {
  const findings = [];
  const entries = new Set(
    normalizedLines(content)
      .filter((line) => line && !line.startsWith("#"))
  );
  for (const entry of entries) {
    if (entry.startsWith("!")) {
      findings.push(`.dockerignore must not re-include ignored files: ${entry}`);
    }
  }
  for (const entry of requiredDockerignoreEntries) {
    if (!entries.has(entry)) {
      findings.push(`.dockerignore must exclude ${entry}.`);
    }
  }
  return findings;
}

function normalizedLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLineIndex(lines, pattern) {
  return lines.findIndex((line) => pattern.test(line));
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
  checkContainerImage,
  checkDockerfile,
  checkDockerignore,
  requiredDockerignoreEntries,
  requiredRuntimeCopies,
};
