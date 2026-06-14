"use strict";

const fs = require("fs");
const { redactSensitiveText } = require("./diagnostics.cjs");

const OPERATOR_EVIDENCE_STATUSES = ["pending", "complete", "deferred", "blocked"];
const OPERATOR_EVIDENCE_TEXT_MAX_CHARS = 1000;
const VALIDATED_OPERATOR_EVIDENCE = Symbol("validatedOperatorEvidence");
const OPERATOR_EVIDENCE_SECTIONS = [
  { id: "github-app", title: "GitHub App" },
  { id: "aws-ledger", title: "AWS Ledger" },
  { id: "iam-and-secrets", title: "IAM And Secrets" },
  { id: "app-server-runtime", title: "App Server Runtime" },
  { id: "container-publish-plan", title: "Container Publish Plan" },
  { id: "production-deployment-plan", title: "Production Deployment Plan" },
  { id: "budget-and-pricing", title: "Budget And Pricing" },
  { id: "worker-dispatch-credentials", title: "Worker Dispatch Credentials" },
  { id: "alert-delivery-plan", title: "Alert Delivery Plan" },
  { id: "worker-and-alerts", title: "Worker And Alerts" },
  { id: "dashboard-deployment-plan", title: "Dashboard Deployment Plan" },
  { id: "6529-io-surfaces", title: "6529.io Surfaces" },
  { id: "6529-io-public-disclosure", title: "6529.io Public Dashboard Disclosure" },
  { id: "6529-io-private-admin-auth", title: "6529.io Private Admin Auth" },
  { id: "dogfood-evidence", title: "Dogfood Evidence" },
  { id: "release-decision", title: "Release Decision" },
];

const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function loadOperatorEvidence(filePath = "config/production-evidence.example.json") {
  return validateOperatorEvidence(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateOperatorEvidence(document, source = "operator evidence") {
  assertObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const release = evidenceText(document.release, `${source}.release`);
  const summary = validateSummary(document.summary, `${source}.summary`);
  assertObject(document.sections, `${source}.sections`);
  const knownSectionIds = new Set(OPERATOR_EVIDENCE_SECTIONS.map((section) => section.id));
  for (const sectionId of Object.keys(document.sections)) {
    if (!knownSectionIds.has(sectionId)) {
      throw new Error(`${source}.sections references unknown section '${sectionId}'.`);
    }
  }
  const sections = OPERATOR_EVIDENCE_SECTIONS.map((definition) => {
    const section = document.sections[definition.id];
    if (!section) {
      throw new Error(`${source}.sections.${definition.id} is required.`);
    }
    return validateSection(definition, section, `${source}.sections.${definition.id}`);
  });
  const evidence = {
    version: 1,
    release,
    summary,
    sections,
  };
  Object.defineProperty(evidence, VALIDATED_OPERATOR_EVIDENCE, {
    value: true,
  });
  return evidence;
}

function validateSummary(value, source) {
  assertObject(value, source);
  return {
    date: evidenceText(value.date, `${source}.date`),
    operator: evidenceText(value.operator, `${source}.operator`),
    commit: evidenceText(value.commit, `${source}.commit`),
    environment: evidenceText(value.environment, `${source}.environment`),
    publicSummaryLocation: optionalEvidenceText(value.publicSummaryLocation),
    privateEvidenceLocation: evidenceText(value.privateEvidenceLocation, `${source}.privateEvidenceLocation`),
    releaseGateStatusFile: optionalEvidenceText(value.releaseGateStatusFile),
    releaseGateSummary: optionalEvidenceText(value.releaseGateSummary),
    releaseGateReadyCheck: optionalEvidenceText(value.releaseGateReadyCheck),
    productionCutoverStatusFile: optionalEvidenceText(value.productionCutoverStatusFile),
    productionCutoverSummary: optionalEvidenceText(value.productionCutoverSummary),
    productionCutoverReadyCheck: optionalEvidenceText(value.productionCutoverReadyCheck),
  };
}

function validateSection(definition, value, source) {
  assertObject(value, source);
  const status = enumField(value.status ?? "pending", OPERATOR_EVIDENCE_STATUSES, `${source}.status`);
  const evidence = normalizeEvidenceList(value.evidence, `${source}.evidence`);
  const notes = optionalEvidenceText(value.notes);
  if (status === "complete" && evidence.length === 0) {
    throw new Error(`${source}.evidence must be set when status is complete.`);
  }
  if ((status === "deferred" || status === "blocked") && !notes) {
    throw new Error(`${source}.notes must explain ${status} sections.`);
  }
  return {
    id: definition.id,
    title: definition.title,
    status,
    evidence,
    notes,
  };
}

function summarizeOperatorEvidence(document) {
  const evidence = isValidatedOperatorEvidence(document) ? document : validateOperatorEvidence(document);
  const counts = Object.fromEntries(OPERATOR_EVIDENCE_STATUSES.map((status) => [status, 0]));
  for (const section of evidence.sections) {
    counts[section.status] += 1;
  }
  return {
    release: evidence.release,
    total: evidence.sections.length,
    complete: counts.complete,
    deferred: counts.deferred,
    pending: counts.pending,
    blocked: counts.blocked,
    ready: counts.pending === 0 && counts.blocked === 0,
    hasDeferrals: counts.deferred > 0,
  };
}

function assertOperatorEvidenceReady(document) {
  const summary = summarizeOperatorEvidence(document);
  if (!summary.ready) {
    throw new Error(
      `operator evidence is not ready: ${summary.pending} pending, ${summary.blocked} blocked.`
    );
  }
  return summary;
}

function createOperatorEvidenceSkeleton(options = {}) {
  const release = evidenceText(options.release || "v0.1.0", "operator evidence skeleton release");
  const date = evidenceText(options.date || "YYYY-MM-DD", "operator evidence skeleton date");
  const operator = evidenceText(options.operator || "operator-name", "operator evidence skeleton operator");
  const commit = evidenceText(options.commit || "commit-or-tag", "operator evidence skeleton commit");
  const environment = evidenceText(
    options.environment || "dogfood-or-production",
    "operator evidence skeleton environment"
  );
  const privateEvidenceLocation = evidenceText(
    options.privateEvidenceLocation || "private operator runbook location",
    "operator evidence skeleton privateEvidenceLocation"
  );
  return validateOperatorEvidence({
    version: 1,
    release,
    summary: {
      date,
      operator,
      commit,
      environment,
      publicSummaryLocation: optionalEvidenceText(options.publicSummaryLocation || ""),
      privateEvidenceLocation,
      releaseGateStatusFile: optionalEvidenceText(options.releaseGateStatusFile || "v0-release-status.json"),
      releaseGateSummary: "pending",
      releaseGateReadyCheck: "not run",
      productionCutoverStatusFile: optionalEvidenceText(
        options.productionCutoverStatusFile || "production-cutover-status.json"
      ),
      productionCutoverSummary: "pending",
      productionCutoverReadyCheck: "not run",
    },
    sections: Object.fromEntries(
      OPERATOR_EVIDENCE_SECTIONS.map((section) => [
        section.id,
        {
          status: "pending",
          notes: `Evidence target: ${section.title}.`,
        },
      ])
    ),
  });
}

function writeOperatorEvidenceFile(filePath, document, options = {}) {
  if (!filePath) {
    throw new Error("operator evidence output path is required.");
  }
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`operator evidence file already exists: ${filePath}`);
  }
  const evidence = isValidatedOperatorEvidence(document) ? document : validateOperatorEvidence(document);
  fs.writeFileSync(filePath, `${JSON.stringify(serializableOperatorEvidence(evidence), null, 2)}\n`, "utf8");
  return evidence;
}

function renderOperatorEvidenceSummaryMarkdown(document) {
  const evidence = isValidatedOperatorEvidence(document) ? document : validateOperatorEvidence(document);
  const summary = summarizeOperatorEvidence(evidence);
  const lines = [
    `# ${publicEvidenceText(evidence.release)} Operator Evidence Summary`,
    "",
    `Ready for release: ${summary.ready ? "yes" : "no"}`,
    `Complete: ${summary.complete}/${summary.total}`,
    `Deferred: ${summary.deferred}`,
    `Pending: ${summary.pending}`,
    `Blocked: ${summary.blocked}`,
    "",
    `Date: ${publicEvidenceText(evidence.summary.date)}`,
    `Operator: ${publicEvidenceText(evidence.summary.operator)}`,
    `Commit or tag: ${publicEvidenceText(evidence.summary.commit)}`,
    `Environment: ${publicEvidenceText(evidence.summary.environment)}`,
    `Private evidence: ${publicEvidenceText(evidence.summary.privateEvidenceLocation)}`,
  ];
  if (evidence.summary.publicSummaryLocation) {
    lines.push(`Public summary: ${publicEvidenceText(evidence.summary.publicSummaryLocation)}`);
  }
  if (evidence.summary.releaseGateSummary) {
    lines.push(`Release gate summary: ${publicEvidenceText(evidence.summary.releaseGateSummary)}`);
  }
  if (evidence.summary.releaseGateReadyCheck) {
    lines.push(`Release gate ready check: ${publicEvidenceText(evidence.summary.releaseGateReadyCheck)}`);
  }
  if (evidence.summary.productionCutoverStatusFile) {
    lines.push(`Production cutover status file: ${publicEvidenceText(evidence.summary.productionCutoverStatusFile)}`);
  }
  if (evidence.summary.productionCutoverSummary) {
    lines.push(`Production cutover summary: ${publicEvidenceText(evidence.summary.productionCutoverSummary)}`);
  }
  if (evidence.summary.productionCutoverReadyCheck) {
    lines.push(`Production cutover ready check: ${publicEvidenceText(evidence.summary.productionCutoverReadyCheck)}`);
  }
  lines.push("");
  lines.push("## Sections");
  for (const section of evidence.sections) {
    const checkbox = section.status === "complete" ? "x" : " ";
    lines.push(`- [${checkbox}] **${section.id}** _(${section.status})_: ${section.title}`);
    for (const item of section.evidence) {
      lines.push(`  Evidence: ${publicEvidenceText(item)}`);
    }
    if (section.notes) {
      lines.push(`  Notes: ${publicEvidenceText(section.notes)}`);
    }
  }
  if (summary.hasDeferrals) {
    lines.push("");
    lines.push("Deferred sections must be named in release notes with risk and follow-up ownership.");
  }
  return `${lines.join("\n")}\n`;
}

function publicOperatorEvidenceDocument(document) {
  const evidence = isValidatedOperatorEvidence(document) ? document : validateOperatorEvidence(document);
  return {
    version: 1,
    release: publicEvidenceText(evidence.release),
    summary: Object.fromEntries(
      Object.entries(evidence.summary).map(([key, value]) => [key, publicEvidenceText(value)])
    ),
    sections: evidence.sections.map((section) => ({
      id: section.id,
      title: section.title,
      status: section.status,
      evidence: section.evidence.map(publicEvidenceText),
      notes: publicEvidenceText(section.notes),
    })),
  };
}

function serializableOperatorEvidence(document) {
  const evidence = isValidatedOperatorEvidence(document) ? document : validateOperatorEvidence(document);
  return {
    version: 1,
    release: evidence.release,
    summary: evidence.summary,
    sections: Object.fromEntries(
      evidence.sections.map((section) => [
        section.id,
        {
          status: section.status,
          ...(section.evidence.length ? { evidence: section.evidence } : {}),
          ...(section.notes ? { notes: section.notes } : {}),
        },
      ])
    ),
  };
}

function publicEvidenceText(value) {
  let text = redactSensitiveText(value);
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .slice(0, OPERATOR_EVIDENCE_TEXT_MAX_CHARS)
    .replace(/\r?\n/g, " ");
}

function isValidatedOperatorEvidence(value) {
  return Boolean(value && value[VALIDATED_OPERATOR_EVIDENCE] === true);
}

function normalizeEvidenceList(value, source) {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item, index) => evidenceText(item, `${source}[${index}]`));
}

function evidenceText(value, source) {
  const text = optionalEvidenceText(value);
  if (!text) {
    throw new Error(`${source} must be a non-empty string.`);
  }
  return text;
}

function optionalEvidenceText(value) {
  return String(value === undefined || value === null ? "" : value)
    .trim()
    .slice(0, OPERATOR_EVIDENCE_TEXT_MAX_CHARS);
}

function assertObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

function enumField(value, allowed, source) {
  const text = evidenceText(value, source);
  if (!allowed.includes(text)) {
    throw new Error(`${source} must be one of: ${allowed.join(", ")}.`);
  }
  return text;
}

module.exports = {
  OPERATOR_EVIDENCE_SECTIONS,
  OPERATOR_EVIDENCE_STATUSES,
  assertOperatorEvidenceReady,
  createOperatorEvidenceSkeleton,
  loadOperatorEvidence,
  publicEvidenceText,
  publicOperatorEvidenceDocument,
  renderOperatorEvidenceSummaryMarkdown,
  serializableOperatorEvidence,
  summarizeOperatorEvidence,
  validateOperatorEvidence,
  writeOperatorEvidenceFile,
};
