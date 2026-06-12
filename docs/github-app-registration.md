# GitHub App Registration Packet

This packet is the operator checklist for creating and maintaining the
production GitHub App named `6529bot`.

Use it when creating the App for the first time, changing permissions or
events, rotating credentials, or preparing release evidence. Keep unredacted
App ids, client ids, private keys, webhook secrets, manifest conversion codes,
installation ids, and private repository names in the operator runbook or
secret store, not in this public repository.

## Operator Roles

Use two separate roles, even if the same person performs both during dogfood:

- GitHub App owner: creates or updates the GitHub App in the 6529 GitHub
  organization and installs it on selected repositories.
- Bot runtime operator: stores secrets, deploys the App server, configures
  workers, and validates webhook and worker behavior.

The handoff between them is a secret-store update, not a pasted credential in
GitHub comments, issues, pull requests, chat, logs, screenshots, or shell
history.

## Inputs

Before registration, decide:

```text
Bot host:
GitHub organization:
Selected dogfood repositories:
Runtime secret store:
Private operator evidence location:
```

The bot host must be a production HTTPS origin with no path, query, or
fragment. The manifest renderer validates this shape.

## Render And Review

Render the reviewed manifest for the final production origin:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com
```

Validate without printing the manifest:

```bash
npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet
```

Confirm the rendered manifest:

- uses the App name `6529bot`, unless a release explicitly changes it;
- contains no `<bot-host>` placeholders;
- sets `hook_attributes.url` to
  `https://<production-bot-origin>/webhooks/github`;
- uses HTTPS for webhook, redirect, callback, and setup URLs;
- keeps OAuth-on-install disabled;
- keeps the App private unless a release explicitly changes distribution;
- requests only the reviewed permissions and events.

The canonical template is:

```text
templates/github-app-manifest.example.json
```

## Registration Path

Preferred dogfood path:

1. Render the manifest with the final production HTTPS origin.
2. Generate an operator-owned local registration form:

   ```bash
   npm run github-app:manifest -- -- --host https://reviewbot.example.com \
     --form \
     --owner 6529-Collections \
     --state <unguessable-state>
   ```

3. Open the generated form only from the operator workstation.
4. Submit the manifest to GitHub.
5. GitHub redirects to `/github-app/manifest-complete` with a one-hour code.
   The App server responds with operator guidance. Application code does not
   echo the code in the response, exchange it, store it, or log it.
6. Complete GitHub's manifest conversion in the operator environment:

   ```bash
   npm run github-app:convert -- -- --code <code> --output <private-json-path>
   ```

7. Move the returned credentials directly into the bot runtime secret store.
8. Record only redacted completion evidence.

Manual fallback path:

1. Create a GitHub App named `6529bot` in the 6529 organization.
2. Copy the reviewed permissions, events, webhook URL, callback URL, setup URL,
   and redirect URL from the rendered manifest.
3. Generate a high-entropy webhook secret and store it in the bot secret store.
4. Generate a private key and store it in the bot secret store.
5. Record that the manual settings match the rendered manifest.

The helper intentionally does not exchange GitHub's temporary manifest code.
Use `npm run github-app:convert` only from a private operator environment to
exchange that code and write GitHub's generated credential response to an
explicit private path. The conversion command prints only a redacted summary
and refuses to write inside this public repository unless
`--allow-repo-output` is passed for isolated tests.

The manifest's setup and callback URLs are also safe operator guidance
endpoints. They acknowledge the browser redirect and point operators back to
the install/deployment runbooks; they do not start model work or expose
secrets.

## Settings To Verify

Repository permissions:

```text
Contents: read
Issues: write
Metadata: read
Pull requests: read
```

Organization permissions:

```text
Members: read
```

Webhook events:

```text
Issue comment
Pull request
```

Security settings:

```text
Webhook active: yes
SSL verification: enabled
Webhook secret: high-entropy value stored only in bot runtime secrets
Installation scope: selected repositories during dogfood
Actions: write absent from the target-repository App manifest
```

`Members: read` is only a best-effort organization membership signal.
Repository collaborator permission remains the primary trusted-actor signal.
Central workflow dispatch should use a separate dispatch-only App installed
only on the bot repository, or an explicitly reviewed token fallback.

## Secrets Created By Registration

Expected GitHub-generated or operator-generated values:

```text
GitHub App id
GitHub client id
GitHub client secret
Webhook secret
Private key PEM
Installation id per installed account/repository
```

When using the manifest flow, GitHub returns the App id, client id, client
secret, webhook secret, and private key once during conversion. The temporary
manifest code must be exchanged within GitHub's one-hour window.

Store in bot-owned infrastructure:

```text
REVIEWBOT_GITHUB_APP_ID
REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64
REVIEWBOT_GITHUB_WEBHOOK_SECRET
```

Use `REVIEWBOT_GITHUB_APP_PRIVATE_KEY` only when the runtime secret store can
preserve multi-line PEM values safely. Otherwise store a base64-encoded PEM in
`REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64`.

Do not store these values in target repositories, frontend runtime variables,
browser-accessible config, public issues, public PRs, release notes, support
bundles, or dashboard JSON.

## Runtime Acceptance Checks

After registration and deployment:

1. Run no-network config validation in the deployment environment:

   ```bash
   npm run preflight -- -- --strict
   ```

2. Start the App server in `noop` worker mode.
3. Confirm:

   ```text
   GET /healthz
   ```

4. Send or redeliver a GitHub App `ping` event and confirm it is acknowledged.
5. Open or replay a trusted pull request delivery and confirm:

   - the webhook signature is verified before parsing;
   - actor context resolves through GitHub App credentials;
   - repository config loads from the base ref when enabled;
   - public-repo trusted-actor gates run before budget checks;
   - budget checks run before queueing;
   - `noop` mode reports jobs without model calls.

6. Switch one target repository to command-only dogfood.
7. Trigger:

   ```text
   /6529bot security
   ```

8. Verify job ledger, run-control, usage, and alert paths according to the
   release gate being tested.

## Rotation

Webhook secret rotation:

1. Generate a new high-entropy webhook secret.
2. Store it in the bot runtime secret store.
3. Update the GitHub App webhook secret.
4. Redeploy or restart the bot runtime so it reads the new value.
5. Redeliver a recent webhook and confirm the new signature validates.
6. Remove the old secret from the secret store.

Private key rotation:

1. Generate a new private key in GitHub App settings.
2. Store the new key in the bot runtime secret store.
3. Redeploy or restart the bot runtime.
4. Mint a test installation token with:

   ```bash
   npm run github-app:token -- --installation-id <installation-id>
   ```

5. Confirm repository config loading and actor permission resolution still
   work.
6. If rotating the dispatch-only App, mint the token through the worker profile:

   ```bash
   npm run github-app:token -- --profile worker-dispatch --installation-id <dispatch-installation-id>
   ```

7. Delete the old private key from GitHub App settings and the secret store.

Provider keys, AWS access, and admin-auth secrets rotate through their own
runbooks. Do not combine rotations unless an incident requires broad
containment.

## Permission Changes

Treat GitHub App permission or event changes as release-sensitive:

1. Update `templates/github-app-manifest.example.json`.
2. Update `src/github-app-manifest.cjs` validation if the required contract
   changed.
3. Update `docs/github-app.md`, `docs/deployment.md`, and this packet.
4. Run:

   ```bash
   npm run release:check
   npm run github-app:manifest -- -- --host https://reviewbot.example.com --quiet
   ```

5. Open a PR that explains why the new permission/event is necessary and what
   user or secret data it exposes.
6. Apply the App settings change only after merge and release review.

Do not add broad permissions as a convenience shortcut. The App should request
only what the server and workers actually use.

Central workflow dispatch is the main exception to keep separate. Prefer a
dispatch-only App installed only on `6529-Collections/6529reviewbot` with
`Actions: write`; adding that permission to the target-repository App requires
an explicit security review because it affects every installed repository.

## Rollback

If registration is wrong or a credential may have leaked:

```text
REVIEWBOT_ENABLED=false
REVIEWBOT_WORKER_ADAPTER=noop
REVIEWBOT_PUBLIC_REPO_MODE=off
```

Then:

- disable or rotate the affected GitHub App credential;
- remove the App installation from target repositories if needed;
- disable provider keys if model calls may have been triggered;
- preserve private evidence in the operator runbook;
- publish only a redacted public summary.

Use [incident-response.md](incident-response.md) for active incidents.

## Public Evidence

Safe to publish:

```text
Manifest rendered and reviewed: yes/no
Permissions match docs: yes/no
Webhook URL host class: production/staging/local
Webhook ping acknowledged: yes/no
Installed repository count: number only
Preflight result: pass/pass-with-accepted-warnings/fail
```

Keep private:

```text
App id
Client id and secret
Private key
Webhook secret
Installation ids
Exact private repository names
Raw webhook payloads
Provider responses
AWS account ids, ARNs, and secret ARNs
```

## References

- [GitHub App manifest registration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
- [GitHub App best practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- [Using webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)
- [Managing GitHub App private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps)
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
