# Admin Auth Bridge

Private `6529bot` admin endpoints should run behind the existing `6529.io`
auth system. This repository does not introduce a second human login system.

The intended flow is:

1. A human signs in to `6529.io`.
2. `6529.io` decides whether that user can administer `6529bot`.
3. A trusted 6529 server or gateway calls the bot API with a short-lived signed
   admin assertion.
4. `6529reviewbot` verifies that assertion before returning private usage or
   budget data.

The browser never receives the bot admin signing secret.

## Modes

```text
REVIEWBOT_ADMIN_AUTH_MODE=disabled|shared_secret|hmac
```

`disabled` is the default and fails closed.

`shared_secret` is a simple internal service-to-service mode. Send:

```text
x-6529-reviewbot-admin-secret: <secret>
```

This is useful behind a trusted private gateway, but it does not carry user
identity.

`hmac` is the preferred bridge for `6529.io` because it carries the authenticated
operator and roles.

## HMAC Headers

```text
x-6529-admin-user: <6529 user id or handle>
x-6529-admin-roles: reviewbot-admin,admin
x-6529-admin-expires-at: <unix seconds>
x-6529-admin-signature: sha256=<hex hmac>
```

Required environment:

```text
REVIEWBOT_ADMIN_AUTH_MODE=hmac
REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=<shared integration secret>
REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin
REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300
```

The signature is HMAC-SHA256 over:

```text
METHOD
PATH?QUERY
USER
ROLES
EXPIRES_AT
```

Example canonical payload:

```text
GET
/api/admin/usage/summary?days=30
punk6529
reviewbot-admin
1781227200
```

The bot rejects:

- missing headers;
- expired assertions;
- assertions whose expiry is too far in the future;
- users without a required role;
- signatures for a different path, query string, method, user, role set, or
  expiry.

## Operational Notes

Keep the HMAC secret in server-side `6529.io` infrastructure and the bot
runtime only. Do not expose it to frontend JavaScript, GitHub Actions logs,
browser storage, or public repository variables.

Rotate the secret by deploying `6529.io` and `6529reviewbot` with overlapping
support or a short maintenance window. Keep assertion TTL short enough that a
captured request is not useful.
