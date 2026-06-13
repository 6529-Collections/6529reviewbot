# 6529.io Admin Integration

The private `6529.io` admin page should call `6529reviewbot` from trusted
server-side code. The browser should authenticate to `6529.io`; the `6529.io`
server should verify the operator, sign a short-lived admin assertion, call the
bot API, and return only the data the page needs.

Do not expose the bot HMAC secret, AWS credentials, GitHub App credentials, or
provider keys to frontend JavaScript.

## Server-Side Client

`src/usage-api-client.cjs` provides a small CommonJS client for server-side
integrations:

```js
const { createUsageApiClient } = require("./path/to/6529reviewbot/src/usage-api-client.cjs");

const client = createUsageApiClient({
  settings: {
    baseUrl: process.env.REVIEWBOT_USAGE_API_BASE_URL,
    actor: "6529.io",
    roles: ["reviewbot-admin"],
    adminAuth: {
      hmacSecret: process.env.REVIEWBOT_ADMIN_AUTH_HMAC_SECRET,
      maxTtlSeconds: 300,
      requiredRoles: ["reviewbot-admin"],
    },
    timeoutMs: 10000,
  },
});

const budget = await client.budgetStatus();
const prices = await client.modelPriceStatus();
const alerts = await client.alertStatus();
```

The client signs admin requests with the same HMAC canonical payload described
in [Admin Auth Bridge](admin-auth-bridge.md). It rejects URL-shaped endpoint
paths so callers cannot accidentally turn a dashboard route into an arbitrary
outbound fetch.

## Environment

For a server-side 6529.io integration:

```text
REVIEWBOT_USAGE_API_BASE_URL=https://reviewbot.example.com
REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS=10000
REVIEWBOT_USAGE_API_ADMIN_ACTOR=6529.io
REVIEWBOT_USAGE_API_ADMIN_ROLES=reviewbot-admin
REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=<shared integration secret>
```

The bot runtime needs the matching:

```text
REVIEWBOT_ADMIN_AUTH_MODE=hmac
REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=<shared integration secret>
REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin
REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300
```

Keep those values in private runtime secret stores. Do not commit live hosts,
real secrets, or internal network details to this public repository.

For the `6529.io` frontend route environment, start from:

```text
templates/6529-io-reviewbot-env.example
```

The template uses the env names expected by the public Open Data route and the
private `/tools/6529bot/admin` route. It includes only placeholders and
reviewed API paths. Validate it against the OpenAPI contract with:

```bash
npm run check:6529-io-env
```

Keep the live wallet allowlist, auth-check URL, HMAC secret, and production
origin in the private 6529.io deployment configuration, not in this public
repository.

## Recommended Page Calls

The public 6529.io transparency page should call:

```text
GET /api/public/usage/summary?days=30
```

The private admin page should call the bot through trusted server-side 6529.io
code using:

```text
GET /api/admin/usage/summary?days=30
GET /api/admin/usage/events/recent?days=7&limit=50
GET /api/admin/budget/status
GET /api/admin/model-prices/status
GET /api/admin/alerts/status
GET /api/admin/jobs/recent?status=dispatch_failed&limit=10
GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=10
GET /api/admin/status?profile=server
```

For the first private admin page, use these client methods:

```text
client.adminUsageSummary({ days: 30 })
client.recentUsageEvents({ days: 7, limit: 50 })
client.budgetStatus()
client.modelPriceStatus()
client.alertStatus()
client.jobEvents({ status: "dispatch_failed", limit: 10 })
client.runClaims({ active: true, staleMinutes: 120, limit: 10 })
client.runtimeStatus({ profile: "server" })
client.runtimeStatus({ profile: "worker" })
```

Keep public transparency pages on `client.publicUsageSummary({ days: 30 })`
unless the request is already in a trusted admin server context.

## Failure Handling

The private admin page should show warnings when:

- the bot returns `403`, which usually means the HMAC bridge is not configured
  or the operator lacks a required role;
- the bot returns `503`, which means the endpoint is configured but its
  database or diagnostic loader is unavailable;
- model price status reports stale, future-dated, invalid, or missing source
  evidence;
- budget status reports over-budget or high-utilization periods;
- alert status reports disabled or unconfigured delivery for an expected
  notification path;
- runtime status reports failed preflight checks;
- run-claims status shows stale active claims.

Warnings should link to the relevant runbook in this repo. They should not
display raw provider responses, prompts, diffs, webhook payloads, credentials,
or unredacted exception stacks.

## Operator Snapshot

Operators can exercise the same client paths from a private environment:

```bash
npm run admin:snapshot -- -- --base-url https://reviewbot.example.com
npm run admin:snapshot -- -- --json --require-ok
```

The snapshot command reduces endpoint responses into counts and posture flags.
It does not print raw usage events, private repo names, budget scope values,
provider responses, prompts, diffs, webhook payloads, or credentials. Use it
for private dashboard bring-up, release evidence, and quick incident checks.
`--require-ok` exits non-zero when any endpoint is unavailable or any warning
posture is present.
