#!/usr/bin/env node

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const adminAuth = require("../src/admin-auth.cjs");
const admissionPolicy = require("../src/admission-policy.cjs");
const alertNotifier = require("../src/alert-notifier.cjs");
const appServer = require("../src/app-server.cjs");
const budgetAdmission = require("../src/budget-admission.cjs");
const budgetLedger = require("../src/budget-ledger.cjs");
const dataApi = require("../src/data-api.cjs");
const githubWebhook = require("../src/github-webhook.cjs");
const githubAppAuth = require("../src/github-app-auth.cjs");
const githubAppInstallationToken = require("../bin/github-app-installation-token.cjs");
const replayWebhook = require("../bin/replay-webhook.cjs");
const repositoryConfig = require("../src/repository-config.cjs");
const reviewJob = require("../src/review-job.cjs");
const reviewBot = require("../src/review-bot.cjs");
const scheduledSpendCheck = require("../src/scheduled-spend-check.cjs");
const spendAlerts = require("../src/spend-alerts.cjs");
const usageApi = require("../src/usage-api.cjs");
const usageApiLedger = require("../src/usage-api-ledger.cjs");
const usageLedger = require("../src/usage-ledger.cjs");
const workerAdapter = require("../src/worker-adapter.cjs");

const settings = withEnv(
  {
    GH_REPO: "6529-Collections/example",
    PR_NUMBER: "7",
    REVIEW_PROVIDER: "anthropic",
    REVIEW_USAGE_ENABLED: "false",
  },
  () => reviewBot.readSettings({}, "general")
);

assert.equal(settings.provider, "anthropic");
assert.equal(settings.model, "claude-opus-4-8");
assert.equal(settings.providerTimeoutMs, 120000);
assert.deepEqual(settings.trustedMarkerAuthors, ["6529bot[bot]", "github-actions[bot]"]);

withEnv(
  {
    GH_REPO: "6529-Collections/example",
    PR_NUMBER: "7",
    REVIEW_PROVIDER: "anthropic",
    REVIEW_MAX_OUTPUT_TOKENS: "999999",
  },
  () => {
    assert.throws(
      () => reviewBot.readSettings({}, "general"),
      /REVIEW_MAX_OUTPUT_TOKENS must be <= 32000/
    );
  }
);

const marker = reviewBot.commentMarker("general", settings, "abc123");
const comments = [
  {
    author: "human",
    body: `<!-- 6529-review-bot:{"marker":"${marker}","kind":"general","headSha":"bad"} -->`,
    createdAt: "1",
  },
  {
    author: "6529bot[bot]",
    body: `<!-- 6529-review-bot:{"marker":"${marker}","kind":"general","headSha":"abc1234"} -->`,
    createdAt: "2",
  },
];

assert.equal(reviewBot.countMarker(comments, marker, settings), 1);
assert.equal(reviewBot.extractReviewHistory(comments, settings).length, 1);
assert.equal(reviewBot.isTrustedMarkerAuthor("human", settings), false);
assert.equal(reviewBot.isTrustedMarkerAuthor("6529bot[bot]", settings), true);
assert.equal(reviewBot.isSafeRepositoryPath("components/example.tsx"), true);
assert.equal(reviewBot.isSafeRepositoryPath("../secret"), false);
assert.equal(reviewBot.isSafeRepositoryPath("/etc/passwd"), false);
assert.equal(reviewBot.isSafeRepositoryPath(".git/config"), false);
assert.equal(reviewBot.stripReviewBotMetadata('hello <!-- 6529-review-bot:{"x":1} --> world'), "hello  world");
assert.equal(reviewBot.truncate("abcdef", 0), "");
assert.equal(reviewBot.enforceInputLimit({ system: "system", user: "abcdef" }, 3).user, "");

assert.equal(usageLedger.quoteIdent("reviewbot"), '"reviewbot"');
assert.throws(() => usageLedger.quoteIdent("reviewbot;drop"), /Invalid SQL identifier/);
assert.equal(typeof usageLedger.awsCliBin(), "string");
assert.equal(typeof budgetLedger.awsCliBin(), "string");
assert.equal(
  dataApi.isRetriableDataApiError({ stderr: "DatabaseResumingException: please retry" }),
  true
);

assert.deepEqual(reviewBot.normalizeOpenAIUsage({
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
  input_tokens_details: { cached_tokens: 2 },
  output_tokens_details: { reasoning_tokens: 3 },
}), {
  inputTokens: 10,
  cachedInputTokens: 2,
  outputTokens: 5,
  reasoningTokens: 3,
  totalTokens: 15,
});

const webhookBody = Buffer.from(JSON.stringify({
  action: "opened",
  repository: {
    id: 1,
    full_name: "6529-Collections/example",
    private: false,
    default_branch: "main",
  },
  installation: { id: 99 },
  sender: { login: "maintainer" },
  pull_request: {
    number: 12,
    user: { login: "author" },
    head: {
      sha: "abc123",
      repo: { full_name: "6529-Collections/example" },
    },
    base: {
      sha: "def456",
      repo: { full_name: "6529-Collections/example" },
    },
    draft: false,
  },
}));
const webhookSecret = "test-secret";
const webhookSignature = githubWebhook.signGitHubWebhook(webhookSecret, webhookBody);
assert.equal(githubWebhook.verifyGitHubWebhookSignature(webhookSecret, webhookBody, webhookSignature), true);
assert.equal(githubWebhook.verifyGitHubWebhookSignature(webhookSecret, webhookBody, "sha256=bad"), false);
assert.throws(
  () => githubWebhook.assertGitHubWebhookSignature(webhookSecret, webhookBody, {}),
  /Invalid GitHub webhook signature/
);

const normalizedPullRequest = githubWebhook.normalizeGitHubWebhook(
  {
    "x-github-event": "pull_request",
    "x-github-delivery": "delivery-1",
  },
  JSON.parse(webhookBody.toString("utf8"))
);
assert.equal(normalizedPullRequest.kind, "pull_request");
assert.equal(normalizedPullRequest.shouldEnqueue, true);
assert.deepEqual(normalizedPullRequest.reviewKinds, ["general", "wcag", "i18n", "security"]);
assert.equal(
  repositoryConfig.repositoryConfigRefForEvent(normalizedPullRequest),
  "def456"
);
const githubAppKey = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const githubAppPrivateKey = githubAppKey.export({ type: "pkcs1", format: "pem" });
const githubAppSettings = githubAppAuth.githubAppAuthSettingsFromEnv({
  REVIEWBOT_GITHUB_APP_ID: "12345",
  REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS: "5000",
  REVIEWBOT_GITHUB_APP_PRIVATE_KEY: githubAppPrivateKey.replace(/\n/g, "\\n"),
});
assert.equal(githubAppAuth.isGitHubAppAuthConfigured(githubAppSettings), true);
assert.equal(githubAppSettings.fetchTimeoutMs, 5000);
assert.equal(githubAppAuth.createGitHubAppJwt(githubAppSettings).split(".").length, 3);
assert.deepEqual(
  githubAppInstallationToken.parseArgs([
    "--installation-id",
    "99",
    "--github-actions-output",
  ]),
  { githubActionsOutput: true, installationId: "99" }
);
assert.throws(
  () => githubAppInstallationToken.parseArgs(["--installation-id", "--github-actions-output"]),
  /requires a value/
);
const githubAppConfigText = Buffer.from("enabled: false\n").toString("base64");
const githubAppIntegration = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url, options = {}) => {
    const urlText = String(url);
    assert.equal(typeof options.signal?.aborted, "boolean");
    if (urlText.endsWith("/app/installations/99/access_tokens")) {
      assert.match(options.headers.authorization, /^Bearer /);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          token: "installation-token",
          expires_at: "2026-06-12T03:00:00.000Z",
        }),
      };
    }
    assert.equal(options.headers.authorization, "Bearer installation-token");
    if (urlText.includes("/collaborators/maintainer/permission")) {
      return { ok: true, status: 200, json: async () => ({ permission: "write" }) };
    }
    if (urlText.includes("/orgs/6529-Collections/members/maintainer")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }
    if (urlText.includes("/contents/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: "file",
          encoding: "base64",
          content: githubAppConfigText,
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  },
});
const githubActorContextPromise = githubAppIntegration.resolveActorContext(normalizedPullRequest);
const githubRepoConfigPromise = githubAppIntegration.loadRepositoryConfig(normalizedPullRequest, {
  policy: repositoryConfig.repositoryConfigPolicyFromEnv({
    REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
  }),
});
const githubMembershipFailurePromise = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url, options = {}) => {
    const urlText = String(url);
    assert.equal(typeof options.signal?.aborted, "boolean");
    if (urlText.endsWith("/app/installations/99/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "installation-token" }),
      };
    }
    if (urlText.includes("/collaborators/maintainer/permission")) {
      return { ok: true, status: 200, json: async () => ({ permission: "write" }) };
    }
    if (urlText.includes("/orgs/6529-Collections/members/maintainer")) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  },
}).resolveActorContext(normalizedPullRequest);
let disabledConfigRequestedToken = false;
const disabledGithubRepoConfigPromise = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url) => {
    if (String(url).endsWith("/app/installations/99/access_tokens")) {
      disabledConfigRequestedToken = true;
    }
    return { ok: false, status: 500, json: async () => ({}) };
  },
}).loadRepositoryConfig(normalizedPullRequest, {
  policy: repositoryConfig.repositoryConfigPolicyFromEnv({
    REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "none",
  }),
});

assert.deepEqual(githubWebhook.parseReviewCommand("/6529bot review security wcag").reviewKinds, [
  "security",
  "wcag",
]);
assert.deepEqual(githubWebhook.parseReviewCommand("@6529bot review all").reviewKinds, [
  "general",
  "wcag",
  "i18n",
  "security",
]);
assert.equal(githubWebhook.parseReviewCommand("looks good"), null);
assert.equal(replayWebhook.inferEventName(JSON.parse(webhookBody.toString("utf8"))), "pull_request");
assert.equal(replayWebhook.parsePayload(Buffer.from(`\uFEFF${webhookBody}`)).action, "opened");
assert.equal(replayWebhook.normalizePayloadBody(Buffer.from(`\uFEFF${webhookBody}`))[0], 123);
assert.deepEqual(
  replayWebhook.parseArgs([
    "--payload",
    "payload.json",
    "--actor-permission",
    "write",
    "--assume-empty-budget",
    "--estimated-cost-usd",
    "0.25",
  ]),
  {
    dispatch: false,
    assumeEmptyBudget: true,
    orgMember: false,
    payloadPath: "payload.json",
    actorPermission: "write",
    estimatedCostUsd: 0.25,
  }
);

const parsedRepoConfig = repositoryConfig.parseRepositoryConfigText(`
version: 1
enabled: true
reviewKinds:
  allowed: [general, security, followup]
  initial: [general, security]
  followup: [followup]
commands:
  enabled: true
lanes:
  - provider: anthropic
    model: claude-opus-4-8
  - openai:gpt-5.5
limits:
  maxJobsPerDelivery: 4
admission:
  publicRepoMode: trusted
  trustedUsers: [trusted-maintainer]
  denyUsers: [blocked-user]
budget:
  mode: enforce
  defaultEstimatedCostUsd: 2
  caps:
    repo:
      dailyUsd: 5
`, ".github/6529bot.yml");
assert.deepEqual(parsedRepoConfig.reviewKinds.initial, ["general", "security"]);
assert.equal(parsedRepoConfig.lanes.length, 2);
assert.equal(parsedRepoConfig.limits.maxJobsPerDelivery, 4);
assert.equal(parsedRepoConfig.budget.caps.repo.dailyBudgetUsd, 5);
assert.throws(
  () => repositoryConfig.parseRepositoryConfigText("unknownKey: true", ".github/6529bot.yml"),
  /unsupported key/
);
assert.throws(
  () =>
    repositoryConfig.repositoryConfigPolicyFromEnv({
      REVIEWBOT_REPOSITORY_CONFIG_PATHS: "../bad.yml",
    }),
  /Invalid repository config path/
);
const configuredPullRequest = repositoryConfig.applyRepositoryConfigToEvent(
  normalizedPullRequest,
  parsedRepoConfig
);
assert.deepEqual(configuredPullRequest.reviewKinds, ["general", "security"]);
const disabledPullRequest = repositoryConfig.applyRepositoryConfigToEvent(
  normalizedPullRequest,
  { ...parsedRepoConfig, enabled: false }
);
assert.equal(disabledPullRequest.shouldEnqueue, false);

const commentEvent = githubWebhook.normalizeGitHubWebhook(
  { "x-github-event": "issue_comment" },
  {
    action: "created",
    repository: { full_name: "6529-Collections/example" },
    sender: { login: "maintainer" },
    issue: {
      number: 12,
      pull_request: { url: "https://api.github.com/repos/6529-Collections/example/pulls/12" },
      user: { login: "author" },
    },
    comment: {
      id: 456,
      body: "/6529bot security",
      user: { login: "maintainer" },
    },
  }
);
assert.equal(commentEvent.kind, "comment_command");
assert.deepEqual(commentEvent.reviewKinds, ["security"]);

const twoLanePolicy = reviewJob.reviewJobPolicyFromEnv({
  REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8,openai:gpt-5.5,anthropic:claude-opus-4-8",
  REVIEWBOT_MAX_JOBS_PER_DELIVERY: "20",
});
assert.deepEqual(
  twoLanePolicy.lanes.map((lane) => `${lane.provider}:${lane.model}`),
  ["anthropic:claude-opus-4-8", "openai:gpt-5.5"]
);
const reviewJobs = reviewJob.createReviewJobs(
  normalizedPullRequest,
  {
    admission: { requestor: "maintainer" },
    createdAt: "2026-06-11T00:00:00.000Z",
  },
  twoLanePolicy
);
assert.equal(reviewJobs.length, 8);
assert.equal(reviewJobs.filter((job) => job.reviewKind === "general").length, 2);
assert.equal(reviewJobs[0].requestor, "maintainer");
assert.equal(reviewJobs[0].provider, "anthropic");
assert.equal(reviewJobs[1].provider, "openai");
const repoJobPolicy = repositoryConfig.mergeRepositoryJobPolicy(twoLanePolicy, parsedRepoConfig);
assert.equal(repoJobPolicy.maxJobsPerDelivery, 4);
assert.deepEqual(
  repoJobPolicy.lanes.map((lane) => `${lane.provider}:${lane.model}`),
  ["anthropic:claude-opus-4-8", "openai:gpt-5.5"]
);
const filteredJobPolicy = repositoryConfig.mergeRepositoryJobPolicy(twoLanePolicy, {
  ...parsedRepoConfig,
  lanes: reviewJob.parseReviewLanes("openrouter:anthropic/claude-sonnet-4"),
});
assert.equal(filteredJobPolicy.lanes.length, 0);
const replayedReviewJobs = reviewJob.createReviewJobs(normalizedPullRequest, {
  admission: { requestor: "maintainer" },
  createdAt: "2027-01-01T00:00:00.000Z",
}, twoLanePolicy);
assert.equal(reviewJobs[0].id, replayedReviewJobs[0].id);
const firstJobEvent = reviewJob.eventForReviewJob(normalizedPullRequest, reviewJobs[0]);
assert.deepEqual(firstJobEvent.reviewKinds, [reviewJobs[0].reviewKind]);
assert.equal(firstJobEvent.run.provider, reviewJobs[0].provider);
assert.equal(firstJobEvent.run.model, reviewJobs[0].model);
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).GH_REPO, "6529-Collections/example");
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).REVIEW_KIND, "general");
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).REVIEWBOT_GITHUB_INSTALLATION_ID, "99");
assert.match(workerAdapter.reviewCommandArgs(reviewJobs[0])[0], /general-pr-review\.cjs$/);
const localWorkerResult = workerAdapter.runReviewJobLocally(reviewJobs[0], {
  policy: workerAdapter.workerAdapterPolicyFromEnv({
    REVIEWBOT_WORKER_ADAPTER: "local",
  }),
  includeOutput: true,
  localCommandArgs: [
    "-e",
    "process.stdout.write(`${process.env.REVIEW_KIND}:${process.env.GH_REPO}`)",
  ],
});
assert.equal(localWorkerResult.accepted, true);
assert.equal(localWorkerResult.stdout, "general:6529-Collections/example");
let dispatchedWorkflow = null;
const forkReviewJob = { ...reviewJobs[0], headRepoFullName: "external/fork" };
const dispatchResult = workerAdapter.dispatchReviewJobToGitHubActions(forkReviewJob, {
  policy: {
    mode: "github_actions",
    githubRepo: "6529-Collections/6529reviewbot",
    githubWorkflow: "review-job.yml",
    githubRef: "main",
    ghBin: "gh",
    localTimeoutMs: 1234,
  },
  spawnSync: (bin, args, options) => {
    dispatchedWorkflow = { bin, args, options };
    return { status: 0, stdout: "queued", stderr: "" };
  },
});
assert.equal(dispatchResult.accepted, true);
assert.equal(dispatchedWorkflow.bin, "gh");
assert.equal(dispatchedWorkflow.options.timeout, 1234);
assert.deepEqual(
  workerAdapter.githubWorkflowFields(forkReviewJob).target_repo,
  "6529-Collections/example"
);
assert.deepEqual(workerAdapter.githubWorkflowFields(forkReviewJob).head_repo, "external/fork");
assert.equal(workerAdapter.githubWorkflowFields(forkReviewJob).installation_id, "99");
assert.equal(dispatchedWorkflow.args.includes("workflow"), true);
assert.equal(dispatchedWorkflow.args.includes("target_repo=6529-Collections/example"), true);
assert.equal(dispatchedWorkflow.args.includes("installation_id=99"), true);
assert.equal(dispatchedWorkflow.args.includes("head_repo=external/fork"), true);
let missingInstallationDispatchCalled = false;
const missingInstallationResult = workerAdapter.dispatchReviewJobToGitHubActions(
  { ...forkReviewJob, installationId: null },
  {
    policy: {
      mode: "github_actions",
      githubRepo: "6529-Collections/6529reviewbot",
      githubWorkflow: "review-job.yml",
      githubRef: "main",
      ghBin: "gh",
      localTimeoutMs: 1234,
    },
    spawnSync: () => {
      missingInstallationDispatchCalled = true;
      return { status: 0, stdout: "queued", stderr: "" };
    },
  }
);
assert.equal(missingInstallationResult.accepted, false);
assert.match(missingInstallationResult.reason, /installationId is required/);
assert.equal(missingInstallationDispatchCalled, false);
const noopQueuePromise = workerAdapter.enqueueReviewJobsWithAdapter([reviewJobs[0]], {}, {
  policy: { mode: "noop" },
});
assert.equal(
  reviewJob.publicReviewJobSummary({
    ...reviewJobs[0],
    status: "admitted",
    budget: { status: "allowed", allowed: true, code: "within_budget", estimatedCostUsd: 1 },
  }).budget.code,
  "within_budget"
);
assert.equal(
  reviewJob.budgetSummaryForJobs([
    { budget: { status: "allowed", allowed: true, code: "within_budget" } },
    { budget: { status: "denied", allowed: false, code: "budget_exceeded" } },
  ]).status,
  "partial"
);
assert.throws(
  () => reviewJob.createReviewJobs(normalizedPullRequest, {}, {
    ...twoLanePolicy,
    maxJobsPerDelivery: 2,
  }),
  /above REVIEWBOT_MAX_JOBS_PER_DELIVERY=2/
);

const usageEvents = [
  {
    createdAt: "2026-06-10T01:00:00.000Z",
    repoFullName: "6529-Collections/public-repo",
    prNumber: 10,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    totalTokens: 1000,
    actualCostUsd: 1.25,
  },
  {
    createdAt: "2026-06-10T02:00:00.000Z",
    repoFullName: "6529-Collections/private-repo",
    repoPrivate: true,
    prNumber: 11,
    metadata: { requestor: "admin" },
    reviewKind: "security",
    provider: "openai",
    model: "gpt-5.5",
    inputTokens: 500,
    outputTokens: 250,
    estimatedCostUsd: 0.75,
    budgetSkipped: true,
  },
];
const publicUsageSummary = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "public",
  range: { days: 7 },
});
assert.equal(publicUsageSummary.totals.reviewRuns, 2);
assert.equal(publicUsageSummary.totals.costUsd, 2);
assert.equal(publicUsageSummary.byRepo.some((item) => item.key === "private"), true);
assert.equal(Object.prototype.hasOwnProperty.call(publicUsageSummary, "byRequestor"), false);
const adminUsageSummary = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "admin",
  range: { days: 7 },
});
assert.equal(adminUsageSummary.byRequestor.some((item) => item.key === "admin"), true);
assert.equal(usageApi.publicBudgetPolicy({ scope_type: "repo", scope_value: "x", daily_budget_usd: "2" }).dailyBudgetUsd, 2);
const alertNow = new Date("2026-06-12T12:00:00.000Z");
const alertEvents = [
  {
    createdAt: "2026-06-12T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 12,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 9,
  },
  {
    createdAt: "2026-06-11T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 11,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 1,
  },
  {
    createdAt: "2026-06-10T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 10,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 1,
  },
];
const alertPolicy = spendAlerts.spendAlertPolicyFromEnv({
  REVIEWBOT_ALERTS_ENABLED: "true",
  REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT: "80",
  REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT: "100",
  REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS: "24",
  REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS: "2",
  REVIEWBOT_ALERTS_SPIKE_MULTIPLIER: "3",
  REVIEWBOT_ALERTS_SPIKE_MIN_USD: "5",
  REVIEWBOT_ALERTS_MAX_ALERTS: "10",
});
assert.throws(
  () =>
    spendAlerts.spendAlertPolicyFromEnv({
      REVIEWBOT_ALERTS_SPIKE_DIMENSIONS: "global,bad_dimension",
    }),
  /unsupported values/
);
const generatedAlerts = spendAlerts.evaluateSpendAlerts({
  events: alertEvents,
  budgetPolicies: [
    {
      scopeType: "repo",
      scopeValue: "6529-Collections/example",
      dailyBudgetUsd: 10,
      enabled: true,
    },
  ],
  now: alertNow,
  policy: alertPolicy,
});
assert.equal(
  generatedAlerts.some((alert) => alert.kind === "budget_utilization" && alert.severity === "warning"),
  true
);
assert.equal(
  generatedAlerts.some((alert) => alert.kind === "spend_spike" && alert.scopeType === "repo"),
  true
);

const publicPolicy = admissionPolicy.admissionPolicyFromEnv({});
const mergedAdmissionPolicy = repositoryConfig.mergeRepositoryAdmissionPolicy(
  admissionPolicy.admissionPolicyFromEnv({
    REVIEWBOT_PUBLIC_REPO_MODE: "open",
    REVIEWBOT_TRUSTED_PERMISSION: "read",
  }),
  parsedRepoConfig
);
assert.equal(mergedAdmissionPolicy.publicRepoMode, "trusted");
assert.equal(mergedAdmissionPolicy.trustedPermission, "read");
assert.equal(mergedAdmissionPolicy.trustedUsers.has("trusted-maintainer"), true);
assert.equal(mergedAdmissionPolicy.denyUsers.has("blocked-user"), true);
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "author", permission: "read" }, publicPolicy).status,
  "denied"
);
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "maintainer", permission: "write" }, publicPolicy).status,
  "allowed"
);
assert.equal(
  admissionPolicy.evaluateAdmission(commentEvent, { login: "maintainer", permission: "maintain" }, publicPolicy).requestor,
  "maintainer"
);
const privateEvent = {
  ...normalizedPullRequest,
  repository: { ...normalizedPullRequest.repository, private: true },
};
assert.equal(
  admissionPolicy.evaluateAdmission(privateEvent, { login: "external", permission: "none" }, publicPolicy).status,
  "allowed"
);
const draftEvent = { ...normalizedPullRequest, draft: true };
assert.equal(
  admissionPolicy.evaluateAdmission(draftEvent, { login: "maintainer", permission: "admin" }, publicPolicy).code,
  "draft_pull_request"
);
const denyPolicy = admissionPolicy.admissionPolicyFromEnv({
  REVIEWBOT_DENY_USERS: "maintainer",
});
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "maintainer", permission: "admin" }, denyPolicy).code,
  "blocked_actor"
);
assert.equal(
  admissionPolicy.evaluateAdmission(draftEvent, { login: "maintainer", permission: "admin" }, denyPolicy).code,
  "blocked_actor"
);
assert.throws(
  () => admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_TRUSTED_PERMISSION: "owner" }),
  /REVIEWBOT_TRUSTED_PERMISSION must be one of/
);

const budgetSubject = budgetAdmission.budgetSubjectFromEvent(
  normalizedPullRequest,
  { requestor: "maintainer" },
  { provider: "anthropic", model: "claude-opus-4-8" }
);
assert.equal(budgetSubject.repo, "6529-Collections/example");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: { unavailable: true },
  policy: budgetAdmission.budgetPolicyFromEnv({}),
}).status, "allowed");
const cappedPolicy = budgetAdmission.budgetPolicyFromEnv({
  REVIEWBOT_BUDGET_GLOBAL_DAILY_USD: "2",
});
const mergedBudgetPolicy = repositoryConfig.mergeRepositoryBudgetPolicy(cappedPolicy, parsedRepoConfig);
assert.equal(mergedBudgetPolicy.mode, "enforce");
assert.equal(mergedBudgetPolicy.defaultEstimatedCostUsd, 2);
assert.equal(mergedBudgetPolicy.caps.global.dailyBudgetUsd, 2);
assert.equal(mergedBudgetPolicy.caps.repo.dailyBudgetUsd, 5);
const reviewKindPolicy = budgetAdmission.budgetPolicyFromEnv({
  REVIEWBOT_BUDGET_REVIEW_KIND_DAILY_USD: "1",
});
assert.deepEqual(
  budgetAdmission
    .budgetPoliciesForSubject(budgetSubject, reviewKindPolicy)
    .map((item) => `${item.scopeType}:${item.scopeValue}`),
  ["review_kind:general", "review_kind:wcag", "review_kind:i18n", "review_kind:security"]
);
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: { unavailable: true, reason: "ledger offline" },
  policy: cappedPolicy,
}).code, "budget_snapshot_unavailable");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: {
    unavailable: false,
    totals: {
      "global:*": { dailyUsd: 1.5, weeklyUsd: 1.5, monthlyUsd: 1.5 },
    },
  },
  policy: cappedPolicy,
  estimate: { estimatedCostUsd: 1 },
}).code, "budget_exceeded");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: {
    unavailable: false,
    totals: {
      "global:*": { dailyUsd: 1.5, weeklyUsd: 1.5, monthlyUsd: 1.5 },
    },
  },
  policy: budgetAdmission.budgetPolicyFromEnv({
    REVIEWBOT_BUDGET_MODE: "warn",
    REVIEWBOT_BUDGET_GLOBAL_DAILY_USD: "2",
  }),
  estimate: { estimatedCostUsd: 1 },
}).status, "warning");
const spendQuery = budgetLedger.buildScopeSpendQuery("reviewbot", "requestor", "maintainer");
assert.match(spendQuery.sql, /metadata->>'requestor'/);
assert.equal(spendQuery.parameters[0].value.stringValue, "maintainer");
const usageEventsQuery = usageApiLedger.buildUsageEventsQuery("reviewbot", {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-11T00:00:00.000Z",
}, 25);
assert.match(usageEventsQuery.sql, /ai_review_usage_events/);
assert.match(usageEventsQuery.sql, /created_at >= cast\(:from_ts as timestamptz\)/);
assert.equal(usageEventsQuery.parameters[2].value.longValue, 25);
assert.throws(() => usageApiLedger.buildUsageEventsQuery("reviewbot", {}, 25), /bounded range/);
const usageApiLedgerRecord = [
  { stringValue: "2026-06-10 01:00:00+00" },
  { stringValue: "6529-Collections/public-repo" },
  { longValue: 10 },
  { stringValue: "author" },
  { stringValue: "head" },
  { stringValue: "run" },
  { stringValue: "job" },
  { stringValue: "general" },
  { stringValue: "anthropic" },
  { stringValue: "claude-opus-4-8" },
  { stringValue: "anthropic:claude-opus-4-8" },
  { longValue: 100 },
  { longValue: 25 },
  { longValue: 50 },
  { longValue: 0 },
  { longValue: 150 },
  { stringValue: "0.10" },
  { isNull: true },
  { stringValue: "USD" },
  { booleanValue: false },
  { stringValue: "{\"requestor\":\"maintainer\"}" },
];
const publicLedgerEvent = usageApiLedger.usageRecordToEvent(usageApiLedgerRecord, {
  visibility: "public",
  apiSettings: usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_PUBLIC_ORGS: "6529-Collections",
  }),
});
assert.equal(publicLedgerEvent.repoPrivate, false);
assert.equal(publicLedgerEvent.metadata.requestor, "maintainer");
const privateByDefaultLedgerEvent = usageApiLedger.usageRecordToEvent(usageApiLedgerRecord, {
  visibility: "public",
  apiSettings: usageApi.usageApiSettingsFromEnv({}),
});
assert.equal(privateByDefaultLedgerEvent.repoPrivate, true);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/usage/summary"),
  headers: {},
}).code, "admin_auth_disabled");
const sharedSecretAuth = adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/usage/summary"),
  headers: {
    "x-6529-reviewbot-admin-secret": "secret",
  },
}, adminAuth.adminAuthSettingsFromEnv({
  REVIEWBOT_ADMIN_AUTH_MODE: "shared_secret",
  REVIEWBOT_ADMIN_AUTH_SHARED_SECRET: "secret",
}));
assert.equal(sharedSecretAuth.allowed, true);
const hmacAuthSettings = adminAuth.adminAuthSettingsFromEnv({
  REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
  REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "hmac-secret",
  REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin",
  REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS: "300",
});
const adminUsageUrl = new URL("http://localhost/api/admin/usage/summary?days=7");
const signedAdminHeaders = signedAdminHeadersFor(adminUsageUrl);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeaders,
}, hmacAuthSettings).allowed, true);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, { roles: ["viewer"] }),
}, hmacAuthSettings).code, "admin_auth_missing_role");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/budget/policies"),
  headers: signedAdminHeaders,
}, hmacAuthSettings).code, "admin_auth_invalid_signature");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, {
    expiresAt: String(Math.floor(Date.now() / 1000) - 1),
  }),
}, hmacAuthSettings).code, "admin_auth_expired");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, {
    expiresAt: String(Math.floor(Date.now() / 1000) + 9999),
  }),
}, hmacAuthSettings).code, "admin_auth_ttl_too_long");
assert.equal(appServer.normalizeConfigLoadResult(null).status, "invalid");
assert.equal(
  repositoryConfig.repositoryConfigBlocksWork(
    { status: "not_configured" },
    { required: true }
  ),
  true
);

const fakeConfigText = Buffer.from("enabled: false\n").toString("base64");
const loadedRepoConfigPromise = repositoryConfig.loadRepositoryConfigFromGitHub(
  normalizedPullRequest,
  {
    policy: repositoryConfig.repositoryConfigPolicyFromEnv({
      REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
    }),
    fetchImpl: async (url) => {
      assert.match(String(url), /ref=def456/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: "file",
          encoding: "base64",
          content: fakeConfigText,
        }),
      };
    },
  }
);

let enqueuedJobs = null;
appServer.handleGitHubWebhook({
  headers: {
    "x-hub-signature-256": webhookSignature,
    "x-github-event": "pull_request",
    "x-github-delivery": "delivery-1",
  },
  rawBody: webhookBody,
  settings: {
    webhookSecret,
    webhookPath: "/webhooks/github",
    maxBodyBytes: 2048,
  },
  enqueueReviewJobs: async (jobs) => {
    enqueuedJobs = jobs;
    return { accepted: true, jobId: "job-1" };
  },
  resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
  loadRepositoryConfig: async () => ({
    status: "loaded",
    source: "test",
    config: parsedRepoConfig,
  }),
  resolveBudgetSnapshot: async () => ({ unavailable: false, totals: {} }),
  jobPolicy: twoLanePolicy,
}).then(async (webhookResult) => {
  const githubActorContext = await githubActorContextPromise;
  assert.equal(githubActorContext.login, "maintainer");
  assert.equal(githubActorContext.permission, "write");
  assert.equal(githubActorContext.isOrgMember, true);
  const githubMembershipFailureContext = await githubMembershipFailurePromise;
  assert.equal(githubMembershipFailureContext.permission, "write");
  assert.equal(githubMembershipFailureContext.isOrgMember, false);
  assert.deepEqual(githubMembershipFailureContext.organizations, []);
  const githubRepoConfig = await githubRepoConfigPromise;
  assert.equal(githubRepoConfig.status, "loaded");
  assert.equal(githubRepoConfig.config.enabled, false);
  const disabledGithubRepoConfig = await disabledGithubRepoConfigPromise;
  assert.equal(disabledGithubRepoConfig.status, "not_configured");
  assert.equal(disabledConfigRequestedToken, false);
  const loadedRepoConfig = await loadedRepoConfigPromise;
  assert.equal(loadedRepoConfig.status, "loaded");
  assert.equal(loadedRepoConfig.config.enabled, false);
  const noopQueue = await noopQueuePromise;
  assert.equal(noopQueue.accepted, false);
  assert.equal(noopQueue.reason, "No worker adapter configured.");

  const usageApiSettings = usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_DEFAULT_DAYS: "7",
    REVIEWBOT_USAGE_API_MAX_DAYS: "30",
  });
  const usageRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/public/usage/summary?days=7",
    headers: {},
  }, {
    usageApiSettings,
    loadUsageEvents: async ({ range, visibility }) => {
      assert.equal(range.days, 7);
      assert.equal(visibility, "public");
      return { events: usageEvents };
    },
  });
  assert.equal(usageRouteResult.statusCode, 200);
  assert.equal(usageRouteResult.body.visibility, "public");
  const adminDenied = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/usage/summary"),
    headers: {},
  }, {
    settings: usageApiSettings,
    loadUsageEvents: async () => ({ events: usageEvents }),
  });
  assert.equal(adminDenied.statusCode, 403);
  const adminAllowed = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/budget/policies"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
    loadBudgetPolicies: async () => ({
      policies: [{ scopeType: "global", scopeValue: "*", dailyBudgetUsd: 5, enabled: true }],
    }),
  });
  assert.equal(adminAllowed.statusCode, 200);
  assert.equal(adminAllowed.body.policies[0].scopeType, "global");
  const adminBridgeAllowed = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminUsageUrl,
    headers: signedAdminHeadersFor(adminUsageUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadUsageEvents: async () => ({ events: usageEvents }),
  });
  assert.equal(adminBridgeAllowed.statusCode, 200);
  assert.equal(adminBridgeAllowed.body.visibility, "admin");
  let alertOutput = "";
  const stdoutNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "stdout",
    }),
    now: alertNow,
    write: (text) => {
      alertOutput += text;
    },
  });
  assert.equal(stdoutNotification.delivered, true);
  assert.match(alertOutput, /6529reviewbot/);
  let snsPublishOptions = null;
  const snsNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "sns",
      REVIEWBOT_ALERTS_SNS_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:reviewbot-alerts",
      REVIEWBOT_ALERTS_SNS_TIMEOUT_MS: "1234",
    }),
    now: alertNow,
    execFileSync: (bin, args, options) => {
      assert.equal(bin, "aws");
      assert.equal(args.includes("publish"), true);
      snsPublishOptions = options;
      return "{}";
    },
  });
  assert.equal(snsNotification.delivered, true);
  assert.equal(snsPublishOptions.timeout, 1234);
  const bestEffortNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "webhook",
      REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED: "false",
    }),
  });
  assert.equal(bestEffortNotification.ok, true);
  assert.equal(bestEffortNotification.delivered, false);
  const scheduledAlertResult = await scheduledSpendCheck.runScheduledSpendCheck({
    dryRun: true,
    now: alertNow,
    events: alertEvents,
    budgetPolicies: [
      {
        scopeType: "repo",
        scopeValue: "6529-Collections/example",
        dailyBudgetUsd: 10,
        enabled: true,
      },
    ],
    settings: {
      alertPolicy,
      notifierSettings: alertNotifier.alertNotifierSettingsFromEnv({
        REVIEWBOT_ALERTS_NOTIFY_MODE: "none",
      }),
      ledgerSettings: {},
      apiSettings: usageApiSettings,
      lookbackDays: 35,
    },
  });
  assert.equal(scheduledAlertResult.alertCount, generatedAlerts.length);
  assert.equal(scheduledAlertResult.notification.mode, "dry_run");
  try {
    usageApi.usageRangeFromRequest(
      { url: new URL("http://localhost/api/public/usage/summary?days=bad") },
      usageApiSettings,
      new Date("2026-06-11T00:00:00.000Z")
    );
    assert.fail("expected invalid days query to throw");
  } catch (error) {
    assert.equal(error.statusCode, 400);
  }
  assert.equal(webhookResult.statusCode, 202);
  assert.equal(webhookResult.body.enqueued, true);
  assert.equal(enqueuedJobs.length, 4);
  assert.equal(enqueuedJobs[0].prNumber, 12);
  assert.equal(webhookResult.body.jobs.length, 4);
  assert.deepEqual(
    webhookResult.body.jobs.map((job) => `${job.reviewKind}:${job.provider}`),
    ["general:anthropic", "general:openai", "security:anthropic", "security:openai"]
  );
  assert.equal(webhookResult.body.configuration.status, "loaded");
  const defaultQueueResult = await appServer.handleGitHubWebhook({
    headers: {
      "x-hub-signature-256": webhookSignature,
      "x-github-event": "pull_request",
      "x-github-delivery": "delivery-1",
    },
    rawBody: webhookBody,
    settings: {
      webhookSecret,
      webhookPath: "/webhooks/github",
      maxBodyBytes: 2048,
    },
    resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
  });
  assert.equal(defaultQueueResult.statusCode, 200);
  assert.equal(defaultQueueResult.body.enqueued, false);
  assert.equal(defaultQueueResult.body.jobs.length, 4);
  assert.equal(defaultQueueResult.body.queue.jobCount, 4);
  const replayResult = await replayWebhook.replayWebhook({
    payloadPath: "-",
    eventName: "pull_request",
    deliveryId: "replay-test",
    webhookSecret,
    actorPermission: "write",
    repositoryConfigPath: "templates/dogfood-repository-config.yml",
    assumeEmptyBudget: true,
    estimatedCostUsd: 0.25,
    readStdin: () => webhookBody,
  });
  assert.equal(replayResult.statusCode, 200);
  assert.equal(replayResult.replay.dryRun, true);
  assert.equal(replayResult.body.enqueued, false);
  assert.equal(replayResult.body.jobs.length, 2);
  assert.equal(replayResult.body.queue.adapter, "dry_run");
  let budgetDeniedQueued = false;
  const budgetDeniedResult = await appServer.handleGitHubWebhook({
    headers: {
      "x-hub-signature-256": webhookSignature,
      "x-github-event": "pull_request",
      "x-github-delivery": "delivery-1",
    },
    rawBody: webhookBody,
    settings: {
      webhookSecret,
      webhookPath: "/webhooks/github",
      maxBodyBytes: 2048,
    },
    resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
    budgetPolicy: cappedPolicy,
    resolveBudgetSnapshot: async () => ({
      unavailable: false,
      totals: {
        "global:*": { dailyUsd: 2, weeklyUsd: 2, monthlyUsd: 2 },
      },
    }),
    estimateBudgetCost: async () => ({ estimatedCostUsd: 1 }),
    enqueueReviewJobs: async () => {
      budgetDeniedQueued = true;
      return { accepted: true };
    },
  });
  assert.equal(budgetDeniedResult.body.budget.code, "budget_exceeded");
  assert.equal(budgetDeniedResult.body.enqueued, false);
  assert.equal(budgetDeniedResult.body.deniedJobs.length, 4);
  assert.equal(budgetDeniedQueued, false);
  console.log("smoke tests ok");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function signedAdminHeadersFor(url, options = {}) {
  const roles = options.roles || ["reviewbot-admin", "admin"];
  const expiresAt =
    options.expiresAt || String(Math.floor(Date.now() / 1000) + 120);
  const signature = adminAuth.signAdminAuthRequest({
    method: options.method || "GET",
    url,
    actor: options.actor || "operator",
    roles,
    expiresAt,
  }, hmacAuthSettings);
  return {
    "x-6529-admin-user": options.actor || "operator",
    "x-6529-admin-roles": roles.join(","),
    "x-6529-admin-expires-at": expiresAt,
    "x-6529-admin-signature": `sha256=${signature}`,
  };
}

function withEnv(nextEnv, fn) {
  const oldEnv = process.env;
  process.env = { ...oldEnv, ...nextEnv };
  try {
    return fn();
  } finally {
    process.env = oldEnv;
  }
}
