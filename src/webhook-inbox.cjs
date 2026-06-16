"use strict";

const { executeStatement, fieldValue, stringParam, longParam } = require("./data-api.cjs");
const { safeErrorLine } = require("./diagnostics.cjs");
const { quoteIdent, usageLedgerSettingsFromEnv } = require("./usage-ledger.cjs");

const RETRYABLE_STATUSES = ["received", "retry_pending", "processing"];
const DEFAULT_RETRY_DELAY_SECONDS = 90;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_POLL_INTERVAL_MS = 15000;
const DEFAULT_BATCH_SIZE = 2;

function webhookInboxSettingsFromEnv(env = process.env) {
  const usageSettings = usageLedgerSettingsFromEnv(env);
  return {
    enabled: parseBool(env.REVIEWBOT_WEBHOOK_INBOX_ENABLED || "false"),
    failClosed: parseBool(env.REVIEWBOT_WEBHOOK_INBOX_FAIL_CLOSED || "false"),
    region: env.REVIEWBOT_WEBHOOK_INBOX_AWS_REGION || usageSettings.region,
    resourceArn: env.REVIEWBOT_WEBHOOK_INBOX_DB_RESOURCE_ARN || usageSettings.resourceArn,
    secretArn: env.REVIEWBOT_WEBHOOK_INBOX_DB_SECRET_ARN || usageSettings.secretArn,
    database: env.REVIEWBOT_WEBHOOK_INBOX_DB_NAME || usageSettings.database,
    schema: env.REVIEWBOT_WEBHOOK_INBOX_DB_SCHEMA || usageSettings.schema,
    retryDelaySeconds: positiveInt(
      env.REVIEWBOT_WEBHOOK_INBOX_RETRY_DELAY_SECONDS,
      DEFAULT_RETRY_DELAY_SECONDS,
      "REVIEWBOT_WEBHOOK_INBOX_RETRY_DELAY_SECONDS"
    ),
    maxAttempts: positiveInt(
      env.REVIEWBOT_WEBHOOK_INBOX_MAX_ATTEMPTS,
      DEFAULT_MAX_ATTEMPTS,
      "REVIEWBOT_WEBHOOK_INBOX_MAX_ATTEMPTS"
    ),
    pollIntervalMs: positiveInt(
      env.REVIEWBOT_WEBHOOK_INBOX_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
      "REVIEWBOT_WEBHOOK_INBOX_POLL_INTERVAL_MS"
    ),
    batchSize: positiveInt(
      env.REVIEWBOT_WEBHOOK_INBOX_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      "REVIEWBOT_WEBHOOK_INBOX_BATCH_SIZE"
    ),
  };
}

function createWebhookInbox(settings = webhookInboxSettingsFromEnv(), options = {}) {
  const execute = options.executeStatement || executeStatement;
  const log = options.log || console.warn;

  function safeWrite(fn, fallback) {
    if (!settings.enabled) {
      return { skipped: true };
    }
    try {
      assertWebhookInboxConfigured(settings);
      return fn();
    } catch (error) {
      if (settings.failClosed) {
        throw error;
      }
      log(`webhook inbox write failed: ${safeError(error)}`);
      return { skipped: false, error, ...fallback };
    }
  }

  return {
    settings,
    recordReceived(event) {
      return safeWrite(
        () => execute(settings, ...queryArgs(buildReceivedUpsert(settings.schema, event, settings.retryDelaySeconds)), {
          tempPrefix: "6529-webhook-inbox-received-",
          maxBuffer: 16 * 1024 * 1024,
        }),
        {}
      );
    },
    markProcessed(deliveryId, result = {}) {
      return safeWrite(
        () => execute(settings, ...queryArgs(buildStatusUpdate(settings.schema, deliveryId, {
          status: "processed",
          reason: result.reason || "",
          lastError: "",
          nextAttemptAt: null,
        })), { tempPrefix: "6529-webhook-inbox-processed-" }),
        {}
      );
    },
    markIgnored(deliveryId, reason = "") {
      return safeWrite(
        () => execute(settings, ...queryArgs(buildStatusUpdate(settings.schema, deliveryId, {
          status: "ignored",
          reason,
          lastError: "",
          nextAttemptAt: null,
        })), { tempPrefix: "6529-webhook-inbox-ignored-" }),
        {}
      );
    },
    markRetryPending(deliveryId, reason = "", options = {}) {
      const retryDelaySeconds = options.retryDelaySeconds || settings.retryDelaySeconds;
      return safeWrite(
        () => execute(settings, ...queryArgs(buildStatusUpdate(settings.schema, deliveryId, {
          status: "retry_pending",
          reason,
          lastError: reason,
          nextAttemptAt: `now() + make_interval(secs => ${Number(retryDelaySeconds)})`,
        })), { tempPrefix: "6529-webhook-inbox-retry-" }),
        {}
      );
    },
    markFailed(deliveryId, reason = "") {
      return safeWrite(
        () => execute(settings, ...queryArgs(buildStatusUpdate(settings.schema, deliveryId, {
          status: "failed",
          reason,
          lastError: reason,
          nextAttemptAt: null,
        })), { tempPrefix: "6529-webhook-inbox-failed-" }),
        {}
      );
    },
    claimDue(limit = settings.batchSize) {
      if (!settings.enabled) {
        return [];
      }
      try {
        assertWebhookInboxConfigured(settings);
        const response = execute(settings, ...queryArgs(buildClaimDue(settings.schema, limit, settings.maxAttempts)), {
          tempPrefix: "6529-webhook-inbox-claim-",
          maxBuffer: 16 * 1024 * 1024,
        });
        return (response.records || []).map(recordToDelivery);
      } catch (error) {
        if (settings.failClosed) {
          throw error;
        }
        log(`webhook inbox claim failed: ${safeError(error)}`);
        return [];
      }
    },
  };
}

function buildReceivedUpsert(schema, event = {}, retryDelaySeconds = DEFAULT_RETRY_DELAY_SECONDS) {
  const deliveryId = requiredDeliveryId(event);
  const normalized = normalizeInboxEvent(event);
  return {
    sql: `
insert into ${quoteIdent(schema)}.ai_review_webhook_inbox (
  delivery_id,
  event_name,
  event_kind,
  repository_full_name,
  pr_number,
  comment_id,
  actor,
  installation_id,
  status,
  next_attempt_at,
  normalized_event,
  reason
) values (
  :delivery_id,
  :event_name,
  :event_kind,
  :repository_full_name,
  :pr_number,
  :comment_id,
  :actor,
  :installation_id,
  'received',
  now() + make_interval(secs => ${Number(retryDelaySeconds)}),
  cast(:normalized_event as jsonb),
  :reason
)
on conflict (delivery_id) do update set
  updated_at = now(),
  event_name = excluded.event_name,
  event_kind = excluded.event_kind,
  repository_full_name = excluded.repository_full_name,
  pr_number = excluded.pr_number,
  comment_id = excluded.comment_id,
  actor = excluded.actor,
  installation_id = excluded.installation_id,
  normalized_event = excluded.normalized_event,
  reason = excluded.reason,
  next_attempt_at = case
    when ${quoteIdent(schema)}.ai_review_webhook_inbox.status in ('processed', 'ignored')
      then ${quoteIdent(schema)}.ai_review_webhook_inbox.next_attempt_at
    else excluded.next_attempt_at
  end,
  status = case
    when ${quoteIdent(schema)}.ai_review_webhook_inbox.status in ('processed', 'ignored')
      then ${quoteIdent(schema)}.ai_review_webhook_inbox.status
    else 'received'
  end
`,
    parameters: [
      stringParam("delivery_id", deliveryId),
      stringOrNullParam("event_name", event.eventName),
      stringOrNullParam("event_kind", event.kind),
      stringOrNullParam("repository_full_name", event.repository?.fullName),
      longOrNullParam("pr_number", event.prNumber),
      longOrNullParam("comment_id", event.commentId),
      stringOrNullParam("actor", event.actor),
      longOrNullParam("installation_id", event.installationId),
      stringParam("normalized_event", JSON.stringify(normalized)),
      stringOrNullParam("reason", event.reason),
    ],
  };
}

function buildStatusUpdate(schema, deliveryId, update = {}) {
  const nextAttemptSql = update.nextAttemptAt
    ? update.nextAttemptAt
    : update.nextAttemptAt === null
      ? "null"
      : "next_attempt_at";
  return {
    sql: `
update ${quoteIdent(schema)}.ai_review_webhook_inbox
set
  status = :status,
  updated_at = now(),
  processed_at = case when :terminal_status then coalesce(processed_at, now()) else processed_at end,
  next_attempt_at = ${nextAttemptSql},
  reason = :reason,
  last_error = :last_error
where delivery_id = :delivery_id
`,
    parameters: [
      stringParam("delivery_id", deliveryId),
      stringParam("status", update.status),
      boolParam("terminal_status", ["processed", "ignored", "failed"].includes(update.status)),
      stringOrNullParam("reason", update.reason),
      stringOrNullParam("last_error", update.lastError),
    ],
  };
}

function buildClaimDue(schema, limit, maxAttempts) {
  return {
    sql: `
with candidate as (
  select delivery_id
  from ${quoteIdent(schema)}.ai_review_webhook_inbox
  where status in (${RETRYABLE_STATUSES.map((_, index) => `:status_${index}`).join(", ")})
    and attempt_count < :max_attempts
    and (next_attempt_at is null or next_attempt_at <= now())
  order by updated_at asc, created_at asc
  limit :limit
),
updated as (
  update ${quoteIdent(schema)}.ai_review_webhook_inbox inbox
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    updated_at = now(),
    next_attempt_at = now() + make_interval(secs => 60)
  from candidate
  where inbox.delivery_id = candidate.delivery_id
  returning
    inbox.delivery_id,
    inbox.event_name,
    inbox.event_kind,
    inbox.repository_full_name,
    inbox.pr_number,
    inbox.comment_id,
    inbox.actor,
    inbox.installation_id,
    inbox.attempt_count,
    inbox.normalized_event::text
)
select * from updated
`,
    parameters: [
      ...RETRYABLE_STATUSES.map((status, index) => stringParam(`status_${index}`, status)),
      longParam("max_attempts", maxAttempts),
      longParam("limit", limit),
    ],
  };
}

function recordToDelivery(record = []) {
  return {
    deliveryId: fieldValue(record[0]),
    eventName: fieldValue(record[1]),
    kind: fieldValue(record[2]),
    repositoryFullName: fieldValue(record[3]),
    prNumber: fieldValue(record[4]),
    commentId: fieldValue(record[5]),
    actor: fieldValue(record[6]),
    installationId: fieldValue(record[7]),
    attemptCount: Number(fieldValue(record[8]) || 0),
    event: parseJson(fieldValue(record[9])),
  };
}

function normalizeInboxEvent(event = {}) {
  return {
    deliveryId: boundedString(event.deliveryId),
    eventName: boundedString(event.eventName),
    action: boundedString(event.action),
    kind: boundedString(event.kind),
    trigger: boundedString(event.trigger),
    shouldEnqueue: Boolean(event.shouldEnqueue),
    reason: boundedString(event.reason),
    retryable: Boolean(event.retryable),
    repository: {
      id: nullableNumber(event.repository?.id),
      fullName: boundedString(event.repository?.fullName),
      private: Boolean(event.repository?.private),
      defaultBranch: boundedString(event.repository?.defaultBranch),
    },
    installationId: nullableNumber(event.installationId),
    prNumber: nullableNumber(event.prNumber),
    prAuthor: boundedString(event.prAuthor),
    actor: boundedString(event.actor),
    sender: boundedString(event.sender),
    headSha: boundedString(event.headSha),
    headRefName: boundedString(event.headRefName),
    baseSha: boundedString(event.baseSha),
    headRepoFullName: boundedString(event.headRepoFullName),
    baseRepoFullName: boundedString(event.baseRepoFullName),
    draft: Boolean(event.draft),
    commentId: nullableNumber(event.commentId),
    commandName: boundedString(event.commandName),
    reviewKinds: Array.isArray(event.reviewKinds)
      ? event.reviewKinds.map((kind) => boundedString(kind)).filter(Boolean).slice(0, 10)
      : [],
  };
}

function shouldRetryWebhookResult(result = {}) {
  const body = result.body || {};
  const event = body.event || {};
  if (event.retryable) {
    return true;
  }
  const deniedJobs = body.deniedJobs || [];
  return deniedJobs.some(
    (job) => job?.runControl?.code === "concurrency_limit_exceeded"
  );
}

function webhookResultReason(result = {}) {
  const body = result.body || {};
  if (body.event?.reason) {
    return body.event.reason;
  }
  if (body.runControl?.reason) {
    return body.runControl.reason;
  }
  const denied = (body.deniedJobs || []).find((job) => job?.runControl?.code);
  return denied?.runControl?.code || body.queue?.reason || "";
}

function requiredDeliveryId(event = {}) {
  const deliveryId = String(event.deliveryId || "").trim();
  if (!deliveryId) {
    throw new Error("Webhook inbox delivery id is required.");
  }
  return deliveryId;
}

function assertWebhookInboxConfigured(settings) {
  if (!settings.enabled) {
    return;
  }
  const missing = [];
  for (const key of ["region", "resourceArn", "secretArn", "database", "schema"]) {
    if (!settings[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`Webhook inbox is enabled but missing settings: ${missing.join(", ")}`);
  }
}

function queryArgs(query) {
  return [query.sql, query.parameters];
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function stringOrNullParam(name, value) {
  return value === undefined || value === null || value === ""
    ? nullParam(name)
    : stringParam(name, value);
}

function longOrNullParam(name, value) {
  return value === undefined || value === null || value === ""
    ? nullParam(name)
    : longParam(name, value);
}

function boolParam(name, value) {
  return { name, value: { booleanValue: Boolean(value) } };
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function boundedString(value, maxLength = 2000) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).slice(0, maxLength);
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function safeError(error) {
  return safeErrorLine(error);
}

module.exports = {
  assertWebhookInboxConfigured,
  createWebhookInbox,
  normalizeInboxEvent,
  shouldRetryWebhookResult,
  webhookInboxSettingsFromEnv,
  webhookResultReason,
};
