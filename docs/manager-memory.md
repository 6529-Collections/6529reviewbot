# Manager Memory

The `_manager/roadmap-execution/active-context.md` and
`_manager/roadmap-execution/run-log.md` files are durable operator memory for
this autonomous workstream. They are public repository files, so they must stay
useful after compaction without containing secrets, private paths, raw provider
responses, AWS identifiers, private repository data, or live operator evidence.

## Update Cadence

Update manager memory when a PR ships, when the current branch changes, when a
new local validation set is complete, and when the roadmap or rollout risks
change. The active context should remain the first file to read after
compaction; the run log should preserve enough history to explain what shipped
and why.

After a PR merges, record the PR number, short merge commit, and post-merge CI
and OpenSSF Scorecard result in the run log. The active context should mention
the latest merged PR recorded in the run log before the next release check is
published.

## Contract Check

Run:

```bash
npm run check:manager-memory
```

The check verifies:

- the active context keeps its core sections for goal, state, decisions,
  constraints, next actions, and open risks;
- the latest merged PR recorded in the run log is also represented in the
  active context;
- shipped memory does not leave `Current local validation: pending`;
- the previous shipped operator-drill task is no longer listed as the next
  action;
- package scripts, release checks, smoke tests, the release operations map, and
  public docs reference this contract.

`npm run release:check` includes this check so stale durable manager memory is
caught before a release or dogfood evidence packet is published.
