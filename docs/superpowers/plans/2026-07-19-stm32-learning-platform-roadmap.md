# STM32 Learning Platform Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the complete 24-week STM32 learning platform defined in the approved design specification.

**Architecture:** One static React + TypeScript application consumes versioned course, lab, assessment, and remediation content from the repository. Pure domain modules own scoring and diagnostics, IndexedDB owns local learner state, and a transport-independent device layer connects either Web Serial or a simulator to the same evidence recorder.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Playwright, Zod, IndexedDB through `idb`, Web Serial, STM32CubeMX, STM32CubeCLT, CMake, Ninja, STM32 HAL/LL, GitHub Actions, GitHub Pages.

## Global Constraints

- Target learner has no programming background; first use of every technical term includes a one-sentence plain-language explanation.
- Target board is STM32F103C8T6; GPIO logic is 3.3 V and motor/servo loads use separate suitable power with common ground.
- Learning pace is 6–8 hours per week for 24 weeks, with pause, resume, entry diagnostic, and remediation.
- Source range 05–49 includes split lessons 06-1 and 06-2, for exactly 46 source lessons.
- HAL is the main implementation path; LL/register observation is added at key points and SPL appears only as a migration map.
- The web application is a static GitHub Pages site with no login, server, cloud database, or GitHub token.
- Progress is local, JSON backup is versioned, and learning notes export as Markdown.
- Web Serial requires explicit user activation and Chrome/Edge; unsupported browsers retain the manual-evidence path.
- Simulator evidence never proves physical hardware behavior; unperformed hardware checks remain `待实机验证`.
- Every production change follows TDD, includes exact verification evidence, and ends in a focused Git commit.

---

## Plan Order and Completion Gates

1. `2026-07-19-stm32-platform-foundation.md`
   - Produces the runnable repository, content contracts, 24-week source map, validator, and CI baseline.
   - Gate: `npm test`, `npm run validate:content`, `npm run typecheck`, and `npm run build` pass.
2. `2026-07-19-stm32-learning-core.md`
   - Produces progress storage, scoring, phase gates, remediation, lesson/assessment UI, notes, and backup.
   - Gate: unit, component, and core Playwright journeys pass.
3. `2026-07-19-stm32-curriculum-firmware.md`
   - Produces detailed 24-week content, all rubrics and labs, CubeMX projects, and firmware build matrix.
   - Gate: all 46 source IDs are covered and every required peripheral has concept, lab, assessment, and fault task.
4. `2026-07-19-stm32-device-console.md`
   - Produces the JSON Lines protocol, simulator, Web Serial console, evidence integration, and device-test firmware.
   - Gate: simulator fault matrix and firmware build pass; real hardware remains explicitly pending until connected.
5. `2026-07-19-stm32-release-verification.md`
   - Produces offline support, GitHub Pages workflows, non-programmer documentation, completion audit, and hardware evidence report.
   - Gate: every design requirement has direct evidence or an explicit `待实机验证` state.

## Shared Interface Registry

The five plans use these names consistently:

```ts
export type EvidenceKind = 'concept' | 'configuration' | 'practical' | 'reflection';
export type EvidenceStatus = 'auto-pass' | 'manual-confirmed' | 'pending' | 'failed';
export type MasteryBand = 'mastered' | 'review' | 'remediate' | 'relearn';

export interface EvidenceRecord {
  id: string;
  learnerId: 'local';
  lessonId: string;
  tagIds: string[];
  kind: EvidenceKind;
  status: EvidenceStatus;
  score: number;
  source: 'assessment' | 'device' | 'manual' | 'note';
  createdAt: string;
  details: Record<string, string | number | boolean>;
}

export interface DeviceTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeLine(line: string): Promise<void>;
  readChunks(signal?: AbortSignal): AsyncIterable<string>;
}
```

`calculateLessonScore`, `calculateTagMastery`, `evaluatePhaseGate`, `buildRemediationQueue`, `exportBackup`, `importBackup`, and `runDeviceTest` are defined once in their owning plans and imported everywhere else.

## Design-to-Plan Coverage

| Approved design requirement | Owning plan/task | Direct completion evidence |
|---|---|---|
| Verified skills/toolchain and Git-friendly repository | Foundation Tasks 1 and 5 | setup document, package lock, CI commands |
| Structured content and module boundaries | Foundation Tasks 2–4 | shared Zod contracts and validated 24-week map |
| Zero-foundation entry, diagnostic skip, pause/resume | Learning Core Tasks 4–5 | diagnostic/resume unit tests and dashboard journey |
| 25/25/35/15 scoring, mastery bands, four-week gates | Learning Core Tasks 2–3 | pure-function threshold tests |
| Deterministic knowledge-gap remediation | Learning Core Task 3; Curriculum Task 8 | lowest-three tests and complete remediation modules |
| Local progress, Markdown notes, safe JSON backup | Learning Core Tasks 1 and 6 | IndexedDB, export, rollback tests |
| 24 weeks and all 46 source lessons | Curriculum Tasks 1–8 | repository validator and source-ID union check |
| GPIO through FLASH concepts/labs/assessments | Curriculum Tasks 2–7 | per-phase coverage tests and 21 firmware builds |
| HAL mainline, LL/register observation, SPL migration | Curriculum Tasks 2–8 | lesson heading checks, firmware, SPL→HAL index |
| Cross-course FreeRTOS/control/FPGA/PLA bridges | Curriculum Task 7 | six extension records with mastery entry conditions |
| Web Serial, simulator, safety, honest evidence | Device Console Tasks 1–8 | protocol, failure matrix, UI, host-C and ARM builds |
| Offline site, Pages, learner docs | Release Tasks 1–3 | offline E2E, workflows, documentation contracts |
| Requirement audit, package, physical verification | Release Tasks 4–6 | evidence matrix, ZIP smoke test, hardware JSON |

Every design section has one owning task and one stated evidence source; later plans may consume that result but must not redefine it.

## Portfolio Completion Check

- [ ] All five implementation plans have been executed in order.
- [ ] The design-to-task matrix in the release plan has no missing requirement.
- [ ] The repository is clean and every automatic verification command is green.
- [ ] The user-facing output contains a runnable site bundle, verification report, and real-hardware checklist.
- [ ] The goal is not marked complete while any required evidence is absent or only inferred.
