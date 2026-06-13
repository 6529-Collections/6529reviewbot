# AWS IAM Templates

These templates are review aids for the intended central `6529bot`
deployment. They are not applied automatically and they intentionally contain
placeholder account, region, repository, branch, cluster, secret, SNS topic,
and SES identity values.

Run `npm run check:aws-iam-templates` after editing these templates or related
release guidance. The AWS IAM/OIDC template check keeps the placeholder
discipline, exact allowed actions, bot-repository trust boundary, and public
cutover references synchronized.

Use them to create least-privilege roles for the bot repository or another
6529-owned runtime. Target application repositories should not receive AWS
credentials or roles for provider spend.

## Files

- `github-actions-oidc-trust-policy.example.json`: trust policy for a role
  assumed by GitHub Actions through `token.actions.githubusercontent.com`.
- `usage-ledger-data-api-policy.example.json`: identity policy for reading and
  writing the isolated Aurora Data API ledger.
- `scheduled-spend-alerts-policy.example.json`: identity policy for scheduled
  spend checks that read the ledger and publish to one SNS topic or send
  through one SES identity.

## Replacement Checklist

Replace every placeholder before applying:

```text
<aws-account-id>
<aws-region>
<owner>
<repo>
<branch-name>
<cluster-name>
<secret-name>
<sns-topic-name>
<ses-identity-name>
```

Prefer trusting the bot repository only:

```text
repo:6529-Collections/6529reviewbot:ref:refs/heads/main
```

If a workflow uses protected GitHub environments, use an environment-scoped
subject instead and document the environment protection rules:

```text
repo:6529-Collections/6529reviewbot:environment:<environment-name>
```

## Database Permissions

IAM permissions for the RDS Data API do not constrain SQL statements by table.
Use database roles/grants for table-level least privilege:

- App and worker write path: insert usage/job rows, read budget/model price/run
  claim rows, and update run claims as needed.
- Usage/admin read path: select usage, budget policy, job event, and status
  data only.
- Operator apply path: schema, budget policy, and model price maintenance from
  a controlled operator role.

Keep the RDS-managed secret scoped to the role that actually needs it. Do not
copy the secret ARN or AWS role trust into target repositories.

## Review Procedure

Before a dogfood or release candidate:

1. Render the final trust and identity policies after placeholder replacement.
2. Confirm the trust policy `sub` condition matches the workflow identity that
   will assume the role.
3. Confirm the identity policy resources are the single reviewbot cluster,
   secret, and optional SNS topic or SES identity.
4. Run `npm run preflight -- -- --strict` from the release candidate
   environment.
5. Record the policy ARNs and review evidence in the release issue or operator
   runbook, not in public files if they identify private infrastructure.
