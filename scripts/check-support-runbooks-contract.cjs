#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/support.md",
  "docs/incident-response.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkSupportRunbooksContract();
  console.log(
    `support runbooks contract ok (${result.supportCases} support cases, ${result.incidentCases} incident cases, ${result.docs} docs checked)`
  );
}

function checkSupportRunbooksContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const supportText = getDocText("docs/support.md", docTexts, options.supportText);
  const incidentText = getDocText(
    "docs/incident-response.md",
    docTexts,
    options.incidentText
  );

  checkSupportSections(supportText, findings);
  checkSupportSafety(supportText, findings);
  checkSupportBundleGuidance(supportText, findings);
  checkSupportTriage(supportText, findings);
  checkIncidentSections(incidentText, findings);
  checkIncidentContainment(incidentText, findings);
  checkIncidentScenarios(incidentText, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`support runbooks contract check found ${findings.length} issue(s).`);
  }

  return {
    supportCases: 4,
    incidentCases: 3,
    docs: targetDocs.length,
  };
}

function checkSupportSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Public Support",
      "## Support Bundle",
      "## Good Bug Reports",
      "## Maintainer Triage",
      "## Escalation",
    ],
    "docs/support.md",
    findings
  );
}

function checkSupportSafety(text, findings) {
  for (const snippet of [
    "Do not use public issues for:",
    "provider keys, GitHub tokens, webhook secrets, AWS credentials, or database ARNs",
    "private PR diffs, private repository names, or raw webhook payloads",
    "suspected vulnerabilities",
    "Security issues should follow [SECURITY.md](../SECURITY.md).",
    "Before copying support findings into public docs, issues, release notes, or manager memory",
    "npm run check:public-artifacts",
    "Use [Incident Response](incident-response.md) for containment steps.",
  ]) {
    requireSnippet(text, snippet, "support safety guidance", findings);
  }
}

function checkSupportBundleGuidance(text, findings) {
  for (const snippet of [
    "npm run support:bundle",
    "npm run support:bundle -- -- --json",
    "secret/account-linked setting presence as `set` or `unset`",
    "It does not include secret values.",
    "target repository diffs, prompts, provider responses, webhook payloads, private worker repository names, or absolute local config paths",
    "Use `--include-git-status` only when file names in your local checkout are safe to disclose.",
  ]) {
    requireSnippet(text, snippet, "support bundle guidance", findings);
  }
}

function checkSupportTriage(text, findings) {
  for (const snippet of [
    "confirm the report does not contain secrets or private payloads",
    "label the area: `review-engine`, `github-app`, `worker`, `provider`,",
    "ask for a support bundle if the report is missing runtime context",
    "reproduce locally with `npm run release:check` or a focused command",
    "hide or delete the content through GitHub moderation tools",
    "rotate the exposed secret if needed",
    "Escalate privately when a report involves:",
    "incorrect budget admission that could cause unexpected spend",
    "bot comments that disclose private data",
    "exploitable prompt injection or command abuse",
  ]) {
    requireSnippet(text, snippet, "support maintainer triage", findings);
  }
}

function checkIncidentSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Severity",
      "## First Five Minutes",
      "## Spend Spike",
      "## Secret Exposure",
      "## Provider Outage Or Bad Provider Responses",
      "## Webhook Replay Or Command Abuse",
      "## Ledger Or Dashboard Outage",
      "## Bad Bot Comment",
      "## Post-Incident Notes",
    ],
    "docs/incident-response.md",
    findings
  );
}

function checkIncidentContainment(text, findings) {
  for (const snippet of [
    "Do not paste provider keys, GitHub App private keys, webhook secrets, AWS credentials, raw private repository payloads, or private PR data",
    "SEV1  Active secret exposure, uncontrolled provider spend, or broad incorrect",
    "SEV2  One repository or provider path is impaired, spend is bounded",
    "SEV3  Localized failure with a workaround",
    "REVIEWBOT_ENABLED=false",
    "REVIEWBOT_WORKER_ADAPTER=noop",
    "REVIEWBOT_PUBLIC_REPO_MODE=off",
    "enabled: false",
    "Preserve evidence privately:",
    "npm run preflight -- -- --json",
    "npm run webhook:replay -- -- --payload payload.json",
    "--assume-empty-budget",
  ]) {
    requireSnippet(text, snippet, "incident containment guidance", findings);
  }
}

function checkIncidentScenarios(text, findings) {
  for (const snippet of [
    "reviewbot.ai_review_budget_policies",
    "from reviewbot.ai_review_usage_events",
    "from reviewbot.ai_review_job_events",
    "restart in command-only or trusted-only mode",
    "revoke or rotate the exposed secret",
    "check whether the secret was sent to a model provider or public GitHub surface",
    "REVIEWBOT_REVIEW_LANES",
    "inspect bot comments for provider error leakage",
    "verify GitHub webhook signatures are enforced",
    "add abusive actors to `REVIEWBOT_DENY_USERS`",
    "confirm requestor attribution points to the trusted trigger",
    "REVIEW_USAGE_FAIL_CLOSED=true|false",
    "REVIEWBOT_JOB_LEDGER_FAIL_CLOSED=true|false",
    "keep public dashboards in a degraded state rather than exposing private raw rows",
    "hide or delete the comment if it is misleading, unsafe, or contains private data",
    "preserve the hidden metadata marker and job id privately",
    "Public follow-up should be sanitized",
  ]) {
    requireSnippet(text, snippet, "incident scenario guidance", findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:support-runbooks",
      "[Support](docs/support.md)",
      "[Incident Response](docs/incident-response.md)",
    ],
    "docs/support.md": [
      "support runbooks contract",
      "npm run check:support-runbooks",
    ],
    "docs/incident-response.md": [
      "support runbooks contract",
      "npm run check:support-runbooks",
    ],
    "docs/release-operations-map.md": [
      "npm run check:support-runbooks",
      "support and incident playbooks",
    ],
    "docs/release.md": [
      "npm run check:support-runbooks",
      "support and incident playbooks",
    ],
    "docs/release-readiness.md": [
      "npm run check:support-runbooks",
      "Support Playbook",
      "Incident Response",
    ],
    "docs/roadmap.md": [
      "support runbook checks",
      "incident response playbook",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(getDocText(doc, docTexts));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function checkOrderedHeadings(text, headings, doc, findings) {
  let lastIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) {
      findings.push(`${doc} must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push(`${doc} sections must stay in order.`);
    }
    lastIndex = index;
  }
}

function requireSnippet(text, snippet, label, findings) {
  if (!hasSnippet(text, snippet)) {
    findings.push(`${label} must include '${snippet}'.`);
  }
}

function getDocText(relativePath, docTexts, explicitText) {
  if (explicitText !== undefined) {
    return explicitText;
  }
  if (Object.prototype.hasOwnProperty.call(docTexts, relativePath)) {
    return docTexts[relativePath];
  }
  return readText(relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function hasSnippet(text, snippet) {
  return normalizeWhitespace(text).includes(normalizeWhitespace(snippet));
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkSupportRunbooksContract,
  targetDocs,
};
