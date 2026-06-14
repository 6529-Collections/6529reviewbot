# Compatibility Policy

`6529reviewbot` is pre-v1 infrastructure. Until production dogfood is complete
and a stable compatibility promise is explicitly published, target repositories
should pin the bot to an exact release tag or commit SHA before enabling live
traffic.

## Compatibility Surfaces

Treat these public surfaces as compatibility-sensitive:

- repository configuration files, including `.github/6529bot.yml`;
- reusable workflow inputs, secrets, permissions, and defaults;
- review job payloads, worker adapter fields, and hidden review metadata;
- comment commands and generated PR comment format;
- public usage API and private admin API response shapes;
- model catalog defaults, provider routing, and review-kind names;
- budget, run-control, and admission policy file shapes;
- alert payload shape and delivery guarantees.

## Pre-v1 Rule

Pre-v1 releases may change compatibility-sensitive surfaces. A release can
still be published for dogfood or community review, but release notes must say:

- that the release is pre-v1;
- which worker path, providers, models, budget, and admission defaults were
  tested;
- which compatibility-sensitive surfaces changed;
- that target repositories should pin to an exact tag or commit SHA before
  updating;
- which rollback path operators should use if an integration breaks.

## Breaking Changes

Treat a change as breaking when it removes, renames, or changes the meaning of
any compatibility-sensitive surface. Breaking pre-v1 changes are allowed only
when release notes name the change, the expected migration path, and the
rollback path.

## Stable Releases

Before any v1 compatibility guarantee, this policy needs an explicit update
that defines the stable API surface, supported deprecation window, and minimum
target-repository migration notice.

## Maintenance

Run the compatibility policy contract after changing release, workflow,
configuration, comment-format, usage API, admin API, review-job, or worker
payload behavior:

```bash
npm run check:compatibility-policy
```
