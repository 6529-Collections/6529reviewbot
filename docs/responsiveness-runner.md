# Responsiveness Runner

The responsiveness runner checks frontend pull requests by installing the target
repository, starting its local dev server, and running a temporary
Playwright harness across web desktop, web mobile, native mobile, and Electron
desktop contexts.

There are two workflow entrypoints:

- `.github/workflows/responsiveness-review.yml` is the central production
  review workflow. The benchmark job runs target PR code on GitHub-hosted
  `ubuntu-latest` without model provider keys. A separate comment job posts a
  normal 6529bot PR comment and writes usage with provider `github`, model
  `actions-ubuntu-latest`. The comment job can also upload safe runner
  artifacts to private S3 and call Anthropic Opus for a screenshot-aware visual
  summary.
- `.github/workflows/responsiveness.yml` is a manual benchmark workflow for
  speed, signal-quality, and route-inference experiments.

## Runner Size

The manual workflow defaults to the GitHub-hosted runner label:

```text
ubuntu-latest
```

The production workflow also uses GitHub-hosted `ubuntu-latest`. If the
organization later provisions a larger GitHub-hosted runner label, pass that
label through the manual workflow's `runner_label` input first and only wire it
into production after measuring signal and cost.

The benchmark installs dependencies and runs target repository code, so keep
provider keys and AWS app credentials out of the benchmark job. The production
workflow posts comments and writes ledgers from a separate job.

## Manual Workflow

Run `.github/workflows/responsiveness.yml` from the Actions tab with:

```text
target_repo: 6529-Collections/6529seize-frontend
pr_number:  <existing frontend PR number>
runner_label: ubuntu-latest
contexts: web-desktop,web-mobile,native-mobile,electron-desktop
max_pages: 12
workers: 4
plan_only: false
```

For a cheap dry run that only infers routes:

```text
plan_only: true
```

The workflow writes the markdown summary to the GitHub job summary and uploads
`.reviewbot-responsiveness` as an artifact containing:

- `plan.json`: changed files, inferred routes, contexts, and route reasons.
- `summary.md`: pass/fail, duration, failures, warnings, and slowest checks.
- `screenshots.json`: machine-readable screenshot index with route, context,
  warning, failure, and timing metadata.
- `results/*.json`: per-route/per-context deterministic check results.
- `screenshots/*.png`: one full-page screenshot per completed check when
  possible; if full-page capture times out, the runner stores a viewport
  screenshot and reports the fallback as a warning. If both captures fail after
  the route has already rendered meaningful content, the run keeps the
  deterministic DOM metrics and reports missing screenshot evidence as a
  warning.
- `playwright-report.json` and `playwright-output/`: Playwright output.
- `dev-server.log`: the target dev server's stdout and stderr, ANSI-stripped
  and capped at 8 MB.
- `exit-code.txt`: the runner exit code, also rewritten by the workflow.

Production PR comments include a link to the uploaded artifact when GitHub
returns one from `actions/upload-artifact`. Screenshot paths in the slowest
checks section link to that artifact; GitHub does not currently expose stable
per-file links inside the artifact zip.

The production workflow preserves artifacts and posts the 6529bot comment even
when deterministic checks fail, then fails the benchmark job after artifact
upload. This keeps the required GitHub check aligned with the review verdict
without losing debugging evidence.

When `REVIEWBOT_RESPONSIVENESS_ARTIFACTS_ENABLED=true`, the comment job also
uploads a bounded public-comment-safe subset to private S3:

- `summary.md`, `plan.json`, `pr.json`, `screenshots.json`, and
  `artifact-upload.json`.
- `results/*.json`.
- `screenshots/*.png`.

The S3 bucket should stay private. PR comments link through the central App
server viewer route, defaulting to:

```text
/artifacts/responsiveness/<opaque-token>/<artifact-path>
```

The viewer route validates the opaque token and artifact path shape, then
redirects to a short-lived presigned S3 URL. The opaque token is generated per
run and stored only in the artifact URL, so the route does not need a database.

When `REVIEWBOT_RESPONSIVENESS_AI_ENABLED=true`, the comment job sends the
deterministic summary plus the screenshot set to Anthropic Opus
(`REVIEWBOT_RESPONSIVENESS_AI_MODEL`, default `claude-opus-4-8`). The AI
summary becomes the top of the PR comment and the deterministic runner output
moves into an expandable details block. The workflow still records the GitHub
Actions compute row, and records the Opus call separately as
`responsiveness_visual` usage. Full-resolution PNGs stay in the GitHub/S3
artifacts for humans and bots that need exact evidence. The Opus request uses
local resized JPEG copies, controlled by
`REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_DIMENSION` and
`REVIEWBOT_RESPONSIVENESS_AI_IMAGE_QUALITY`, so full-page screenshots remain
under provider many-image limits.
For 6529 frontend runs, the prompt includes the selected profile, route
reasons, platform notes, profile-specific deterministic probes, and per-image
metadata such as layout-root markers, `body.capacitor-native`, Electron
detection, bottom-navigation visibility, content readiness, blank-image
signals, and Next.js overlay/asset errors. The visible comment starts with the
Opus-authored summary and keeps the deterministic detail in an expandable
block.

## Contexts

The default reference mode runs these four contexts in parallel:

```text
web-desktop      1440x900 desktop Chrome
web-mobile       390x844 mobile/touch Chrome
native-mobile    390x844 mobile/touch with a Capacitor native-platform shim
electron-desktop 1280x800 desktop Chrome with an Electron user-agent suffix
```

Additional contexts are available for focused/manual runs:

```text
web-narrow        1279x900 desktop Chrome for the 6529 narrow layout boundary
web-tablet-touch  1024x768 touch Chrome
native-ios        390x844 native iOS simulation
native-android    412x915 native Android simulation
```

The native context is a browser-level Capacitor shim, not a real iOS or Android
simulator. It is meant to catch app-shell layout regressions quickly before a
deeper device/simulator setup exists. For 6529 frontend repositories, the
native assertion follows the actual app contract:
`Capacitor.isNativePlatform()` and `Capacitor.getPlatform()` must report the
shimmed native platform, `Capacitor.isPluginAvailable()` must expose the App,
Keyboard, and Device plugins used by the app shell, `viewport-fit=cover` must
be present, and `CapacitorSetup` should apply `body.capacitor-native`.
The 6529 native-mobile and native-ios profiles seed the native iOS marker and
current versioned EULA receipt before navigation so the sweep exercises the app
shell without an app-bootstrap reload or legal-consent interstitial. Keep that
receipt version in sync with the frontend's `CURRENT_EULA_VERSION`; if an EULA
screen is detected, the failure names that contract directly. Every native
context installs the matching Capacitor shim. Native content readiness requires
the hydrated `body.capacitor-native` class plus either app navigation or the
open-mobile handoff prompt; a blocking or checking screen is not treated as
route readiness. Electron checks are also browser-level: they verify that
the renderer takes the Electron user-agent branch, but do not launch a packaged
desktop app.

## Profiles

The runner auto-detects a responsiveness profile from the target
`package.json`; pass `--profile <id>` to override it.

The `6529seize-frontend` profile is tuned to the 6529 web, Capacitor, and
Electron code paths:

- shell canaries: `/` and `/waves`;
- global smoke routes: `/`, `/waves`, `/messages`, `/network`, `/the-memes`,
  `/meme-lab`, `/rememes`, `/meme-calendar`, `/notifications`, and
  `/open-mobile?path=%2Fwaves`;
- route mappings for user pages, messages, app wallets, wave creation,
  Drop Forge, Meme Calendar, Discover, community curations, and mobile wrapper
  dialogs;
- global-pattern expansion for layout/context/navigation/device/deep-link/env
  changes;
- profile probes for the native Capacitor contract, Electron branch, 6529
  layout branch markers, and open-mobile handoff route.

The `6529-safe-app` profile targets the Safe App Vite SPA:

- hash-router routes: `/#/`, `/#/gallery`, `/#/delegation`, `/#/transfers`,
  `/#/ens`, `/#/settings`, and `/#/activity`;
- route mappings from `src/pages/*Page` and `src/features/<name>/` to the
  matching hash route, with app-shell/navigation/runtime/styles/config changes
  expanding to the full route set;
- a Vite dev-server command (`pnpm exec vite --port <port> --strictPort`) and
  an `https://localhost:<port>` base URL, because the Safe App dev server uses
  the basic-ssl plugin. The generated Playwright config and prewarm contexts
  set `ignoreHTTPSErrors` for the self-signed certificate;
- no 6529 shell probes: native-mobile and electron-desktop stay browser-level
  simulations without Capacitor/Electron contract assertions.

## Web Server Command

The runner starts the target dev server itself; the generated Playwright
config has no `webServer` block. The dev server command resolves in this
order:

1. an explicit `--install-command`;
2. the profile dev-server command (`6529-safe-app`);
3. `./bin/6529 run dev` when the target checkout has an executable
   `bin/6529` wrapper;
4. `pnpm run dev` otherwise.

The workflows install target dependencies with `./bin/6529 ci`, the canonical
frozen-install command also supported by older wrappers. They apply the same
wrapper fallback when installing dependencies and Chromium: targets without
`bin/6529` use
`pnpm install --frozen-lockfile` (through Socket Firewall when available) and
`pnpm exec playwright install chromium`.

## Dev Server Supervision And Deadline

Playwright's `webServer` only watches the server while it starts. A dev server
that exited or stopped answering later left the run waiting until the GitHub
job timeout, which cancelled the job before the summary, artifact, and comment
steps ran. The runner now owns the dev server and the Playwright process and
stops the run early, with a reason, when either goes wrong.

- Start: the runner spawns the dev server in its own process group and waits
  for the base URL to answer with HTTP 2xx-403, retrying `/index.html` after a
  404 on `/` (the same rule Playwright used). The wait is bounded by
  `REVIEWBOT_RESPONSIVENESS_SERVER_TIMEOUT_MS` (default 180000). A server that
  exits first, or never becomes ready, stops the run before Playwright starts.
  Without `--reuse-existing-server`, a server already answering at the base
  URL is an error rather than a silent reuse.
- Turbopack cache: the dev server gets `NEXT_DEV_TURBOPACK_FS_CACHE=0`, which
  the 6529 frontend maps to `turbopackFileSystemCacheForDev: false`, matching
  its own CI dev servers. Runs always start cold, and the cache's background
  restore has panicked and killed the dev server mid-run. Override with
  `REVIEWBOT_RESPONSIVENESS_NEXT_DEV_TURBOPACK_FS_CACHE` for debugging only.
- Exit watch: if the dev server process exits while Playwright runs, the runner
  stops immediately with `dev server exited with code <n>`. Exit codes above
  128 name the signal, for example `134 (SIGABRT)` for a Turbopack panic abort
  or `137 (SIGKILL)` for an out-of-memory kill.
- Health probe: every `REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_INTERVAL_MS`
  (default 5000) the runner requests a cheap path, with a per-probe timeout of
  `REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_TIMEOUT_MS` (default 15000). Any HTTP
  response counts as alive. After `REVIEWBOT_RESPONSIVENESS_HEALTH_STALL_MS`
  (default 90000) without a response, the run stops with
  `dev server stopped responding`. The 6529 frontend profile probes
  `/robots.txt`, a static public file that Next.js serves without rendering a
  route or writing a request log line; other profiles probe `/`. Set
  `REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_PATH` to override.
- Deadline: the runner has an internal wall-clock budget that must end below
  the GitHub job timeout, so even an unforeseen hang still produces a summary
  and a PR comment. It resolves in this order:
  1. `--deadline-minutes <n>` or `REVIEWBOT_RESPONSIVENESS_DEADLINE_MINUTES`;
  2. `--job-timeout-minutes <n>` or `REVIEWBOT_RESPONSIVENESS_TIMEOUT_MINUTES`,
     minus a 6-minute reserve for setup steps before the runner and the
     summary and artifact steps after it (never below half the job timeout);
  3. a default of 25 minutes, sized for the production 40-minute job timeout.
     The production workflow does not yet pass its job timeout to the runner
     step, so it uses this default today. The manual workflow's job timeout
     is 20 minutes, so there the dev server watch is the effective guard.
- Playwright global timeout: Playwright receives a `globalTimeout` 90 seconds
  (or a quarter of the remaining time, if less) below the runner deadline, so
  it can stop and write its report on its own first.
- Prewarm bounds: global setup has no per-test timeout, so its browser launch,
  context, page, readiness `evaluate`, and close calls each carry their own
  timeout. In-test page calls stay bounded by the per-test timeout.

When the runner stops a run it kills the Playwright and dev server process
groups (SIGTERM, then SIGKILL after `REVIEWBOT_RESPONSIVENESS_KILL_GRACE_MS`,
default 5000), then writes the usual artifacts. `summary.md` reports
`Status: fail` and an `Aborted: <reason>` line, followed by a `Runner Abort`
section with the elapsed time, the deadline budget, whether Playwright had
started, and the last 40 non-blank dev server output lines. Those lines are
redacted for secret-shaped values, stripped of control characters, capped at
240 characters, and kept inside one code block. Partially written check
results are skipped. Runner exit codes:

```text
0    all checks passed
1    checks failed, or Playwright could not start
3    dev server exited, stopped responding, or never became ready
4    runner deadline reached
130  runner received SIGINT
143  runner received SIGTERM
```

The comment job treats an `Aborted:` summary as `Review did not run`, adds a
`- Reason: <reason>` line under the verdict, keeps the runner summary in the
details block, and skips the Opus visual pass, because partial screenshots
from a stopped run are not a fair basis for a visual verdict.

## Route Inference

The runner diffs the target PR base SHA against the checked-out head and maps
changed files to routes. It always includes a tiny shell canary:

```text
/
/waves
```

Global layout, provider, navigation, header, auth, style, package, or config
changes expand to a broader smoke set:

```text
/
/waves
/network
/the-memes
/meme-lab
/rememes
/notifications
/open-mobile?path=%2Fwaves
```

Component and app-route changes map to their closest stable page, capped by the
`max_pages` workflow input.

## Deterministic Checks

Each context/route check records:

- HTTP status.
- page errors and fatal console/hydration signals.
- horizontal document overflow.
- Next.js error overlay presence and concise overlay text, including open
  shadow-DOM text when available, capped before it is written to artifacts or
  sent to visual review.
- content readiness before screenshot capture. A route must render meaningful
  visible 6529 app content or shell evidence, such as visible text,
  interactive elements, media, landmarks, or known 6529 layout markers. Blank
  or near-empty captures fail instead of being passed to the visual reviewer as
  useful screenshots.
- late content recovery after screenshot capture. If the first readiness probe
  races route compilation but the screenshot is clearly nonblank, the runner
  re-reads DOM metrics after capture. When that late read confirms meaningful
  content and no Next.js error overlay, the route is reported with warnings for
  the late recovery and transient navigation timeout instead of a hard false
  failure.
- screenshot evidence quality when `sharp` is available in the target
  checkout. Near-white or near-uniform PNGs fail deterministically, even if the
  DOM reports content readiness, because humans and bots cannot use blank
  artifacts as visual evidence. Near-black screenshots with only a tiny
  framework badge are also treated as blank evidence so first-hit dev-server
  shells can use the transient route retry path.
- screenshot capture fallback. Full-page screenshots are preferred, but a
  content-ready page is not failed solely because Chromium times out while
  stitching a full-page screenshot. The runner retries with a viewport
  screenshot and reports that fallback as a warning; if both captures fail after
  content readiness, the missing evidence remains a warning with
  `screenshot unavailable`. If content never became ready, screenshot capture
  failure stays attached to the hard page failure.
- failed or blocked Next.js build asset requests. For 6529 PR-local dev-server
  runs the runner forces `ASSETS_FROM_S3=false` through
  `REVIEWBOT_RESPONSIVENESS_ASSETS_FROM_S3=false`, so checked-out PR
  `_next/static` and webpack assets are loaded from the local `_next` server
  instead of a production CloudFront `web_build` prefix. Local `/_next/image`
  optimizer requests for remote content images are not treated as build-asset
  leaks.
- bounded browser-based prewarm before assertions. The runner first performs
  lightweight HTTP prewarm and then visits planned routes in Chromium desktop
  and web-mobile contexts before parallel checks start. This lets
  Next.js/Turbopack finish route and client chunk compilation for both the
  desktop and SmallScreenLayout branches before screenshots are used as
  evidence without multiplying CI load by every simulated surface. The HTTP
  and browser stages share one default 180s wall-clock budget, with a default
  30s per-route browser timeout, and abort repeated metric-evaluation failures.
  Set `REVIEWBOT_RESPONSIVENESS_SKIP_BROWSER_PREWARM=true` only for local
  harness debugging; set `REVIEWBOT_RESPONSIVENESS_PREWARM_CONTEXTS=all` or a
  comma-separated context list only when debugging context-specific
  compilation.
- transient route retry. After prewarm, a first assertion attempt can still race
  a dev-server route compile. The runner retries only when the first attempt has
  no navigation response, no meaningful content, a blank/near-uniform screenshot,
  and a `page.goto` commit timeout. Persistent blanks still fail. The default
  attempt limit is two and can be tuned with
  `REVIEWBOT_RESPONSIVENESS_ROUTE_RETRY_ATTEMPTS`.
- target app endpoint isolation. The runner-started dev server ignores
  ambient target-repo `API_ENDPOINT` / `WS_ENDPOINT` values and supplies safe
  remote defaults through `REVIEWBOT_RESPONSIVENESS_API_ENDPOINT`,
  `REVIEWBOT_RESPONSIVENESS_WS_ENDPOINT`, and related namespaced overrides.
  This keeps local development shells that point at `localhost` from hijacking
  responsiveness runs.
- title, URL, viewport meta, body class, navigation/header/main presence, and
  content-readiness diagnostics.
- 6529 profile diagnostics when applicable: native shim/plugin state,
  `body.capacitor-native`, layout-root mobile/narrow/small markers, Electron
  branch detection, bottom navigation visibility, Android keyboard CSS
  variable, open-mobile handoff prompt, and profile-probe failures/warnings.
- a full-page screenshot when possible, otherwise a viewport screenshot with a
  fallback warning, or `screenshot unavailable` when content rendered but both
  capture modes timed out.

Hard failures fail the workflow. Non-fatal console errors and 4xx responses are
reported as warnings.

## Local Usage

From this repository:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --plan-only
```

For a real local run, install the frontend dependencies first and then omit
`--plan-only`:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --contexts web-desktop,web-mobile,native-mobile,electron-desktop \
  --max-pages 12 \
  --workers 4
```

Use the namespaced `REVIEWBOT_RESPONSIVENESS_*` variables when a local run must
target a non-default API or websocket endpoint. Do not rely on ambient
target-repo `API_ENDPOINT` values:

```bash
REVIEWBOT_RESPONSIVENESS_API_ENDPOINT=https://api.6529.io \
REVIEWBOT_RESPONSIVENESS_WS_ENDPOINT=wss://ws.6529.io \
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD
```

When a frontend server is already hot locally, reuse it instead of having
Playwright start one:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --base-url http://localhost:3001 \
  --reuse-existing-server
```

## Rollout Boundary

Do not add this workflow to frontend repositories or GitHub App webhook fanout
until benchmark data shows:

- typical trusted PR runtime is acceptable for developers;
- route inference catches the right pages;
- false positives are tolerable;
- native/Electron shims are useful enough to keep in the default mode;
- the runner has no production secrets or privileged AWS credentials.
