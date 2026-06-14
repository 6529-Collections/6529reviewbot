#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const docs = [
  "README.md",
  "infra/aws/README.md",
  "docs/security-model.md",
  "docs/security-review-checklist.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

const templates = {
  trust: "infra/aws/github-actions-oidc-trust-policy.example.json",
  ledger: "infra/aws/usage-ledger-data-api-policy.example.json",
  alerts: "infra/aws/scheduled-spend-alerts-policy.example.json",
};

function main() {
  const result = checkAwsIamTemplates();
  console.log(
    `aws iam templates ok (${result.templates} templates, ${result.actions} actions, ${result.docs} docs checked)`
  );
}

function checkAwsIamTemplates(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const jsonTexts = options.jsonTexts || {};

  const trust = parseTemplate(templates.trust, jsonTexts, findings);
  const ledger = parseTemplate(templates.ledger, jsonTexts, findings);
  const alerts = parseTemplate(templates.alerts, jsonTexts, findings);

  if (trust) {
    checkTrustPolicy(trust, findings);
  }
  if (ledger) {
    checkLedgerPolicy(ledger, findings);
  }
  if (alerts) {
    checkAlertPolicy(alerts, findings);
  }
  checkNoWildcards([trust, ledger, alerts].filter(Boolean), findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`aws iam template check found ${findings.length} issue(s).`);
  }

  return {
    templates: Object.keys(templates).length,
    actions: 6,
    docs: docs.length + 1,
  };
}

function checkTrustPolicy(policy, findings) {
  const statements = expectStatements(policy, "trust policy", findings);
  if (statements.length !== 1) {
    findings.push("trust policy must contain exactly one statement.");
    return;
  }
  const statement = statements[0];
  expectEqual(statement.Sid, "TrustReviewbotRepositoryGitHubActions", "trust policy Sid", findings);
  expectEqual(statement.Effect, "Allow", "trust policy Effect", findings);
  expectEqual(statement.Action, "sts:AssumeRoleWithWebIdentity", "trust policy Action", findings);
  expectEqual(
    statement.Principal && statement.Principal.Federated,
    "arn:aws:iam::<aws-account-id>:oidc-provider/token.actions.githubusercontent.com",
    "trust policy federated principal",
    findings
  );
  expectEqual(
    statement.Condition &&
      statement.Condition.StringEquals &&
      statement.Condition.StringEquals["token.actions.githubusercontent.com:aud"],
    "sts.amazonaws.com",
    "trust policy audience condition",
    findings
  );
  expectEqual(
    statement.Condition &&
      statement.Condition.StringLike &&
      statement.Condition.StringLike["token.actions.githubusercontent.com:sub"],
    "repo:<owner>/<repo>:ref:refs/heads/<branch-name>",
    "trust policy subject condition",
    findings
  );
}

function checkLedgerPolicy(policy, findings) {
  const statements = expectStatements(policy, "usage ledger policy", findings);
  expectStatement(statements, {
    sid: "UseReviewbotAuroraDataApi",
    actions: ["rds-data:ExecuteStatement"],
    resource: "arn:aws:rds:<aws-region>:<aws-account-id>:cluster:<cluster-name>",
  }, findings);
  expectStatement(statements, {
    sid: "ReadReviewbotDatabaseSecret",
    actions: ["secretsmanager:GetSecretValue"],
    resource: "arn:aws:secretsmanager:<aws-region>:<aws-account-id>:secret:<secret-name>",
  }, findings);
  if (statements.length !== 2) {
    findings.push(`usage ledger policy must contain exactly 2 statements, got ${statements.length}.`);
  }
}

function checkAlertPolicy(policy, findings) {
  const statements = expectStatements(policy, "scheduled alert policy", findings);
  expectStatement(statements, {
    sid: "ReadReviewbotAuroraDataApi",
    actions: ["rds-data:ExecuteStatement"],
    resource: "arn:aws:rds:<aws-region>:<aws-account-id>:cluster:<cluster-name>",
  }, findings);
  expectStatement(statements, {
    sid: "ReadReviewbotDatabaseSecret",
    actions: ["secretsmanager:GetSecretValue"],
    resource: "arn:aws:secretsmanager:<aws-region>:<aws-account-id>:secret:<secret-name>",
  }, findings);
  expectStatement(statements, {
    sid: "PublishReviewbotSpendAlerts",
    actions: ["sns:Publish"],
    resource: "arn:aws:sns:<aws-region>:<aws-account-id>:<sns-topic-name>",
  }, findings);
  expectStatement(statements, {
    sid: "SendReviewbotSpendAlertEmails",
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resource: "arn:aws:ses:<aws-region>:<aws-account-id>:identity/<ses-identity-name>",
  }, findings);
  if (statements.length !== 4) {
    findings.push(`scheduled alert policy must contain exactly 4 statements, got ${statements.length}.`);
  }
}

function checkNoWildcards(policies, findings) {
  for (const policy of policies) {
    for (const statement of policy.Statement || []) {
      const actions = arrayValue(statement.Action);
      const resources = arrayValue(statement.Resource);
      if (actions.some((action) => action === "*" || action.endsWith(":*"))) {
        findings.push(`statement ${statement.Sid || "<unknown>"} must not use wildcard actions.`);
      }
      if (resources.includes("*")) {
        findings.push(`statement ${statement.Sid || "<unknown>"} must not use wildcard resources.`);
      }
      if (actions.some((action) => action === "iam:PassRole")) {
        findings.push(`statement ${statement.Sid || "<unknown>"} must not grant iam:PassRole.`);
      }
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:aws-iam-templates",
      "[AWS IAM Templates](infra/aws/README.md)",
    ],
    "infra/aws/README.md": [
      "npm run check:aws-iam-templates",
      "least-privilege roles for the bot repository",
      "Target application repositories should not receive AWS credentials",
      "repo:6529-Collections/6529reviewbot:ref:refs/heads/main",
      "Use database roles/grants for table-level least privilege",
      "Do not copy the secret ARN or AWS role trust into target repositories.",
      "Confirm the trust policy `aud` condition",
      "runtime secret-store access principals",
      "target repositories and browser bundles receive no provider keys",
      "break-glass revoke/disable",
      "`iam-and-secrets` operator evidence",
    ],
    "docs/security-model.md": [
      "Start from the example templates in [infra/aws](../infra/aws/README.md)",
      "least-privilege RDS Data API permissions",
    ],
    "docs/security-review-checklist.md": [
      "AWS IAM/OIDC policies are rendered from reviewed templates",
      "trust scoped to the bot repo/environment",
    ],
    "docs/release-operations-map.md": [
      "npm run check:aws-iam-templates",
      "AWS IAM/OIDC",
    ],
    "docs/release.md": [
      "npm run check:aws-iam-templates",
      "AWS IAM/OIDC",
    ],
    "docs/release-readiness.md": [
      "npm run check:aws-iam-templates",
      "AWS IAM/OIDC",
    ],
    "docs/roadmap.md": [
      "AWS IAM/OIDC template checks",
      "least-privilege",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(getText(doc, docTexts));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }

  const checklist = JSON.parse(readText("config/production-cutover-checklist.json"));
  const awsItem = JSON.stringify(checklist);
  for (const snippet of [
    "aws-iam-reviewed",
    "AWS IAM/OIDC trust",
    "iam-and-secrets operator evidence",
    "runtime secret-store principals",
    "break-glass revoke paths",
    "infra/aws/README.md",
  ]) {
    if (!awsItem.includes(snippet)) {
      findings.push(`config/production-cutover-checklist.json must include '${snippet}'.`);
    }
  }
}

function expectStatements(policy, label, findings) {
  if (policy.Version !== "2012-10-17") {
    findings.push(`${label} must use IAM policy Version 2012-10-17.`);
  }
  if (!Array.isArray(policy.Statement)) {
    findings.push(`${label} must contain a Statement array.`);
    return [];
  }
  for (const statement of policy.Statement) {
    if (statement.Effect !== "Allow") {
      findings.push(`${label} statement ${statement.Sid || "<unknown>"} must have Effect Allow.`);
    }
  }
  return policy.Statement;
}

function expectStatement(statements, expected, findings) {
  const statement = statements.find((candidate) => candidate.Sid === expected.sid);
  if (!statement) {
    findings.push(`missing IAM statement ${expected.sid}.`);
    return;
  }
  expectEqual(statement.Effect, "Allow", `${expected.sid} Effect`, findings);
  if (!sameItems(arrayValue(statement.Action), expected.actions)) {
    findings.push(
      `${expected.sid} actions must be ${JSON.stringify(expected.actions)}, got ${JSON.stringify(statement.Action)}.`
    );
  }
  expectEqual(statement.Resource, expected.resource, `${expected.sid} Resource`, findings);
}

function expectEqual(actual, expected, label, findings) {
  if (actual !== expected) {
    findings.push(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function parseTemplate(relativePath, overrides, findings) {
  try {
    return JSON.parse(getText(relativePath, overrides));
  } catch (error) {
    findings.push(`${relativePath} must parse as JSON: ${error.message}`);
    return null;
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return readText(relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [value];
}

function sameItems(left, right) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return JSON.stringify(sortedLeft) === JSON.stringify(sortedRight);
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAwsIamTemplates,
  templates,
};
