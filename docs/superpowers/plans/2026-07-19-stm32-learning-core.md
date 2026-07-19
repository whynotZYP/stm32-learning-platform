# STM32 Learning Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local-first learning experience: navigation, progress, evidence, scoring, phase gates, remediation, assessment, notes, and safe backup/restore.

**Architecture:** Pure TypeScript functions calculate scores and recommendations; they never access the DOM or database. A small repository interface owns IndexedDB persistence, while React pages consume domain services through context so tests can inject an in-memory repository.

**Tech Stack:** React, TypeScript, React Router, Zod, `idb`, IndexedDB, Vitest, Testing Library, Playwright.

## Global Constraints

- No login, backend, cloud database, analytics identifier, or GitHub token.
- Learner records use `learnerId: 'local'`; all timestamps are ISO 8601 UTC strings.
- Rubric weights are concept 25%, configuration/code reading 25%, practical/troubleshooting 35%, reflection/notes 15%.
- Mastery uses the newest three valid tag-evidence scores with weights 50%, 30%, and 20%, normalized when fewer exist.
- Bands are 85–100 mastered, 70–84 review, 60–69 remediate, and below 60 relearn.
- A four-week gate passes only when phase average ≥75, every prerequisite tag ≥70, and practical average ≥70.
- Failed gates do not hide content; they prevent the phase from being marked complete and add at most three explained remediation items.
- Backup import validates first, snapshots current data, writes to a temporary record, verifies it, and only then replaces active state.
- Every task uses tests first and ends with an independent commit.

---

## File Map

- `web/src/domain/progress/types.ts`: learner, evidence, score, mastery, gate, remediation, and backup types.
- `web/src/domain/progress/defaultState.ts`: the only empty-state factory.
- `web/src/domain/progress/repository.ts`: persistence interface.
- `web/src/infrastructure/indexedDbProgressRepository.ts`: IndexedDB implementation and migration.
- `web/src/domain/scoring/lessonScore.ts`: rubric weighting.
- `web/src/domain/scoring/mastery.ts`: evidence-to-tag mastery calculation.
- `web/src/domain/scoring/phaseGate.ts`: four-week gate evaluation.
- `web/src/domain/remediation/buildRemediationQueue.ts`: deterministic remediation generation.
- `web/src/domain/backup/backup.ts`: versioned export/import validation.
- `web/src/domain/notes/toMarkdown.ts`: GitHub-friendly note rendering.
- `web/src/app/ProgressContext.tsx`: repository and state boundary.
- `web/src/app/router.tsx`: hash routes suitable for GitHub Pages.
- `web/src/pages/*`: dashboard, map, week, assessment, report, notes/settings.
- `web/src/components/*`: focused presentational controls.
- `web/src/styles.css`: responsive, keyboard-visible, non-color-only states.
- `web/e2e/learning-core.spec.ts`: browser-level learning and recovery journeys.

### Task 1: Persist versioned learner state in IndexedDB

**Files:**
- Create: `web/src/domain/progress/types.ts`
- Create: `web/src/domain/progress/defaultState.ts`
- Create: `web/src/domain/progress/schemas.ts`
- Create: `web/src/domain/progress/migrateState.test.ts`
- Create: `web/src/domain/progress/migrateState.ts`
- Create: `web/src/domain/progress/repository.ts`
- Create: `web/src/infrastructure/indexedDbProgressRepository.test.ts`
- Create: `web/src/infrastructure/indexedDbProgressRepository.ts`

**Interfaces:**
- Consumes: browser IndexedDB.
- Produces: `ProgressRepository` with `load`, `save`, `snapshot`, and `replace` methods.

- [ ] **Step 1: Install persistence test dependencies**

Run:

```powershell
npm install idb@latest
npm install --save-dev fake-indexeddb@latest
```

Expected: `npm ls idb fake-indexeddb` exits 0 and `package-lock.json` changes.

- [ ] **Step 2: Define the actual domain types**

Create `web/src/domain/progress/types.ts`:

```ts
export type EvidenceKind = 'concept' | 'configuration' | 'practical' | 'reflection';
export type EvidenceStatus = 'auto-pass' | 'manual-confirmed' | 'pending' | 'failed';
export type EvidenceSource = 'assessment' | 'device' | 'manual' | 'note';
export type MasteryBand = 'mastered' | 'review' | 'remediate' | 'relearn';

export interface EvidenceRecord {
  id: string;
  learnerId: 'local';
  lessonId: string;
  tagIds: string[];
  kind: EvidenceKind;
  status: EvidenceStatus;
  score: number;
  source: EvidenceSource;
  createdAt: string;
  details: Record<string, string | number | boolean>;
}

export interface LessonProgress {
  lessonId: string;
  status: 'not-started' | 'in-progress' | 'completed';
  rubricScores: Partial<Record<EvidenceKind, number>>;
  completedAt?: string;
}

export interface RemediationItem {
  id: string;
  tagId: string;
  reason: string;
  action: 'concept-breakdown' | 'signal-to-register' | 'minimal-lab' | 'shared-protocol-foundation' | 'prerequisite-reset';
  status: 'queued' | 'in-progress' | 'completed';
}

export interface LearnerState {
  schemaVersion: 1;
  learnerId: 'local';
  currentWeek: number;
  lessonProgress: Record<string, LessonProgress>;
  evidence: EvidenceRecord[];
  remediationQueue: RemediationItem[];
  notes: Record<string, string>;
  completedPhaseIds: number[];
  updatedAt: string;
}

export interface BackupEnvelope {
  format: 'stm32-learning-platform-backup';
  schemaVersion: 1;
  exportedAt: string;
  state: LearnerState;
}
```

Create `web/src/domain/progress/defaultState.ts`:

```ts
import type { LearnerState } from './types';

export function createDefaultState(now = new Date().toISOString()): LearnerState {
  return {
    schemaVersion: 1,
    learnerId: 'local',
    currentWeek: 1,
    lessonProgress: {},
    evidence: [],
    remediationQueue: [],
    notes: {},
    completedPhaseIds: [],
    updatedAt: now,
  };
}
```

Create `web/src/domain/progress/repository.ts`:

```ts
import type { LearnerState } from './types';

export interface ProgressRepository {
  load(): Promise<LearnerState>;
  save(state: LearnerState): Promise<void>;
  snapshot(): Promise<LearnerState>;
  replace(state: LearnerState): Promise<void>;
}
```

Create `web/src/domain/progress/schemas.ts`:

```ts
import { z } from 'zod';

const EvidenceKindSchema = z.enum(['concept', 'configuration', 'practical', 'reflection']);
const EvidenceStatusSchema = z.enum(['auto-pass', 'manual-confirmed', 'pending', 'failed']);
const DetailValueSchema = z.union([z.string(), z.number().finite(), z.boolean()]);

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1), learnerId: z.literal('local'), lessonId: z.string().min(1), tagIds: z.array(z.string().min(1)),
  kind: EvidenceKindSchema, status: EvidenceStatusSchema, score: z.number().min(0).max(100),
  source: z.enum(['assessment', 'device', 'manual', 'note']), createdAt: z.string().datetime(), details: z.record(z.string(), DetailValueSchema),
});
export const LessonProgressSchema = z.object({
  lessonId: z.string().min(1), status: z.enum(['not-started', 'in-progress', 'completed']),
  rubricScores: z.partialRecord(EvidenceKindSchema, z.number().min(0).max(100)), completedAt: z.string().datetime().optional(),
});
export const RemediationItemSchema = z.object({
  id: z.string().min(1), tagId: z.string().min(1), reason: z.string().min(1),
  action: z.enum(['concept-breakdown', 'signal-to-register', 'minimal-lab', 'shared-protocol-foundation', 'prerequisite-reset']),
  status: z.enum(['queued', 'in-progress', 'completed']),
});
export const LearnerStateSchema = z.object({
  schemaVersion: z.literal(1), learnerId: z.literal('local'), currentWeek: z.number().int().min(1).max(24),
  lessonProgress: z.record(z.string(), LessonProgressSchema), evidence: z.array(EvidenceRecordSchema),
  remediationQueue: z.array(RemediationItemSchema), notes: z.record(z.string(), z.string()),
  completedPhaseIds: z.array(z.number().int().min(1).max(6)), updatedAt: z.string().datetime(),
});
```

Create `web/src/domain/progress/migrateState.ts`:

```ts
import { z } from 'zod';
import { createDefaultState } from './defaultState';
import { LearnerStateSchema } from './schemas';
import type { LearnerState } from './types';

const PrototypeStateSchema = z.object({
  schemaVersion: z.undefined().optional(),
  currentWeek: z.number().int().min(1).max(24).optional(),
  notes: z.record(z.string(), z.string()).optional(),
  updatedAt: z.string().datetime().optional(),
});

export function migrateLearnerState(input: unknown, now = new Date().toISOString()): LearnerState {
  const current = LearnerStateSchema.safeParse(input);
  if (current.success) return current.data;
  const prototype = PrototypeStateSchema.safeParse(input);
  if (prototype.success) return { ...createDefaultState(prototype.data.updatedAt ?? now), currentWeek: prototype.data.currentWeek ?? 1, notes: prototype.data.notes ?? {} };
  throw new Error('不支持或已损坏的进度数据版本');
}
```

- [ ] **Step 3: Write failing persistence and migration tests**

Create `web/src/domain/progress/migrateState.test.ts` with one prototype record lacking `schemaVersion` and assert it retains `currentWeek`/`notes` while gaining a valid version-1 state. Add a second case `{ schemaVersion: 2 }` and assert the exact error `不支持或已损坏的进度数据版本`.

Create `web/src/infrastructure/indexedDbProgressRepository.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../domain/progress/defaultState';
import { createIndexedDbProgressRepository } from './indexedDbProgressRepository';

const dbName = 'stm32-learning-platform-test';

afterEach(async () => deleteDB(dbName));

describe('IndexedDB progress repository', () => {
  it('returns a versioned empty state on first use', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    const state = await repository.load();
    expect(state.schemaVersion).toBe(1);
    expect(state.currentWeek).toBe(1);
    expect(Date.parse(state.updatedAt)).not.toBeNaN();
  });

  it('saves and replaces state without sharing mutable references', async () => {
    const repository = createIndexedDbProgressRepository(dbName);
    const state = createDefaultState('2026-07-19T00:00:00.000Z');
    state.currentWeek = 4;
    await repository.save(state);
    const loaded = await repository.load();
    loaded.currentWeek = 8;
    expect((await repository.load()).currentWeek).toBe(4);
    await repository.replace({ ...loaded, currentWeek: 8 });
    expect((await repository.load()).currentWeek).toBe(8);
  });
});
```

- [ ] **Step 4: Run the tests and verify the repository is missing**

Run: `npm test -- --run web/src/domain/progress/migrateState.test.ts web/src/infrastructure/indexedDbProgressRepository.test.ts`

Expected: FAIL because `indexedDbProgressRepository.ts` does not exist.

- [ ] **Step 5: Implement the repository with one owned state record**

Create `web/src/infrastructure/indexedDbProgressRepository.ts`:

```ts
import { openDB, type DBSchema } from 'idb';
import { createDefaultState } from '../domain/progress/defaultState';
import { migrateLearnerState } from '../domain/progress/migrateState';
import type { ProgressRepository } from '../domain/progress/repository';
import { LearnerStateSchema } from '../domain/progress/schemas';

interface LearningDb extends DBSchema {
  state: { key: 'active' | 'snapshot' | 'incoming'; value: unknown };
}

const clone = <T>(value: T): T => structuredClone(value);

export function createIndexedDbProgressRepository(dbName = 'stm32-learning-platform'): ProgressRepository {
  const database = openDB<LearningDb>(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
    },
  });

  return {
    async load() {
      const db = await database;
      const state = await db.get('state', 'active');
      if (state) return clone(migrateLearnerState(state));
      const initial = createDefaultState();
      await db.put('state', initial, 'active');
      return clone(initial);
    },
    async save(state) {
      const db = await database;
      await db.put('state', LearnerStateSchema.parse(clone(state)), 'active');
    },
    async snapshot() {
      const db = await database;
      const active = migrateLearnerState((await db.get('state', 'active')) ?? createDefaultState());
      await db.put('state', clone(active), 'snapshot');
      return clone(active);
    },
    async replace(state) {
      const db = await database;
      const transaction = db.transaction('state', 'readwrite');
      await transaction.store.put(clone(state), 'incoming');
      const verified = migrateLearnerState(await transaction.store.get('incoming'));
      await transaction.store.put(clone(verified), 'active');
      await transaction.store.delete('incoming');
      await transaction.done;
    },
  };
}
```

- [ ] **Step 6: Verify and commit persistence**

Run: `npm test -- --run web/src/domain/progress/migrateState.test.ts web/src/infrastructure/indexedDbProgressRepository.test.ts`

Expected: four tests pass: two migration cases and two repository cases.

```powershell
git add package.json package-lock.json web/src/domain/progress web/src/infrastructure
git commit -m "feat: persist versioned learner progress"
```

### Task 2: Implement lesson scoring and tag mastery

**Files:**
- Create: `web/src/domain/scoring/lessonScore.test.ts`
- Create: `web/src/domain/scoring/lessonScore.ts`
- Create: `web/src/domain/scoring/mastery.test.ts`
- Create: `web/src/domain/scoring/mastery.ts`

**Interfaces:**
- Consumes: `EvidenceRecord`.
- Produces: `calculateLessonScore(scores): number` and `calculateTagMastery(tagId, evidence): TagMastery`.

- [ ] **Step 1: Write failing exact-weight tests**

Create `web/src/domain/scoring/lessonScore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateLessonScore } from './lessonScore';

describe('calculateLessonScore', () => {
  it('uses 25/25/35/15 weights and rounds once', () => {
    expect(calculateLessonScore({ concept: 80, configuration: 60, practical: 100, reflection: 40 })).toBe(76);
  });

  it('does not award a completed score while a rubric dimension is absent', () => {
    expect(() => calculateLessonScore({ concept: 80, configuration: 80, practical: 80 })).toThrow('缺少评分项：reflection');
  });
});
```

Create `web/src/domain/scoring/mastery.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '../progress/types';
import { calculateTagMastery } from './mastery';

const evidence = (score: number, createdAt: string, status: EvidenceRecord['status'] = 'auto-pass'): EvidenceRecord => ({
  id: `${score}-${createdAt}`,
  learnerId: 'local',
  lessonId: 'w04-gpio-output',
  tagIds: ['gpio.output-mode'],
  kind: 'concept',
  status,
  score,
  source: 'assessment',
  createdAt,
  details: {},
});

describe('calculateTagMastery', () => {
  it('weights newest three valid scores 50/30/20', () => {
    const result = calculateTagMastery('gpio.output-mode', [
      evidence(60, '2026-01-01T00:00:00.000Z'),
      evidence(70, '2026-02-01T00:00:00.000Z'),
      evidence(80, '2026-03-01T00:00:00.000Z'),
      evidence(90, '2026-04-01T00:00:00.000Z'),
    ]);
    expect(result.score).toBe(83);
    expect(result.band).toBe('review');
    expect(result.evidenceIds).toHaveLength(3);
  });

  it('ignores pending evidence and normalizes one valid score', () => {
    const result = calculateTagMastery('gpio.output-mode', [
      evidence(95, '2026-04-01T00:00:00.000Z', 'pending'),
      evidence(55, '2026-03-01T00:00:00.000Z', 'failed'),
    ]);
    expect(result.score).toBe(55);
    expect(result.band).toBe('relearn');
  });
});
```

- [ ] **Step 2: Run tests and verify both modules are missing**

Run: `npm test -- --run web/src/domain/scoring`

Expected: FAIL because the scoring modules do not exist.

- [ ] **Step 3: Implement bounded scoring**

Create `web/src/domain/scoring/lessonScore.ts`:

```ts
import type { EvidenceKind } from '../progress/types';

const WEIGHTS: Record<EvidenceKind, number> = { concept: 0.25, configuration: 0.25, practical: 0.35, reflection: 0.15 };

export function calculateLessonScore(scores: Partial<Record<EvidenceKind, number>>): number {
  for (const kind of Object.keys(WEIGHTS) as EvidenceKind[]) {
    if (scores[kind] === undefined) throw new Error(`缺少评分项：${kind}`);
    if (scores[kind]! < 0 || scores[kind]! > 100) throw new Error(`${kind} 必须在 0–100 之间`);
  }
  return Math.round((Object.keys(WEIGHTS) as EvidenceKind[]).reduce((sum, kind) => sum + scores[kind]! * WEIGHTS[kind], 0));
}
```

Create `web/src/domain/scoring/mastery.ts`:

```ts
import type { EvidenceRecord, MasteryBand } from '../progress/types';

export interface TagMastery { tagId: string; score: number; band: MasteryBand; evidenceIds: string[] }

const bandFor = (score: number): MasteryBand => score >= 85 ? 'mastered' : score >= 70 ? 'review' : score >= 60 ? 'remediate' : 'relearn';

export function calculateTagMastery(tagId: string, evidence: EvidenceRecord[]): TagMastery {
  const selected = evidence
    .filter((item) => item.tagIds.includes(tagId) && item.status !== 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  if (selected.length === 0) return { tagId, score: 0, band: 'relearn', evidenceIds: [] };
  const weights = [0.5, 0.3, 0.2].slice(0, selected.length);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const score = Math.round(selected.reduce((sum, item, index) => sum + item.score * weights[index], 0) / totalWeight);
  return { tagId, score, band: bandFor(score), evidenceIds: selected.map((item) => item.id) };
}
```

- [ ] **Step 4: Verify and commit scoring**

Run: `npm test -- --run web/src/domain/scoring`

Expected: four tests pass.

```powershell
git add web/src/domain/scoring
git commit -m "feat: calculate lesson and mastery scores"
```

### Task 3: Evaluate phase gates and build explained remediation

**Files:**
- Create: `web/src/domain/scoring/phaseGate.test.ts`
- Create: `web/src/domain/scoring/phaseGate.ts`
- Create: `web/src/domain/remediation/buildRemediationQueue.test.ts`
- Create: `web/src/domain/remediation/buildRemediationQueue.ts`

**Interfaces:**
- Consumes: lesson scores, practical scores, `TagMastery[]`.
- Produces: `evaluatePhaseGate(input): PhaseGateResult` and `buildRemediationQueue(mastery, evidence): RemediationItem[]`.

- [ ] **Step 1: Write failing threshold and recommendation tests**

Create `web/src/domain/scoring/phaseGate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluatePhaseGate } from './phaseGate';

describe('evaluatePhaseGate', () => {
  it('passes only when all three thresholds pass', () => {
    expect(evaluatePhaseGate({ phaseId: 1, lessonScores: [75, 80], practicalScores: [70, 90], prerequisiteScores: { gpio: 72 } }).passed).toBe(true);
    expect(evaluatePhaseGate({ phaseId: 1, lessonScores: [90], practicalScores: [90], prerequisiteScores: { gpio: 69 } }).passed).toBe(false);
  });

  it('explains every failed threshold', () => {
    const result = evaluatePhaseGate({ phaseId: 1, lessonScores: [70], practicalScores: [60], prerequisiteScores: { gpio: 65 } });
    expect(result.reasons).toEqual(['阶段平均分 70，要求至少 75', '实操平均分 60，要求至少 70', '前置标签 gpio 为 65，要求至少 70']);
  });
});
```

Create `web/src/domain/remediation/buildRemediationQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRemediationQueue } from './buildRemediationQueue';

describe('buildRemediationQueue', () => {
  it('selects at most three weakest tags with concrete actions', () => {
    const result = buildRemediationQueue([
      { tagId: 'gpio', score: 58, band: 'relearn', evidenceIds: [] },
      { tagId: 'tim', score: 62, band: 'remediate', evidenceIds: [] },
      { tagId: 'adc', score: 65, band: 'remediate', evidenceIds: [] },
      { tagId: 'usart', score: 68, band: 'remediate', evidenceIds: [] },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.tagId)).toEqual(['gpio', 'tim', 'adc']);
    expect(result[0].reason).toContain('58');
  });
});
```

- [ ] **Step 2: Run tests and verify the modules are missing**

Run: `npm test -- --run web/src/domain/scoring/phaseGate.test.ts web/src/domain/remediation/buildRemediationQueue.test.ts`

Expected: FAIL because both implementations are missing.

- [ ] **Step 3: Implement phase evaluation and deterministic actions**

Create `web/src/domain/scoring/phaseGate.ts`:

```ts
export interface PhaseGateInput { phaseId: number; lessonScores: number[]; practicalScores: number[]; prerequisiteScores: Record<string, number> }
export interface PhaseGateResult { phaseId: number; passed: boolean; phaseAverage: number; practicalAverage: number; reasons: string[] }

const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

export function evaluatePhaseGate(input: PhaseGateInput): PhaseGateResult {
  const phaseAverage = average(input.lessonScores);
  const practicalAverage = average(input.practicalScores);
  const reasons: string[] = [];
  if (phaseAverage < 75) reasons.push(`阶段平均分 ${phaseAverage}，要求至少 75`);
  if (practicalAverage < 70) reasons.push(`实操平均分 ${practicalAverage}，要求至少 70`);
  for (const [tag, score] of Object.entries(input.prerequisiteScores).sort(([a], [b]) => a.localeCompare(b))) {
    if (score < 70) reasons.push(`前置标签 ${tag} 为 ${score}，要求至少 70`);
  }
  return { phaseId: input.phaseId, passed: reasons.length === 0, phaseAverage, practicalAverage, reasons };
}
```

Create `web/src/domain/remediation/buildRemediationQueue.ts`:

```ts
import type { TagMastery } from '../scoring/mastery';
import type { RemediationItem } from '../progress/types';

const actionFor = (tagId: string, score: number): RemediationItem['action'] => {
  if (score < 60) return 'prerequisite-reset';
  if (['usart', 'i2c', 'spi'].some((prefix) => tagId.startsWith(prefix))) return 'shared-protocol-foundation';
  if (['gpio', 'exti', 'tim', 'adc', 'dma'].some((prefix) => tagId.startsWith(prefix))) return 'signal-to-register';
  return 'concept-breakdown';
};

export function buildRemediationQueue(mastery: TagMastery[]): RemediationItem[] {
  return [...mastery]
    .filter((item) => item.score < 70)
    .sort((a, b) => a.score - b.score || a.tagId.localeCompare(b.tagId))
    .slice(0, 3)
    .map((item) => ({
      id: `remediation-${item.tagId}`,
      tagId: item.tagId,
      reason: `${item.tagId} 当前掌握度 ${item.score}，低于阶段要求 70`,
      action: actionFor(item.tagId, item.score),
      status: 'queued',
    }));
}
```

- [ ] **Step 4: Verify and commit gate/remediation logic**

Run: `npm test -- --run web/src/domain/scoring/phaseGate.test.ts web/src/domain/remediation/buildRemediationQueue.test.ts`

Expected: three tests pass.

```powershell
git add web/src/domain/scoring/phaseGate* web/src/domain/remediation
git commit -m "feat: evaluate phases and prescribe remediation"
```

### Task 4: Create the application state boundary and core routes

**Files:**
- Create: `web/src/app/ProgressContext.test.tsx`
- Create: `web/src/app/ProgressContext.tsx`
- Create: `web/src/app/router.test.tsx`
- Create: `web/src/app/router.tsx`
- Create: `web/src/pages/DashboardPage.tsx`
- Create: `web/src/pages/LearningMapPage.tsx`
- Create: `web/src/pages/WeekPage.tsx`
- Create: `web/src/pages/KnowledgeReportPage.tsx`
- Create: `web/src/components/AppShell.tsx`
- Create: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

**Interfaces:**
- Consumes: `ProgressRepository`, course map, scoring results.
- Produces: `useProgress()`, `ProgressProvider`, and hash routes `/`, `/map`, `/week/:week`, `/report`.

- [ ] **Step 1: Install the static-host-compatible router**

Run: `npm install react-router-dom@latest`

Expected: `npm ls react-router-dom` exits 0.

- [ ] **Step 2: Write failing context and route tests**

Create `web/src/app/ProgressContext.test.tsx` with an in-memory repository and assert that `recordEvidence` saves a new evidence record and updates the consumer. Create `web/src/app/router.test.tsx` with `createMemoryRouter` and assert `/`, `/map`, `/week/4`, and `/report` each render one named heading. Use these exact accessible headings:

```ts
const expectedHeadings = ['今天从这里开始', '24 周学习地图', '第 4 周', '知识掌握报告'];
```

- [ ] **Step 3: Run the tests and verify the state boundary and routes are missing**

Run: `npm test -- --run web/src/app`

Expected: FAIL because `ProgressContext.tsx` and `router.tsx` do not exist.

- [ ] **Step 4: Implement the context API without scoring logic in React**

Create `web/src/app/ProgressContext.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { EvidenceRecord, LearnerState } from '../domain/progress/types';

export interface ProgressActions {
  recordEvidence(record: EvidenceRecord): Promise<void>;
  saveNote(lessonId: string, markdown: string): Promise<void>;
  setCurrentWeek(week: number): Promise<void>;
  replaceState(state: LearnerState): Promise<void>;
}

export interface ProgressContextValue extends ProgressActions {
  state: LearnerState;
  loading: boolean;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ repository, children }: { repository: ProgressRepository; children: ReactNode }) {
  const [state, setState] = useState<LearnerState>(() => createDefaultState());
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);

  useEffect(() => {
    let active = true;
    void repository.load().then((loaded) => {
      if (!active) return;
      stateRef.current = loaded;
      setState(loaded);
      setLoading(false);
    });
    return () => { active = false; };
  }, [repository]);

  const save = useCallback(async (next: LearnerState) => {
    await repository.save(next);
    stateRef.current = next;
    setState(next);
  }, [repository]);

  const recordEvidence = useCallback(async (record: EvidenceRecord) => {
    await save({ ...stateRef.current, evidence: [...stateRef.current.evidence, record], updatedAt: new Date().toISOString() });
  }, [save]);
  const saveNote = useCallback(async (lessonId: string, markdown: string) => {
    await save({ ...stateRef.current, notes: { ...stateRef.current.notes, [lessonId]: markdown }, updatedAt: new Date().toISOString() });
  }, [save]);
  const setCurrentWeek = useCallback(async (week: number) => {
    if (!Number.isInteger(week) || week < 1 || week > 24) throw new Error('周编号必须在 1–24 之间');
    await save({ ...stateRef.current, currentWeek: week, updatedAt: new Date().toISOString() });
  }, [save]);
  const replaceState = useCallback(async (next: LearnerState) => {
    await repository.replace(next);
    const verified = await repository.load();
    stateRef.current = verified;
    setState(verified);
  }, [repository]);

  const value = useMemo<ProgressContextValue>(() => ({ state, loading, recordEvidence, saveNote, setCurrentWeek, replaceState }), [state, loading, recordEvidence, saveNote, setCurrentWeek, replaceState]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('ProgressProvider 未挂载');
  return value;
}
```

- [ ] **Step 5: Implement the hash router and focused page components**

Create `web/src/app/router.tsx` using `createHashRouter` so direct GitHub Pages loads do not require server rewrites. Use `AppShell` as the root element. Create the four focused page files exactly as follows:

```tsx
// web/src/pages/DashboardPage.tsx
import { Link } from 'react-router-dom';
import { useProgress } from '../app/ProgressContext';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function DashboardPage() {
  const { state } = useProgress();
  const week = loadCourseMap().weeks[state.currentWeek - 1];
  return <section><h1>今天从这里开始</h1><p>{`当前：第 ${week.week} 周 · ${week.title}`}</p><Link to={`/week/${week.week}`}>继续学习</Link></section>;
}

// web/src/pages/LearningMapPage.tsx
import { Link } from 'react-router-dom';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function LearningMapPage() {
  return <section><h1>24 周学习地图</h1><ol>{loadCourseMap().weeks.map((week) => <li key={week.week}><Link to={`/week/${week.week}`}>{`第 ${week.week} 周 · ${week.title}`}</Link>{week.gateAfter && <span> · 阶段闸门</span>}</li>)}</ol></section>;
}

// web/src/pages/WeekPage.tsx
import { Link, useParams } from 'react-router-dom';
import { loadCourseMap } from '../domain/content/loadCourseMap';

export function WeekPage() {
  const weekNumber = Number(useParams().week);
  const week = loadCourseMap().weeks.find((item) => item.week === weekNumber);
  if (!week) return <section><h1>没有找到这一周</h1><Link to="/map">返回学习地图</Link></section>;
  return <section><h1>{`第 ${week.week} 周`}</h1><h2>{week.title}</h2><p>{`对应源课程：${week.sourceCourseIds.join('、') || '补充基础/综合应用'}`}</p><Link to={`/lesson/${week.lessonIds[0]}`}>进入本周课程</Link></section>;
}

// web/src/pages/KnowledgeReportPage.tsx
import { useProgress } from '../app/ProgressContext';
import { calculateTagMastery } from '../domain/scoring/mastery';

export function KnowledgeReportPage() {
  const { state } = useProgress();
  const tags = [...new Set(state.evidence.flatMap((item) => item.tagIds))];
  const results = tags.map((tag) => calculateTagMastery(tag, state.evidence));
  return <section><h1>知识掌握报告</h1>{results.length === 0 ? <p>完成测验或实验后，这里会显示证据和知识缺口。</p> : <ul>{results.map((item) => <li key={item.tagId}>{`${item.tagId}：${item.score}（${item.band}）`}</li>)}</ul>}</section>;
}
```

Create `web/src/components/AppShell.tsx`:

```tsx
import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return <><header><Link to="/">STM32 学习</Link><nav aria-label="主导航"><Link to="/">首页</Link><Link to="/map">学习地图</Link><Link to="/report">知识报告</Link></nav></header><main><Outlet /></main></>;
}
```

Create `web/src/app/router.tsx`:

```tsx
import { createHashRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { KnowledgeReportPage } from '../pages/KnowledgeReportPage';
import { LearningMapPage } from '../pages/LearningMapPage';
import { WeekPage } from '../pages/WeekPage';

export const routes: RouteObject[] = [{ element: <AppShell />, children: [
  { path: '/', element: <DashboardPage /> },
  { path: '/map', element: <LearningMapPage /> },
  { path: '/week/:week', element: <WeekPage /> },
  { path: '/report', element: <KnowledgeReportPage /> },
]}];
export const router = createHashRouter(routes);
```

Replace `web/src/App.tsx` and add the stylesheet import to `main.tsx`:

```tsx
// web/src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { ProgressProvider } from './app/ProgressContext';
import { router } from './app/router';
import { createIndexedDbProgressRepository } from './infrastructure/indexedDbProgressRepository';

const repository = createIndexedDbProgressRepository();
export function App() { return <ProgressProvider repository={repository}><RouterProvider router={router} /></ProgressProvider>; }

// add to web/src/main.tsx
import './styles.css';
```

Scoring formulas remain in the pure modules from Tasks 2–3; pages only call them.

- [ ] **Step 6: Add accessible responsive styles**

Create `web/src/styles.css` with variables for surface, text, accent, success, warning, and danger; use `max-width: 72rem`, `minmax(16rem, 1fr)` card grids, visible `:focus-visible` outlines, text labels next to every status color, and a `@media (max-width: 48rem)` single-column layout. Do not hide navigation behind hover.

- [ ] **Step 7: Verify and commit the navigable learning shell**

Run:

```powershell
npm test -- --run web/src/app
npm run typecheck
npm run build
```

Expected: context and route tests pass; build exits 0.

```powershell
git add package.json package-lock.json web/src
git commit -m "feat: add local learning dashboard and routes"
```

### Task 5: Implement entry diagnostic, pause recovery, lesson, lab, and assessment evidence flow

**Files:**
- Create: `assessments/question-banks/entry-diagnostic.json`
- Create: `web/src/domain/diagnostic/buildDiagnosticPath.test.ts`
- Create: `web/src/domain/diagnostic/buildDiagnosticPath.ts`
- Create: `web/src/domain/diagnostic/buildResumePlan.test.ts`
- Create: `web/src/domain/diagnostic/buildResumePlan.ts`
- Create: `web/src/domain/assessment/gradeAssessment.test.ts`
- Create: `web/src/domain/assessment/gradeAssessment.ts`
- Create: `web/src/components/LabChecklist.test.tsx`
- Create: `web/src/components/LabChecklist.tsx`
- Create: `web/src/pages/AssessmentPage.test.tsx`
- Create: `web/src/pages/AssessmentPage.tsx`
- Create: `web/src/pages/LessonPage.tsx`
- Modify: `web/src/app/router.tsx`

**Interfaces:**
- Consumes: `Assessment`, `EvidenceRecord`, `recordEvidence`.
- Produces: `buildDiagnosticPath`, `buildResumePlan`, `gradeAssessment`, manual lab evidence, and routes `/lesson/:lessonId`, `/assessment/:assessmentId`.

- [ ] **Step 1: Add a real four-part entry diagnostic**

Create `assessments/question-banks/entry-diagnostic.json` containing four scored items:

1. Explain voltage, current, and resistance in an LED circuit (`concept`, 25).
2. Read a bit-mask expression and identify the changed bit (`configuration`, 25).
3. Choose safe wiring for a 3.3 V GPIO and LED (`practical`, 35).
4. Explain what evidence would prove a program works (`reflection`, 15).

Each item must contain `id`, `kind`, Chinese `prompt`, one or more `tagIds`, `maxScore`, an objective `answer` where possible, and a four-level `rubric` where manual grading is needed.

- [ ] **Step 2: Write failing diagnostic and pause-recovery tests**

`buildDiagnosticPath` tests use mastery for `foundation.electricity`, `foundation.binary`, `c.control-flow`, `c.memory`, and `gpio.output-mode`. With no mastered tags it recommends week 1; with the first four tags ≥85 it recommends week 3 plus a practical validation task; with all five ≥85 it recommends week 5 plus gate 1 validation. It never marks skipped lessons completed without evidence.

`buildResumePlan` tests use `updatedAt`: a gap of 7 days or less returns no recall check; a longer gap returns a 10-minute recall check for the weakest maximum-three mastered/review tags and keeps the same current week.

- [ ] **Step 3: Write failing grading and manual-evidence tests**

Test that objective answers produce evidence with the assessment item kind and tag IDs, unanswered items produce score 0/status `failed`, and `LabChecklist` cannot emit `manual-confirmed` until the learner checks both “接线已断电复核” and the named observed phenomenon.

- [ ] **Step 4: Run the focused tests and verify missing implementations**

Run: `npm test -- --run web/src/domain/diagnostic web/src/domain/assessment web/src/components/LabChecklist.test.tsx web/src/pages/AssessmentPage.test.tsx`

Expected: FAIL because the grader and pages do not exist.

- [ ] **Step 5: Implement deterministic start/resume recommendations**

Create `buildDiagnosticPath.ts`:

```ts
import type { TagMastery } from '../scoring/mastery';

export interface DiagnosticPath { recommendedWeek: 1 | 3 | 5; validationTaskIds: string[]; reasons: string[] }

export function buildDiagnosticPath(mastery: TagMastery[]): DiagnosticPath {
  const scores = new Map(mastery.map((item) => [item.tagId, item.score]));
  const mastered = (ids: string[]) => ids.every((id) => (scores.get(id) ?? 0) >= 85);
  const cReady = mastered(['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory']);
  const gpioReady = cReady && mastered(['gpio.output-mode']);
  if (gpioReady) return { recommendedWeek: 5, validationTaskIds: ['gate-01-practical'], reasons: ['基础、电学、C 和 GPIO 标签均达到 85；先通过第一阶段实操再跳到第 5 周。'] };
  if (cReady) return { recommendedWeek: 3, validationTaskIds: ['lab-w03-first-project'], reasons: ['基础和 C 标签达到 85；从工具链实操开始。'] };
  return { recommendedWeek: 1, validationTaskIds: [], reasons: ['基础标签尚未全部达到 85；从第 1 周建立安全和数制基础。'] };
}
```

Create `buildResumePlan.ts`:

```ts
import type { LearnerState } from '../progress/types';
import type { TagMastery } from '../scoring/mastery';

export interface ResumePlan { needsRecall: boolean; currentWeek: number; durationMinutes: 0 | 10; recallTagIds: string[] }

export function buildResumePlan(state: LearnerState, mastery: TagMastery[], now: string): ResumePlan {
  const gapDays = (Date.parse(now) - Date.parse(state.updatedAt)) / 86_400_000;
  if (gapDays <= 7) return { needsRecall: false, currentWeek: state.currentWeek, durationMinutes: 0, recallTagIds: [] };
  const recallTagIds = [...mastery].filter((item) => item.score >= 70).sort((a, b) => a.score - b.score || a.tagId.localeCompare(b.tagId)).slice(0, 3).map((item) => item.tagId);
  return { needsRecall: true, currentWeek: state.currentWeek, durationMinutes: 10, recallTagIds };
}
```

Dashboard displays the recommendation, its reason, and the required validation task. Accepting a recommendation changes `currentWeek` only; it does not synthesize lesson completion or gate scores.

- [ ] **Step 6: Implement grading as a pure transformation**

Create `gradeAssessment.ts` with this signature:

```ts
export function gradeAssessment(
  assessment: Assessment,
  answers: Record<string, { score: number; response: string }>,
  now: string,
): EvidenceRecord[];
```

Clamp scores to `0..item.maxScore`, convert them to `0..100`, set status to `auto-pass` only for an objective item that matches its answer, otherwise use `manual-confirmed` for a submitted rubric score and `failed` for zero/missing responses. Preserve `prompt`, `response`, and `maxScore` in `details`.

- [ ] **Step 7: Implement the lab and assessment pages**

`LabChecklist` receives a `LabManifest` and `onConfirm(EvidenceRecord)`. Its button remains disabled until safety and observation checkboxes are checked. `AssessmentPage` renders one fieldset per item, labels score inputs with their maximum, shows rubric text, and records all evidence in one submit operation.

- [ ] **Step 8: Verify and commit the evidence flow**

Run:

```powershell
npm test -- --run web/src/domain/diagnostic web/src/domain/assessment web/src/components/LabChecklist.test.tsx web/src/pages/AssessmentPage.test.tsx
npm run typecheck
```

Expected: grading, safety gating, and route tests pass.

```powershell
git add assessments web/src/domain/diagnostic web/src/domain/assessment web/src/components web/src/pages web/src/app/router.tsx
git commit -m "feat: record assessment and lab evidence"
```

### Task 6: Export Markdown notes and transactionally restore JSON backups

**Files:**
- Create: `web/src/domain/notes/toMarkdown.test.ts`
- Create: `web/src/domain/notes/toMarkdown.ts`
- Create: `web/src/domain/backup/backup.test.ts`
- Create: `web/src/domain/backup/backup.ts`
- Create: `web/src/pages/NotesSettingsPage.test.tsx`
- Create: `web/src/pages/NotesSettingsPage.tsx`
- Modify: `web/src/app/router.tsx`

**Interfaces:**
- Consumes: `LearnerState`, `ProgressRepository`.
- Produces: `toMarkdownNote`, `exportBackup`, `importBackup`, and `/notes` UI.

- [ ] **Step 1: Write failing deterministic export/import tests**

Test that Markdown begins with YAML fields `lessonId`, `week`, `date`, and `tags`, contains sections `学习目标`, `CubeMX 决策`, `接线与安全`, `代码与数据流`, `故障记录`, `测试证据`, and `复盘`; escape `---` inside learner text. Test that backup export uses format `stm32-learning-platform-backup`, rejects an unknown version, snapshots before replacement, and leaves active state unchanged when validation fails.

- [ ] **Step 2: Run tests and verify both modules are missing**

Run: `npm test -- --run web/src/domain/notes web/src/domain/backup`

Expected: FAIL because the export/import modules do not exist.

- [ ] **Step 3: Implement Markdown rendering**

Create `web/src/domain/notes/toMarkdown.ts` with this API:

```ts
export interface NoteExportInput {
  lessonId: string;
  week: number;
  date: string;
  tags: string[];
  objectives: string[];
  cubeMxDecisions: string;
  wiringAndSafety: string;
  codeAndDataFlow: string;
  faults: string;
  evidence: string;
  reflection: string;
}

export function toMarkdownNote(input: NoteExportInput): { filename: string; markdown: string };
```

The filename is `${date}-${lessonId}.md`; YAML scalar values are JSON-quoted and the seven named sections are always emitted in the listed order.

- [ ] **Step 4: Implement versioned backup validation and transactional replacement**

Create `web/src/domain/backup/backup.ts`:

```ts
import { z } from 'zod';
import type { ProgressRepository } from '../progress/repository';
import { LearnerStateSchema } from '../progress/schemas';
import type { LearnerState } from '../progress/types';

const BackupSchema = z.object({
  format: z.literal('stm32-learning-platform-backup'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  state: LearnerStateSchema,
});

export function exportBackup(state: LearnerState, now = new Date().toISOString()): string {
  return JSON.stringify({ format: 'stm32-learning-platform-backup', schemaVersion: 1, exportedAt: now, state }, null, 2);
}

export async function importBackup(json: string, repository: ProgressRepository): Promise<LearnerState> {
  const parsed = BackupSchema.parse(JSON.parse(json));
  await repository.snapshot();
  await repository.replace(parsed.state);
  return repository.load();
}
```

Use the complete `LearnerStateSchema` created in Task 1; backup import does not introduce a second or weaker state contract.

- [ ] **Step 5: Implement download/upload UI without browser-specific hidden writes**

`NotesSettingsPage` uses a visible “导出 Markdown”, “导出全部进度”, and labeled file input “导入备份”. Create downloads with a Blob and temporary object URL, revoke the URL after the click, show the import validation error in an `role="alert"`, and require confirmation before calling `importBackup`.

- [ ] **Step 6: Verify and commit notes/backup**

Run:

```powershell
npm test -- --run web/src/domain/notes web/src/domain/backup web/src/pages/NotesSettingsPage.test.tsx
npm run typecheck
```

Expected: deterministic Markdown, invalid-import rollback, and UI tests pass.

```powershell
git add web/src/domain/notes web/src/domain/backup web/src/pages/NotesSettingsPage* web/src/app/router.tsx
git commit -m "feat: export notes and restore safe backups"
```

### Task 7: Prove the complete local learning journey in a browser

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/e2e/learning-core.spec.ts`
- Modify: `package.json`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: built web app and all prior routes.
- Produces: `npm run test:e2e` and evidence that the core journey works at desktop and phone widths.

- [ ] **Step 1: Install and configure Playwright**

Run:

```powershell
npm install --save-dev @playwright/test@latest
npx playwright install chromium
```

Add scripts:

```json
{
  "test:e2e": "playwright test --config web/playwright.config.ts",
  "preview": "vite preview --config web/vite.config.ts"
}
```

Create `web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
```

- [ ] **Step 2: Write the browser journey before fixing any exposed UI gaps**

Create `web/e2e/learning-core.spec.ts` with four tests:

1. New learner opens dashboard, sees week 1, opens the 24-week map, and sees week 24.
2. Learner submits the entry diagnostic and sees evidence statuses rather than an unexplained total only.
3. A failing phase result shows its three concrete thresholds and a maximum-three remediation queue while week 5 remains previewable.
4. Learner writes a note, reloads, exports JSON, clears the test database, imports the backup, and sees the note and current week restored.

Use role/name locators only for actions. At mobile width, assert `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 3: Run the journey and record the first failing interaction**

Run: `npm run test:e2e`

Expected: tests fail only at interactions not yet wired; no selector should depend on CSS class names.

- [ ] **Step 4: Make only the exposed integration fixes**

Wire context actions to pages, add `aria-live="polite"` to save/result status, ensure every input has a label, keep focus visible, and adjust the mobile grid until all four journeys pass. Do not add unrelated animations or account features.

- [ ] **Step 5: Run the complete learning-core gate**

Run:

```powershell
npm run validate:content
npm test
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

Expected: all commands exit 0; desktop and mobile projects both pass.

- [ ] **Step 6: Commit the completed learning core**

```powershell
git add package.json package-lock.json web
git commit -m "test: verify complete local learning journey"
```

## Learning Core Acceptance

- [ ] Progress and notes survive reload without a server.
- [ ] Scoring, mastery, phase gates, and remediation exactly match the approved thresholds.
- [ ] Evidence source/status is visible and pending evidence never becomes mastery.
- [ ] Failed gates explain why and do not hide future content.
- [ ] JSON backup restore is validated and transactional.
- [ ] Markdown is directly usable in GitHub.
- [ ] Desktop and mobile Chromium journeys pass with no horizontal content loss.
- [ ] `git status --short` is empty after the final commit.
