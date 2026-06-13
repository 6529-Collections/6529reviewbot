# 6529reviewbot Docs

Use this index as the canonical map for public documentation in this
repository. Product, security, deployment, release, and operator runbooks should
be linked here before they are considered release-ready.

## Start Here

- [Architecture](architecture.md): central App, worker, provider, and data
  boundaries.
- [Installation](install.md): production setup and target repository
  onboarding.
- [Configuration](configuration.md): runtime environment variables and policy
  settings.
- [Security Model](security-model.md): trust boundaries, secrets, model
  exposure, and public-repo controls.
- [Roadmap](roadmap.md): current direction, shipped pieces, and remaining
  release work.

## GitHub App And Review Runtime

- [GitHub App](github-app.md): webhook, permission, and installation model.
- [GitHub App Registration](github-app-registration.md): public-safe App
  creation and credential-custody packet.
- [Provider Setup](provider-setup.md): Anthropic, OpenAI, and OpenRouter setup.
- [Model Catalog](model-catalog.md): provider defaults and model update path.
- [Repository Config](repository-config.md): target repository policy file.
- [Comment Commands](comment-commands.md): maintainer trigger contract.
- [Review Workflows](review-workflows.md): review kinds and prompt intent.
- [Review Jobs](review-jobs.md): job fanout, lanes, and worker inputs.
- [Review Comment Format](review-comment-format.md): visible comments and
  hidden metadata.
- [Reusable Workflow](reusable-workflow.md): compatibility workflow path.
- [Worker Adapters](worker-adapters.md): local and GitHub Actions workers.
- [Worker Capacity](worker-capacity.md): backpressure, scaling, and queue
  pressure.
- [Deployment](deployment.md): production App, worker, AWS, and 6529.io wiring.
- [Container Deployment](container-deployment.md): central App server image and
  runtime boundaries.
- [Container Publish Plan](container-publish-plan.md): dry-run build, push,
  vulnerability scan, and private evidence guidance.
- [Production Deployment Plan](production-deployment-plan.md): dry-run
  operator handoff across App registration, image publish, operator workspace,
  preflight, cutover, and dogfood gates.
- [Dashboard Deployment Plan](dashboard-deployment-plan.md): dry-run 6529.io
  public/private dashboard configuration and verification handoff.

## Policy, Spend, And Reporting

- [Admission Policy](admission-policy.md): trusted actors and public-repo
  admission.
- [Budget Admission](budget-admission.md): budget checks before provider calls.
- [Budget Policies](budget-policies.md): operator-maintained central caps.
- [AWS Usage Ledger](aws-usage-ledger.md): isolated Aurora usage ledger.
- [Job Ledger](job-ledger.md): durable budget and dispatch audit events.
- [Run Control](run-control.md): dedupe and concurrency claims.
- [Model Pricing](model-pricing.md): operator-maintained provider price rows.
- [Usage API](usage-api.md): public and admin reporting contracts.
- [Admin Auth Bridge](admin-auth-bridge.md): 6529.io signed admin access.
- [6529.io Admin Integration](6529-io-admin-integration.md): private dashboard
  wiring.
- [Alerting](alerting.md): scheduled spend and job health notifications.
- [Alert Delivery Plan](alert-delivery-plan.md): dry-run production alert
  routing handoff for webhook, SNS, or SES delivery.

## Release And Dogfood

- [Release Process](release.md): release checklist and tag procedure.
- [Release Readiness](release-readiness.md): current gates and gaps.
- [v0 Release Plan](v0-release-plan.md): first public dogfood tag criteria.
- [Release Candidate Bundle](release-candidate.md): public-safe readiness
  artifact.
- [Release Notes Draft](release-notes-draft.md): public-safe pre-v1 release
  notes draft from release-candidate evidence.
- [Release Notes Publication](release-notes-publication.md): completed release
  notes guard before publishing a tag or GitHub Release.
- [Release Tag Plan](release-tag-plan.md): dry-run clean-main and completed
  release-notes check before operator tagging.
- [Release Notes Template](release-notes-template.md): pre-v1 release notes
  shape.
- [Release Operations Map](release-operations-map.md): command and evidence
  boundary index.
- [Operator Workspace](operator-workspace.md): private release evidence
  workspace.
- [Operator Drill](operator-drill.md): public-safe release and dogfood
  rehearsal command for operator workspaces.
- [Operator Evidence Template](operator-evidence-template.md): redacted
  evidence summary shape.
- [Production Cutover](production-cutover.md): go/no-go checklist and private
  status overlay.
- [Dogfood Runbook](dogfood.md): phased rollout to trusted repositories.
- [Dogfood Target Packet](dogfood-target.md): target config PR readiness.
- [Dogfood Readiness](dogfood-readiness.md): central input checks before
  traffic.
- [Dogfood Promotion Packet](dogfood-promotion.md): final pre-traffic
  go/no-go packet.
- [Dogfood Go-Live Packet](dogfood-go-live.md): final cross-check across
  release, promotion, cutover, and workspace evidence.
- [Dogfood Status](dogfood-status.md): private dogfood execution status.
- [Security Review Checklist](security-review-checklist.md): public manual
  security checklist.
- [Security Review Status](security-review-status.md): private manual-review
  status overlay.
- [Manager Memory](manager-memory.md): durable autonomous workstream state and
  release-check contract.

## Operations And Support

- [Operations Runbook](operations.md): routine checks and common operator
  commands.
- [Incident Response](incident-response.md): spend, provider, webhook, and
  secret incidents.
- [Support](support.md): support bundle and public issue triage.
