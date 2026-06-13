# Admission Policy

The admission policy decides whether a normalized GitHub event may create model
review work. It runs before budget checks and before provider calls.

## Defaults

```text
REVIEWBOT_PUBLIC_REPO_MODE=trusted
REVIEWBOT_PRIVATE_REPO_MODE=open
REVIEWBOT_DRAFT_PR_MODE=skip
REVIEWBOT_TRUSTED_PERMISSION=write
```

Default behavior:

- public repositories require trusted actors by default;
- private repos allow review requests by default;
- draft PRs are skipped until ready for review;
- actors with `write`, `maintain`, or `admin` repository permission are trusted.

If actor context has not been resolved yet, the actor is treated as untrusted.
This intentionally fails closed for public repositories.

## Modes

`REVIEWBOT_PUBLIC_REPO_MODE` and `REVIEWBOT_PRIVATE_REPO_MODE` support:

```text
trusted   Require a trusted actor.
open      Allow any actor.
off       Disable review automation for that visibility.
```

Use `trusted` for public open-source repositories to prevent arbitrary PR
authors or commenters from burning model budget. This keeps external PRs
visible for review while requiring a maintainer or other trusted actor before
provider spend can occur.

## Trusted Actors

An actor is trusted if any of these are true:

- the actor is in `REVIEWBOT_TRUSTED_USERS`;
- the actor is an org member according to resolved GitHub context;
- the actor belongs to a trusted org or team in resolved context;
- the actor has at least `REVIEWBOT_TRUSTED_PERMISSION` on the repository.

Configuration:

```text
REVIEWBOT_TRUSTED_USERS=
REVIEWBOT_TRUSTED_TEAMS=
REVIEWBOT_TRUSTED_ORGS=
REVIEWBOT_TRUSTED_PERMISSION=write
REVIEWBOT_DENY_USERS=
```

`REVIEWBOT_DENY_USERS` wins over trust. Use it for emergency blocks.

## Requestor Attribution

The requestor is the user who caused the model spend:

- pull request events: the GitHub event actor;
- comment commands: the comment author.

For an external contributor PR triggered by a maintainer command, the
maintainer is the requestor for budget and audit purposes.

## Current Implementation

The pure policy engine lives in `src/admission-policy.cjs`.

`src/app-server.cjs` calls it after webhook normalization and before queueing.
When GitHub App auth is configured, `bin/server.cjs` injects a resolver that
uses installation tokens to read collaborator permission and best-effort org
membership. Without that resolver, the default actor context contains only the
actor login and public repo events fail closed.
