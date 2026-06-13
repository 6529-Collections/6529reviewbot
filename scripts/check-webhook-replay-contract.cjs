#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const replayWebhook = require("../bin/replay-webhook.cjs");

const root = path.resolve(__dirname, "..");

const replayDocs = [
  "README.md",
  "docs/configuration.md",
  "docs/github-app.md",
  "docs/incident-response.md",
  "docs/release-operations-map.md",
  "docs/release-readiness.md",
];

async function main() {
  const result = await checkWebhookReplayContract();
  console.log(
    `webhook replay contract ok (${result.replayCases} replay cases, ${result.docs} docs checked)`
  );
}

async function checkWebhookReplayContract(options = {}) {
  const findings = [];
  checkArgumentContract(findings);
  await checkDryRunReplay(findings);
  await checkNoRawPayloadEcho(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`webhook replay contract check found ${findings.length} issue(s).`);
  }

  return {
    replayCases: 3,
    docs: replayDocs.length,
  };
}

function checkArgumentContract(findings) {
  const parsed = replayWebhook.parseArgs(["--payload", "payload.json"]);
  if (parsed.dispatch !== false) {
    findings.push("webhook replay must default dispatch to false.");
  }
  if (parsed.assumeEmptyBudget !== false) {
    findings.push("webhook replay must not assume empty budget unless requested.");
  }
  const dispatch = replayWebhook.parseArgs(["--payload", "payload.json", "--dispatch"]);
  if (dispatch.dispatch !== true) {
    findings.push("--dispatch must be the only parser path that enables dispatch.");
  }
  const cost = replayWebhook.parseArgs([
    "--payload",
    "payload.json",
    "--estimated-cost-usd",
    "0.25",
  ]);
  if (cost.estimatedCostUsd !== 0.25) {
    findings.push("--estimated-cost-usd must parse as a non-negative number.");
  }
  expectError(
    () => replayWebhook.parseArgs([]),
    "Pass --payload",
    findings,
    "missing payload"
  );
  expectError(
    () => replayWebhook.parseArgs(["--payload", "payload.json", "--estimated-cost-usd", "-1"]),
    "non-negative",
    findings,
    "negative estimated cost"
  );
}

async function checkDryRunReplay(findings) {
  const result = await replayWebhook.replayWebhook({
    payloadPath: "templates/self-dogfood-comment-command.payload.json",
    eventName: "issue_comment",
    deliveryId: "contract-dry-run",
    webhookSecret: "contract-webhook-secret",
    actorPermission: "write",
    repositoryConfigPath: ".github/6529bot.yml",
    assumeEmptyBudget: true,
    estimatedCostUsd: 0.25,
  });
  if (result.statusCode !== 200) {
    findings.push(`dry-run replay must return 200 for admitted dry-run command, got ${result.statusCode}.`);
  }
  if (result.replay.dryRun !== true || result.replay.dispatched !== false) {
    findings.push("dry-run replay summary must report dryRun true and dispatched false.");
  }
  if (result.body.enqueued !== false) {
    findings.push("dry-run replay must not enqueue worker jobs.");
  }
  if (result.body.queue?.adapter !== "dry_run") {
    findings.push(`dry-run replay must use dry_run adapter, got ${result.body.queue?.adapter}.`);
  }
  if (!String(result.body.queue?.reason || "").includes("no workers dispatched")) {
    findings.push("dry-run queue result must explicitly say no workers were dispatched.");
  }
  if (!Array.isArray(result.body.jobs) || result.body.jobs.length === 0) {
    findings.push("dry-run replay should still report admitted jobs for operator inspection.");
  }
  if (JSON.stringify(result).includes("raw webhook secret sentinel")) {
    findings.push("dry-run replay must not echo raw payload-only sentinel text.");
  }
}

async function checkNoRawPayloadEcho(findings) {
  const result = await replayWebhook.replayWebhook({
    payloadPath: "-",
    readStdin: () =>
      JSON.stringify({
        zen: "raw webhook secret sentinel",
        hook: { id: 1 },
        repository: { full_name: "6529-Collections/6529reviewbot", private: false },
        sender: { login: "maintainer" },
      }),
    eventName: "ping",
    deliveryId: "contract-ping",
    webhookSecret: "contract-webhook-secret",
  });
  const text = JSON.stringify(result);
  if (text.includes("raw webhook secret sentinel")) {
    findings.push("ping replay output must summarize the event without echoing raw payload fields.");
  }
  if (result.replay.payloadBytes <= 0) {
    findings.push("replay summary must report payload byte count instead of payload body.");
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "bin/replay-webhook.cjs";
  const text = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "dispatch: false",
    "enqueueReviewJobs: options.dispatch",
    ": dryRunReviewJobEnqueuer",
    "dryRun: !options.dispatch",
    "dispatched: Boolean(options.dispatch)",
    "Without --dispatch, replay is a dry run and will not call providers or workers.",
  ]) {
    if (!text.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:webhook-replay"],
    "docs/configuration.md": [
      "It is dry-run by default and does not dispatch workers or call providers.",
      "npm run check:webhook-replay",
    ],
    "docs/github-app.md": [
      "Replay is dry-run by default",
      "without dispatching workers",
    ],
    "docs/incident-response.md": [
      "Use webhook replay only with sanitized saved payloads and no dispatch",
    ],
    "docs/release-operations-map.md": [
      "npm run check:webhook-replay",
    ],
    "docs/release-readiness.md": [
      "webhook replay checker",
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

function expectError(fn, expected, findings, label) {
  try {
    fn();
    findings.push(`${label} should have thrown.`);
  } catch (error) {
    if (!String(error.message || "").includes(expected)) {
      findings.push(`${label} must throw '${expected}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  checkWebhookReplayContract,
  replayDocs,
};
