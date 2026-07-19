# STM32 Platform Release and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete learning platform offline-capable, deployable to GitHub Pages, understandable to a non-programmer, and auditable requirement by requirement with honest hardware status.

**Architecture:** Production build, documentation, automated evidence, and physical evidence remain separate artifacts. A release auditor consumes a checked-in requirement matrix plus machine-readable command/hardware evidence and refuses to label missing proof as passed; GitHub Actions repeats the deterministic software gate before Pages deployment.

**Tech Stack:** Vite PWA/Workbox, Playwright, GitHub Actions/Pages, TypeScript audit scripts, PowerShell verification runner, Markdown/JSON evidence.

## Global Constraints

- Static site has no login/backend/token and works from a GitHub Pages repository subpath.
- After one successful online load, core navigation, course text, assessments, progress, notes, and simulator remain usable offline.
- Web Serial still requires a supported secure-context browser and cannot reconnect without browser/user participation.
- Automated software evidence and real-hardware evidence have different requirement IDs and statuses.
- `passed` requires direct inspected evidence; missing, indirect, or simulated physical evidence is `pending` or `failed`.
- User documentation uses Chinese and explains first-use terminology in plain language.
- Release output lives in `outputs/`; intermediate logs live in `work/`.
- Every task is test-first where code is changed and ends with a focused commit.

---

## File Map

- `web/vite.config.ts`: PWA and GitHub Pages base-path production settings.
- `web/src/pwa/registerServiceWorker.ts`: update-ready/offline-ready state without forced reload/data loss.
- `web/src/components/OfflineStatus.tsx`: visible offline/update messages.
- `web/public/app-icon.svg`: code-native application icon.
- `.github/workflows/ci.yml`: full software gate.
- `.github/workflows/pages.yml`: tested Pages build/deploy.
- `docs/learner/getting-started.md`: first session for a non-programmer.
- `docs/learner/weekly-routine.md`: repeatable learning loop.
- `docs/learner/github-notes.md`: VS Code source-control note workflow.
- `docs/learner/backup-restore.md`: safe JSON backup/restore.
- `docs/learner/device-connection.md`: CH340/Web Serial/manual fallback.
- `docs/learner/troubleshooting.md`: tool, build, flash, serial, browser, and content recovery.
- `docs/verification/requirements.json`: authoritative evidence matrix.
- `docs/verification/hardware-smoke-test.md`: physical test procedure.
- `scripts/release/audit.test.ts`: audit logic tests.
- `scripts/release/audit.ts`: requirement evaluator/report generator.
- `scripts/release/verify-release.ps1`: deterministic command orchestrator.
- `outputs/stm32-learning-platform.zip`: distributable static site.
- `outputs/stm32-learning-platform-verification.md`: final human-readable result.
- `outputs/stm32-hardware-evidence.json`: real-device values/statuses.

### Task 1: Add safe offline operation and update handling

**Files:**
- Create: `web/src/pwa/registerServiceWorker.test.ts`
- Create: `web/src/pwa/registerServiceWorker.ts`
- Create: `web/src/components/OfflineStatus.test.tsx`
- Create: `web/src/components/OfflineStatus.tsx`
- Create: `web/public/app-icon.svg`
- Modify: `web/vite.config.ts`
- Modify: `web/src/main.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: browser service worker, online/offline events.
- Produces: `registerPlatformServiceWorker(onState)` and PWA-cached production build.

- [ ] **Step 1: Install PWA support and write failing state tests**

Run: `npm install --save-dev vite-plugin-pwa@latest`

Tests must prove `offline-ready`, `update-ready`, and `registration-error` are reported; updates wait for a visible user action; `OfflineStatus` uses `role="status"`, does not erase local progress, and distinguishes network offline from device disconnected.

- [ ] **Step 2: Run tests and verify registration/status modules are missing**

Run: `npm test -- --run web/src/pwa web/src/components/OfflineStatus.test.tsx`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Configure exact cache boundaries**

Extend `web/vite.config.ts`:

```ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'prompt',
  includeAssets: ['app-icon.svg'],
  manifest: {
    name: 'STM32 系统学习平台',
    short_name: 'STM32 学习',
    lang: 'zh-CN',
    start_url: '.',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#164e63',
    icons: [{ src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,json,md,svg,woff2}'],
    cleanupOutdatedCaches: true,
    navigateFallback: 'index.html',
  },
})
```

Append the plugin to the existing `plugins` array without duplicating React.

- [ ] **Step 4: Implement explicit service-worker state**

Create `registerServiceWorker.ts`:

```ts
import { registerSW } from 'virtual:pwa-register';

export type PwaState =
  | { kind: 'offline-ready' }
  | { kind: 'update-ready'; apply: () => Promise<void> }
  | { kind: 'registration-error'; message: string };

export function registerPlatformServiceWorker(onState: (state: PwaState) => void): void {
  const update = registerSW({
    immediate: true,
    onOfflineReady: () => onState({ kind: 'offline-ready' }),
    onNeedRefresh: () => onState({ kind: 'update-ready', apply: () => update(true) }),
    onRegisterError: (error) => onState({ kind: 'registration-error', message: String(error) }),
  });
}
```

Add the generated `vite-plugin-pwa/client` types to `web/tsconfig.json`. `OfflineStatus` listens to `window.online/offline`, displays an update button, and never reloads automatically while notes or an assessment form are open.

- [ ] **Step 5: Verify offline behavior in Chromium**

Add a Playwright test that loads the production preview once, switches the browser context offline, reloads the hash route, opens week map/lesson/assessment/report, edits a note, and confirms data persists. Device console must explain that serial reconnection is separate from site offline readiness.

Run:

```powershell
npm test -- --run web/src/pwa web/src/components/OfflineStatus.test.tsx
npm run build
npm run test:e2e -- web/e2e/offline.spec.ts
```

Expected: unit tests pass and the cached journey works offline after the first load.

- [ ] **Step 6: Commit offline support**

```powershell
git add package.json package-lock.json web
git commit -m "feat: support safe offline learning"
```

### Task 2: Add CI and GitHub Pages deployment gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`
- Create: `scripts/release/workflow-contract.test.ts`

**Interfaces:**
- Consumes: all deterministic npm and firmware-host commands.
- Produces: GitHub Pages deployment only after validation/tests/build pass.

- [ ] **Step 1: Write workflow contract tests before editing YAML**

Parse both workflow YAML files and assert CI includes `npm ci`, content validation, unit tests, typecheck, web build, Playwright Chromium, and host C tests. Assert Pages has `pages: write`, `id-token: write`, correct `BASE_PATH`, artifact path `dist`, and deploy job dependency on build.

Run `npm install --save-dev yaml@latest` before creating the test; use `parse` from `yaml` rather than indentation-sensitive regular expressions.

- [ ] **Step 2: Run the workflow test and observe missing release coverage**

Run: `npm test -- --run scripts/release/workflow-contract.test.ts`

Expected: FAIL because `pages.yml` does not exist and CI lacks later gates.

- [ ] **Step 3: Expand CI with deterministic software checks**

Keep Node 22 and `npm ci`; install Chromium with `npx playwright install --with-deps chromium`; run:

```yaml
- run: npm run validate:content
- run: npm test
- run: npm run typecheck
- run: npm run build
- run: npm run test:e2e -- --project=desktop-chromium
- run: cmake -S firmware/device-test/host-tests -B work/device-host-tests -G Ninja
- run: cmake --build work/device-host-tests
- run: ctest --test-dir work/device-host-tests --output-on-failure
```

Do not run ARM firmware builds in GitHub-hosted CI until the repository explicitly installs the same arm-none-eabi toolchain; local release verification remains authoritative for all 22 ARM targets (21 lesson targets plus device-test).

- [ ] **Step 4: Add Pages workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run validate:content
      - run: npm test
      - run: npm run typecheck
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Verify and commit workflows**

Run:

```powershell
npm test -- --run scripts/release/workflow-contract.test.ts
$env:BASE_PATH='/stm32-learning-platform/'; npm run build; Remove-Item Env:BASE_PATH
```

Expected: workflow test passes; `dist/index.html` references assets under `/stm32-learning-platform/`.

```powershell
git add .github scripts/release/workflow-contract.test.ts
git commit -m "ci: gate and deploy GitHub Pages"
```

### Task 3: Write the complete non-programmer learner documentation

**Files:**
- Create: `docs/learner/getting-started.md`
- Create: `docs/learner/weekly-routine.md`
- Create: `docs/learner/github-notes.md`
- Create: `docs/learner/backup-restore.md`
- Create: `docs/learner/device-connection.md`
- Create: `docs/learner/troubleshooting.md`
- Modify: `README.md`
- Create: `scripts/content-validation/learner-docs.test.ts`

**Interfaces:**
- Consumes: actual commands/routes/file names.
- Produces: a start-to-recovery guide usable without prior programming knowledge.

- [ ] **Step 1: Write failing documentation contract tests**

Assert every document exists, uses Chinese headings, has no dead relative links, and contains these named recovery paths:

```text
找不到编译器, CubeMX 生成失败, CMake 构建失败, ST-LINK 无法连接,
程序下载后无现象, CH340 无串口, 浏览器不支持 Web Serial,
串口授权被拒绝, 固件版本不匹配, 备份导入失败, 恢复旧数据
```

Assert README links the first-session, weekly, notes, backup, device, troubleshooting, design, and verification documents.

- [ ] **Step 2: Run tests and verify learner documents are absent**

Run: `npm test -- --run scripts/content-validation/learner-docs.test.ts`

Expected: FAIL with the missing document list.

- [ ] **Step 3: Author the first-session and weekly guides**

`getting-started.md` covers hardware inventory, disconnect-first safety, tool purpose, four environment commands, opening the local site, entry diagnostic, first backup, and where to stop when evidence is pending. `weekly-routine.md` uses the approved nine-step loop: precheck, understand, configure, build, observe, break, explain, assess, note.

- [ ] **Step 4: Author Git/backup/device guides using exact UI labels**

`github-notes.md` describes the VS Code “源代码管理” icon, changed-file review, message, commit, sync, and conflict stop point without requiring terminal Git. `backup-restore.md` states what JSON includes, how current data is snapshotted, and how to recover. `device-connection.md` shows PA9/PA10/GND, 3.3 V TTL, one power source, permission click, firmware handshake, simulator warning, and manual fallback.

- [ ] **Step 5: Author troubleshooting as evidence-driven trees**

For every named problem, list: visible symptom, first safe check, next evidence, likely causes, corrective action, and stop/escalation point. Never tell a learner to rewire powered hardware or repeatedly erase FLASH without confirming the reserved address.

- [ ] **Step 6: Verify and commit learner documentation**

Run:

```powershell
npm test -- --run scripts/content-validation/learner-docs.test.ts
npm run validate:content
```

Expected: document/link/recovery contracts pass.

```powershell
git add README.md docs/learner scripts/content-validation/learner-docs.test.ts
git commit -m "docs: guide non-programmers through learning and recovery"
```

### Task 4: Build a requirement-by-requirement release auditor

**Files:**
- Create: `docs/verification/requirements.json`
- Create: `scripts/release/audit.test.ts`
- Create: `scripts/release/audit.ts`
- Create: `scripts/release/verify-release.ps1`
- Modify: `package.json`

**Interfaces:**
- Consumes: checked-in artifacts and `work/release-evidence.json`.
- Produces: `ReleaseAudit`, non-zero exit on missing required software evidence, and `outputs/stm32-learning-platform-verification.md`.

- [ ] **Step 1: Create the exact requirement matrix**

Use IDs:

```text
SKILLS, TOOLCHAIN, COURSE_MAP, COURSE_CONTENT, HARDWARE_SAFETY,
WEB_GUIDANCE, LOCAL_PROGRESS, SCORING, PHASE_GATES, REMEDIATION,
EXTENSIONS, NOTES, BACKUP, DEVICE_PROTOCOL, DEVICE_SIMULATOR,
FIRMWARE_BUILD, WEB_BUILD, BROWSER_E2E, OFFLINE, GITHUB_PAGES,
LEARNER_DOCS, REAL_HARDWARE
```

Each JSON record contains `id`, Chinese `requirement`, `evidenceKind` (`file`, `command`, `deployment`, or `hardware`), exact `evidenceKeys`, and `requiredForSoftwareRelease`. Set `REAL_HARDWARE` false for software-package release but true for the full goal completion decision; represent this with a separate `requiredForGoalCompletion: true` field.

- [ ] **Step 2: Write failing auditor truthfulness tests**

Test five states: direct pass evidence → passed; command absent → pending; non-zero command → failed; simulator evidence for `REAL_HARDWARE` → pending with explicit reason; Pages URL absent → pending. Test that the Markdown summary never uses `全部完成` while any goal-completion requirement is pending/failed.

- [ ] **Step 3: Run tests and verify auditor is missing**

Run: `npm test -- --run scripts/release/audit.test.ts`

Expected: FAIL because `audit.ts` does not exist.

- [ ] **Step 4: Implement typed evaluation and Markdown report**

Use:

```ts
export type AuditStatus = 'passed' | 'pending' | 'failed';
export interface AuditResult { id: string; status: AuditStatus; summary: string; evidence: string[] }
export interface ReleaseAudit { softwareReleaseReady: boolean; goalComplete: boolean; generatedAt: string; results: AuditResult[] }
export async function auditRelease(root: string, evidencePath: string): Promise<ReleaseAudit>;
export function renderAuditMarkdown(audit: ReleaseAudit): string;
```

The evaluator checks paths, parses command/deployment/hardware evidence, and calculates `softwareReleaseReady` and `goalComplete` independently. Unknown evidence keys are errors rather than ignored fields.

- [ ] **Step 5: Implement the command orchestrator**

`verify-release.ps1` runs these commands one by one, captures command, exit code, start/end time, and log path under `work/release-logs/`, then writes UTF-8 `work/release-evidence.json`:

```text
npm ci
npm run validate:content
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run build:firmware
host CMake build and CTest
git diff --check
```

If one command fails, continue collecting later independent evidence but return non-zero after generating the report. Do not delete existing logs or hardware evidence.

Add scripts:

```json
{
  "audit": "tsx scripts/release/audit.ts",
  "verify:release": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release/verify-release.ps1"
}
```

- [ ] **Step 6: Verify and commit the auditor**

Run: `npm test -- --run scripts/release/audit.test.ts`

Expected: truthfulness cases pass.

```powershell
git add docs/verification/requirements.json scripts/release package.json
git commit -m "feat: audit release evidence requirement by requirement"
```

### Task 5: Define and execute the real-hardware smoke test

**Files:**
- Create: `docs/verification/hardware-smoke-test.md`
- Create: `outputs/stm32-hardware-evidence.json`
- Create: `scripts/release/hardware-evidence.test.ts`

**Interfaces:**
- Consumes: physical STM32F103C8T6, ST-LINK, CH340, jumpers, MPU6050, W25Q64, detection firmware.
- Produces: machine-readable physical evidence; no inferred status.

- [ ] **Step 1: Create a pending evidence file and failing completeness test**

The JSON has `schemaVersion: 1`, board/adapter labels, firmware version, tester, started/finished times, and these required checks initially set to `pending` with empty actual values:

```text
flash-and-boot, serial-handshake, chip-id, disconnect-reconnect,
gpio-loopback, pwm-capture-loopback, mpu6050-id, w25q64-id,
w25q64-roundtrip-restore, rtc-bkp, watchdog-reset-cause,
internal-flash-roundtrip-restore, manual-led, manual-buzzer,
manual-servo-motor, pwr-wake, pwr-current
```

The test accepts `pending` as honest data but sets `goalComplete=false`; it rejects `passed` without timestamp, actual values, connection notes, and evidence source.

- [ ] **Step 2: Write the exact safe procedure**

`hardware-smoke-test.md` orders work as:

1. Inspect unpowered wiring and select 3.3 V TTL/one power source.
2. Build and flash detection firmware through ST-LINK.
3. Connect Chrome/Edge, record handshake, chip ID, and reconnect.
4. Power off, add GPIO/PWM loopback jumpers, power on, run both.
5. Power off, connect MPU6050, power on, read ID.
6. Power off, connect W25Q64, power on, read ID and run reserved-region restore test.
7. Run RTC/BKP, watchdog, and internal FLASH restore sequences, recording reset cause.
8. Run LED/buzzer/servo/motor manual observations with correct load power.
9. Run PWR wake test; measure current only with a suitable meter and setup.
10. Export logs and update each JSON check individually.

Every failure step states to stop the dependent tests and preserve the log.

- [ ] **Step 3: Execute when physical hardware is accessible**

Run the procedure, replace only observed check entries, and attach serial log filenames/photos/meter readings where available. If hardware is not accessible, leave entries pending and do not change the full-goal status.

- [ ] **Step 4: Validate evidence honesty and commit the procedure/status**

Run: `npm test -- --run scripts/release/hardware-evidence.test.ts`

Expected: schema/honesty test passes; completeness reports either all physical checks passed or a named pending/failed list.

```powershell
git add docs/verification/hardware-smoke-test.md outputs/stm32-hardware-evidence.json scripts/release/hardware-evidence.test.ts
git commit -m "test: record STM32 hardware verification status"
```

### Task 6: Deploy, audit, and package the user-facing release

**Files:**
- Create/Update: `outputs/stm32-learning-platform.zip`
- Create/Update: `outputs/stm32-learning-platform-verification.md`
- Create: `outputs/README.md`
- Modify: `work/release-evidence.json` (untracked intermediate evidence)

**Interfaces:**
- Consumes: all implementation plans, GitHub remote/Pages state, optional physical evidence.
- Produces: distributable site and final audit.

- [ ] **Step 1: Run the full release gate from a clean dependency install**

Run: `npm run verify:release`

Expected: all software commands pass; report explicitly lists Pages and hardware as passed/pending/failed from direct evidence.

- [ ] **Step 2: Inspect the production bundle locally**

Run production preview with a repository-style base path, open desktop and mobile Chromium, check first-use, map, lesson, assessment, remediation, notes, backup, simulator, offline reload, and error routes. Record the Playwright report/log path in evidence JSON.

- [ ] **Step 3: Publish and verify GitHub Pages when a remote is authorized**

Push `main`, enable GitHub Pages “GitHub Actions” source, wait for `Deploy Pages`, then open the reported URL in a fresh browser profile. Record URL, commit SHA, workflow run URL, timestamp, HTTP success, asset load, hash navigation, IndexedDB save/reload, and Web Serial availability in `work/release-evidence.json`.

If no authorized remote exists, record `GITHUB_PAGES` as pending; do not invent a URL or mark the full goal complete.

- [ ] **Step 4: Re-run the auditor with deployment/hardware evidence**

Run: `npm run audit -- --evidence work/release-evidence.json --hardware outputs/stm32-hardware-evidence.json`

Expected: `softwareReleaseReady=true` only if every software/deployment requirement passes; `goalComplete=true` only if every full-goal requirement, including real hardware, passes.

- [ ] **Step 5: Create the exact user-facing package**

Compress the contents of `dist/` (not the `dist` parent directory) to `outputs/stm32-learning-platform.zip`. `outputs/README.md` links the verification report and explains: unzip/serve locally, preferred GitHub Pages URL when present, Chrome/Edge device requirement, backup before updates, and hardware status.

- [ ] **Step 6: Verify package identity and repository cleanliness**

Record SHA-256 of the ZIP and final commit in the verification report. Extract the ZIP to a new `work/package-smoke/` directory, serve it, rerun the basic Playwright smoke path, and compare expected built asset count. Then run:

```powershell
git diff --check
git status --short
```

Expected: only intentionally regenerated, committed output artifacts appear before the final release commit.

- [ ] **Step 7: Commit the audited release artifacts**

```powershell
git add outputs README.md
git commit -m "release: package verified STM32 learning platform"
```

## Release Acceptance

- [ ] Core site works online and offline after first load.
- [ ] CI and Pages deployment repeat validation/test/typecheck/build gates.
- [ ] Non-programmer docs cover setup, weekly use, Git notes, backup, device connection, and recovery.
- [ ] Audit matrix directly covers all approved design requirements.
- [ ] Software readiness and full-goal completion are calculated separately.
- [ ] Real-hardware results contain actual values and evidence, or remain honestly pending.
- [ ] ZIP smoke test succeeds from a fresh extraction.
- [ ] Verification report contains commit, package hash, deployment URL/status, automatic results, hardware status, and known limitations.
- [ ] Full goal is not marked complete while any full-goal requirement is pending or failed.
- [ ] `git status --short` is empty after the final release commit.
