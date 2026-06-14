# Alert Delivery Plan

The alert delivery plan is the dry-run operator handoff for moving scheduled
spend and job-health alerts from local dry-run evidence to a production
operator-owned private channel.

It coordinates:

- alert notify mode and private channel ownership;
- SNS, SES, or webhook secret custody;
- budget utilization, spend-spike, failed-job, and stale-claim thresholds;
- dry-run alert evaluation and private alert-status API posture;
- production cutover and operator evidence updates;
- public release-note wording that omits delivery destinations and payloads.

It does not send alerts, create topics, verify SES identities, call webhooks,
call AWS, or read live ledgers.

## Commands

Render the placeholder plan:

```bash
npm run alerts:delivery-plan
```

Use explicit inputs for a reviewed production alert handoff:

```bash
npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --release v0.1.0
```

Use `--require-ready` for the final alert delivery handoff gate. This exits
non-zero unless the production bot origin, private operator workspace,
production notify mode, and public-safe operator alert channel label are
provided. Final ready plans reject documentation, example, local, or reserved
origin hosts such as `reviewbot.example.com`; replace them with the production
bot origin before using the handoff as release evidence:

```bash
npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --require-ready
```

Run the contract check after changing alert delivery planning behavior,
release checks, operations-map entries, or this runbook:

```bash
npm run check:alert-delivery-plan
```

## Public Safety

The plan can include private origins, workspace paths, and channel labels when
operators pass real inputs. Keep webhook URLs, SNS ARNs, SES sender/recipient
addresses, AWS account ids, raw alert payloads, private repo names, and job ids
in the private operator workspace.

Public release notes should say whether alert routing is enabled, deferred, or
limited to dry-run evidence. They should not publish delivery targets or raw
payload excerpts.

## Handoff Phases

The plan renders these phases:

- routing configuration: notify mode, channel owner, secret custody, and
  delivery-mode contract checks;
- alert policy: budget/spike/job-health thresholds and strict preflight;
- dry-run and status: `alerts:operator --dry-run --force`, private
  alert-status API posture, and admin snapshot evidence;
- cutover evidence: `alert-delivery-plan-reviewed` and `alerts-deliver`
  production cutover status plus worker-and-alerts operator evidence;
- release notes: public status summary without private destinations.

## Related Runbooks

- [Alerting](alerting.md)
- [Deployment](deployment.md)
- [Operations Runbook](operations.md)
- [Production Cutover](production-cutover.md)
- [Operator Evidence Template](operator-evidence-template.md)
