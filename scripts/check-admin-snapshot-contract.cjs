#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const adminSnapshot = require("../src/admin-snapshot.cjs");
const adminSnapshotCli = require("../bin/admin-snapshot.cjs");

const root = path.resolve(__dirname, "..");

const expectedSnapshotOptions = {
  days: 30,
  recentDays: 7,
  limit: 50,
  staleMinutes: 120,
};

const expectedChecks = [
  "admin_usage_summary",
  "recent_usage_events",
  "budget_status",
  "model_price_status",
  "alert_status",
  "failed_job_events",
  "stale_run_claims",
  "runtime_status_server",
  "runtime_status_worker",
];

const expectedWarnings = [
  "budget_status: over-budget periods present",
  "budget_status: high utilization periods present",
  "model_price_status: staleRows=1",
  "model_price_status: futureRows=1",
  "model_price_status: missingSourceRows=1",
  "model_price_status: invalidSourceRows=1",
  "model_price_status: incompleteRows=1",
  "alert_status: alerts disabled",
  "failed_job_events: recent dispatch failures present",
  "stale_run_claims: stale active claims present",
  "runtime_status_worker: preflight not ok",
];

const snapshotDocs = [
  "README.md",
  "docs/6529-io-admin-integration.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/operator-evidence-template.md",
  "docs/release-operations-map.md",
];

function main() {
  checkAdminSnapshotContract()
    .then((result) => {
      console.log(
        `admin snapshot contract ok (${result.checks} checks, ${result.flags} CLI flags, ${result.docs} docs checked)`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

async function checkAdminSnapshotContract(options = {}) {
  const findings = [];

  checkDefaults(findings);
  await checkCollectionPolicy(findings);
  await checkWarningAndRedactionContract(findings);
  checkCliContract(findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`admin snapshot contract check found ${findings.length} issue(s).`);
  }

  return {
    checks: expectedChecks.length,
    flags: 9,
    docs: snapshotDocs.length,
  };
}

function checkDefaults(findings) {
  if (!objectsEqual(adminSnapshot.DEFAULT_SNAPSHOT_OPTIONS, expectedSnapshotOptions)) {
    findings.push(
      `DEFAULT_SNAPSHOT_OPTIONS must be ${JSON.stringify(expectedSnapshotOptions)}, got ${JSON.stringify(adminSnapshot.DEFAULT_SNAPSHOT_OPTIONS)}.`
    );
  }
}

async function checkCollectionPolicy(findings) {
  const calls = [];
  const snapshot = await adminSnapshot.collectAdminSnapshot({
    now: new Date("2026-06-13T12:00:00.000Z"),
    days: 14,
    recentDays: 3,
    limit: 5,
    staleMinutes: 90,
    client: recordingClient(calls, healthyResponses()),
  });

  if (snapshot.generatedAt !== "2026-06-13T12:00:00.000Z") {
    findings.push(`admin snapshot generatedAt must use the supplied clock, got ${snapshot.generatedAt}.`);
  }
  if (!objectsEqual(snapshot.policy, { days: 14, recentDays: 3, limit: 5, staleMinutes: 90 })) {
    findings.push(`admin snapshot policy must reflect supplied options, got ${JSON.stringify(snapshot.policy)}.`);
  }
  const checkNames = snapshot.checks.map((check) => check.name);
  if (!arraysEqual(checkNames, expectedChecks)) {
    findings.push(`admin snapshot checks must be ${JSON.stringify(expectedChecks)}, got ${JSON.stringify(checkNames)}.`);
  }
  if (!snapshot.ok || snapshot.warnings.length !== 0) {
    findings.push("healthy admin snapshot fixture must be ok with no warnings.");
  }

  const expectedCalls = [
    ["adminUsageSummary", { days: 14 }],
    ["recentUsageEvents", { days: 3, limit: 5 }],
    ["budgetStatus", undefined],
    ["modelPriceStatus", undefined],
    ["alertStatus", undefined],
    ["jobEvents", { status: "dispatch_failed", limit: 5 }],
    ["runClaims", { active: true, staleMinutes: 90, limit: 5 }],
    ["runtimeStatus", { profile: "server" }],
    ["runtimeStatus", { profile: "worker" }],
  ];
  if (JSON.stringify(calls) !== JSON.stringify(expectedCalls)) {
    findings.push(`admin snapshot client call contract changed: ${JSON.stringify(calls)}.`);
  }
}

async function checkWarningAndRedactionContract(findings) {
  const snapshot = await adminSnapshot.collectAdminSnapshot({
    now: new Date("2026-06-13T12:00:00.000Z"),
    client: {
      ...recordingClient([], warningResponses()),
      adminUsageSummary: async () => {
        throw new Error(
          "loader failed with github_pat_abcdefghijklmnopqrstuvwxyz1234567890 and sk-proj-abcdefghijklmnopqrstuvwx123456"
        );
      },
    },
  });

  const checkNames = snapshot.checks.map((check) => check.name);
  if (!arraysEqual(checkNames, expectedChecks)) {
    findings.push(`admin snapshot failure fixture checks changed: ${JSON.stringify(checkNames)}.`);
  }
  if (snapshot.ok) {
    findings.push("warning admin snapshot fixture must not be ok.");
  }
  for (const warning of expectedWarnings) {
    if (!snapshot.warnings.includes(warning)) {
      findings.push(`admin snapshot warnings must include '${warning}'.`);
    }
  }
  if (!snapshot.warnings.includes("admin_usage_summary: unavailable")) {
    findings.push("admin snapshot warnings must include unavailable checks.");
  }

  const markdown = adminSnapshot.formatAdminSnapshotMarkdown(snapshot);
  const json = JSON.stringify(snapshot);
  for (const output of [markdown, json]) {
    if (output.includes("github_pat_abcdefghijklmnopqrstuvwxyz") || output.includes("sk-proj-abcdefghijkl")) {
      findings.push("admin snapshot output must redact common secret-shaped strings.");
    }
    if (!output.includes("github_pat_[redacted]") || !output.includes("sk-[redacted]")) {
      findings.push("admin snapshot output must preserve redacted placeholders for operators.");
    }
  }
  if (!markdown.includes("# 6529reviewbot Admin Snapshot")) {
    findings.push("admin snapshot markdown must keep its public-safe heading.");
  }
  if (!markdown.includes("Overall: attention required")) {
    findings.push("admin snapshot markdown must summarize non-ok posture.");
  }
}

function checkCliContract(findings) {
  const parsed = adminSnapshotCli.parseArgs([
    "--json",
    "--quiet",
    "--require-ok",
    "--base-url",
    "https://reviewbot.example.com",
    "--actor",
    "operator",
    "--roles",
    "reviewbot-admin,admin",
    "--days",
    "14",
    "--recent-days",
    "3",
    "--limit",
    "5",
    "--stale-minutes",
    "90",
  ]);
  const expected = {
    json: true,
    quiet: true,
    requireOk: true,
    baseUrl: "https://reviewbot.example.com",
    actor: "operator",
    roles: ["reviewbot-admin", "admin"],
    days: "14",
    recentDays: "3",
    limit: "5",
    staleMinutes: "90",
  };
  if (!objectsEqual(parsed, expected)) {
    findings.push(`admin snapshot CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }

  const usage = adminSnapshotCli.usage();
  const requiredUsage = [
    "Usage: npm run admin:snapshot -- --base-url <url> [options]",
    "--json",
    "--quiet",
    "--require-ok",
    "--base-url <url>",
    "--actor <value>",
    "--roles <csv>",
    "--days <n>",
    "--recent-days <n>",
    "--limit <n>",
    "--stale-minutes <n>",
  ];
  for (const snippet of requiredUsage) {
    if (!usage.includes(snippet)) {
      findings.push(`admin snapshot CLI usage must include '${snippet}'.`);
    }
  }
  expectError(
    () => adminSnapshotCli.parseArgs(["--base-url"]),
    "--base-url requires a value.",
    findings
  );
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run admin:snapshot -- -- --base-url https://reviewbot.example.com",
      "Collect a private admin API posture snapshot",
    ],
    "docs/6529-io-admin-integration.md": [
      "## Operator Snapshot",
      "npm run admin:snapshot -- -- --base-url https://reviewbot.example.com",
      "npm run admin:snapshot -- -- --json --require-ok",
      "does not print raw usage events, private repo names, budget scope values",
      "`--require-ok` exits non-zero when any endpoint is unavailable or any warning posture is present.",
    ],
    "docs/release.md": [
      "npm run admin:snapshot -- -- --base-url <production-bot-origin> --require-ok",
      "keep the detailed snapshot private",
    ],
    "docs/release-readiness.md": [
      "admin snapshot CLI for private dashboard bring-up and release evidence",
    ],
    "docs/operator-evidence-template.md": [
      "Admin snapshot command result:",
    ],
    "docs/release-operations-map.md": [
      "private webhook payloads, provider responses, admin snapshots, and raw",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function recordingClient(calls, responses) {
  return {
    adminUsageSummary: async (query) => record(calls, responses, "adminUsageSummary", query),
    recentUsageEvents: async (query) => record(calls, responses, "recentUsageEvents", query),
    budgetStatus: async (query) => record(calls, responses, "budgetStatus", query),
    modelPriceStatus: async (query) => record(calls, responses, "modelPriceStatus", query),
    alertStatus: async (query) => record(calls, responses, "alertStatus", query),
    jobEvents: async (query) => record(calls, responses, "jobEvents", query),
    runClaims: async (query) => record(calls, responses, "runClaims", query),
    runtimeStatus: async (query) => record(calls, responses, "runtimeStatus", query),
  };
}

function record(calls, responses, method, query) {
  calls.push([method, query]);
  const response = responses[method];
  return typeof response === "function" ? response(query) : response;
}

function healthyResponses() {
  return {
    adminUsageSummary: {
      totals: { reviewRuns: 1, costUsd: 0.5, totalTokens: 1000, budgetSkippedRuns: 0 },
      byRequestor: [{ key: "operator" }],
      byPr: [{ key: "repo#1" }],
    },
    recentUsageEvents: { events: [] },
    budgetStatus: { policies: [] },
    modelPriceStatus: { status: { summary: {} } },
    alertStatus: { status: { enabled: true, spend: { enabled: true }, jobHealth: { enabled: true }, notifier: { mode: "sns" } } },
    jobEvents: { events: [] },
    runClaims: { active: true, staleMinutes: 90, claims: [] },
    runtimeStatus: (query) => ({
      profile: query?.profile || "server",
      preflight: { ok: true, checks: [] },
    }),
  };
}

function warningResponses() {
  return {
    ...healthyResponses(),
    budgetStatus: {
      policies: [{
        utilization: {
          daily: { overBudget: true, percentUsed: 120 },
          weekly: { overBudget: false, percentUsed: 85 },
          monthly: { overBudget: false, percentUsed: 10 },
        },
      }],
    },
    modelPriceStatus: {
      status: {
        summary: {
          activeRows: 1,
          providerModelCount: 1,
          staleRows: 1,
          futureRows: 1,
          missingSourceRows: 1,
          invalidSourceRows: 1,
          incompleteRows: 1,
        },
      },
    },
    alertStatus: { status: { enabled: false, spend: {}, jobHealth: {}, notifier: {} } },
    jobEvents: { events: [{ jobId: "failed" }] },
    runClaims: { active: true, staleMinutes: 120, claims: [{ jobId: "stale" }] },
    runtimeStatus: (query) => ({
      profile: query?.profile || "server",
      preflight: {
        ok: query?.profile !== "worker",
        checks: [],
        warnings: query?.profile === "worker" ? [{}] : [],
        errors: query?.profile === "worker" ? [{}] : [],
      },
    }),
  };
}

function expectError(fn, expectedMessage, findings) {
  try {
    fn();
    findings.push(`expected error '${expectedMessage}'.`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      findings.push(`expected error '${expectedMessage}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAdminSnapshotContract,
  expectedChecks,
};
