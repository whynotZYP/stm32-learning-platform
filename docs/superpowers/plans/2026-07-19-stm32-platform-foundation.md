# STM32 Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable, tested repository foundation with strict content contracts, the complete 24-week/46-source map, and automated validation.

**Architecture:** A single root npm project drives a Vite application under `web/` and TypeScript validation scripts under `scripts/`. Zod schemas are the sole runtime contract for course data; the UI and validator import the same schemas so malformed content cannot silently reach learners.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Zod, tsx, GitHub Actions.

## Global Constraints

- Target learner has no programming background; all initial copy is Chinese and explains unfamiliar terms plainly.
- The site is static, has no backend/login/token, and must build for a GitHub Pages subpath.
- The course has exactly 24 weeks and exactly 46 source IDs: `05`, `06-1`, `06-2`, and `07` through `49`.
- Required topic tags include GPIO, EXTI, TIM, ADC, DMA, USART, I2C, SPI, RTC, PWR, WDG, and FLASH.
- HAL is the mainline; LL/register and SPL migration metadata remain distinguishable.
- Tests are written before implementation, verification output is inspected, and each task ends with a focused commit.

---

## File Map

- `package.json`: one command surface for install, validation, tests, type checking, development, and build.
- `tsconfig.scripts.json`: strict Node TypeScript checking for validators and release scripts.
- `web/index.html`: Vite HTML entry.
- `web/tsconfig.json`: strict browser TypeScript configuration.
- `web/vite.config.ts`: React build with configurable Pages base path.
- `web/vitest.config.ts`: jsdom unit/component test configuration.
- `web/src/main.tsx`: React mount only.
- `web/src/App.tsx`: temporary course-map shell; later plans replace its presentation without changing content contracts.
- `web/src/test/setup.ts`: Testing Library cleanup and DOM matchers.
- `web/src/domain/content/types.ts`: TypeScript types inferred from schemas.
- `web/src/domain/content/schemas.ts`: all runtime content contracts.
- `web/src/domain/content/loadCourseMap.ts`: load and validate the checked-in course map.
- `curriculum/course-map.json`: authoritative 24-week and 46-source mapping.
- `scripts/content-validation/validate-content.ts`: repository content validator and readable CLI report.
- `scripts/content-validation/validate-content.test.ts`: validator failure/success cases.
- `.github/workflows/ci.yml`: validation, test, typecheck, and build on pushes and pull requests.

### Task 1: Bootstrap the tested React/TypeScript shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.scripts.json`
- Create: `web/index.html`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/App.test.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/main.tsx`

**Interfaces:**
- Consumes: none.
- Produces: root commands `npm test`, `npm run typecheck`, `npm run build`, and React component `App(): JSX.Element`.

- [ ] **Step 1: Create the root command surface and install the exact dependency classes**

Create `package.json`:

```json
{
  "name": "stm32-learning-platform",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --config web/vite.config.ts",
    "build": "npm run validate:content && npm run typecheck && vite build --config web/vite.config.ts",
    "typecheck": "tsc -p web/tsconfig.json --noEmit && tsc -p tsconfig.scripts.json --noEmit",
    "test": "vitest run --config web/vitest.config.ts",
    "test:watch": "vitest --config web/vitest.config.ts",
    "validate:content": "tsx scripts/content-validation/validate-content.ts"
  }
}
```

Run:

```powershell
npm install react@latest react-dom@latest zod@latest
npm install --save-dev typescript@latest vite@latest @vitejs/plugin-react@latest vitest@latest jsdom@latest @testing-library/react@latest @testing-library/jest-dom@latest tsx@latest @types/node@latest @types/react@latest @types/react-dom@latest
```

Expected: `package-lock.json` is created and `npm ls --depth=0` exits 0. The lock file, not an unpinned global tool, becomes the reproducible dependency source.

- [ ] **Step 2: Write the failing application smoke test**

Create `web/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('introduces the STM32 learning path in plain Chinese', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'STM32 系统学习平台' })).toBeInTheDocument();
    expect(screen.getByText('24 周，从零基础到能独立排查问题')).toBeInTheDocument();
  });
});
```

Create `web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./web/src/test/setup.ts'],
    include: ['./web/src/**/*.test.{ts,tsx}', './scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Run the test to verify the missing application fails**

Run: `npm test -- --run web/src/App.test.tsx`

Expected: FAIL because `./App` does not exist.

- [ ] **Step 4: Add the minimal strict Vite application**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Create `tsconfig.scripts.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["scripts/**/*.ts"]
}
```

Create `web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
});
```

Create `web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="从零基础系统学习 STM32" />
    <title>STM32 系统学习平台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `web/src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>STM32 系统学习平台</h1>
      <p>24 周，从零基础到能独立排查问题</p>
    </main>
  );
}
```

Create `web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('页面缺少 #root 挂载节点');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Verify the shell**

Run:

```powershell
npm test -- --run web/src/App.test.tsx
npm run typecheck
```

Expected: one test passes and TypeScript exits 0.

- [ ] **Step 6: Commit the shell**

```powershell
git add package.json package-lock.json tsconfig.scripts.json web
git commit -m "chore: bootstrap learning platform web app"
```

### Task 2: Define the shared course contracts

**Files:**
- Create: `web/src/domain/content/schemas.test.ts`
- Create: `web/src/domain/content/schemas.ts`
- Create: `web/src/domain/content/types.ts`

**Interfaces:**
- Consumes: Zod.
- Produces: `CourseMapSchema`, `WeekManifestSchema`, `LessonManifestSchema`, `LabManifestSchema`, `AssessmentSchema`, `KnowledgeTagSchema`, and their inferred TypeScript types.

- [ ] **Step 1: Write failing schema tests for valid and unsafe content**

Create `web/src/domain/content/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CourseMapSchema, LessonManifestSchema } from './schemas';

describe('content contracts', () => {
  it('accepts a lesson with objectives, evidence and safety text', () => {
    const result = LessonManifestSchema.safeParse({
      schemaVersion: 1,
      id: 'w04-gpio-output',
      week: 4,
      title: 'GPIO 输出与电流路径',
      estimatedMinutes: 180,
      sourceCourseIds: ['05', '06-1', '06-2'],
      prerequisiteTagIds: ['electricity.current-path'],
      targetTagIds: ['gpio.output-mode'],
      objectives: ['能解释推挽输出时电流从哪里流到哪里'],
      conceptPath: 'curriculum/weeks/w04.md',
      labIds: ['lab-w04-gpio-output'],
      assessmentId: 'assessment-w04',
      safety: ['LED 必须串联限流电阻。'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a hardware lesson without a safety instruction', () => {
    const result = LessonManifestSchema.safeParse({
      schemaVersion: 1,
      id: 'w04-gpio-output',
      week: 4,
      title: 'GPIO 输出',
      estimatedMinutes: 180,
      sourceCourseIds: ['05'],
      prerequisiteTagIds: [],
      targetTagIds: ['gpio.output-mode'],
      objectives: ['能解释推挽输出'],
      conceptPath: 'curriculum/weeks/w04.md',
      labIds: ['lab-w04-gpio-output'],
      assessmentId: 'assessment-w04',
      safety: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a course map with fewer than 24 weeks', () => {
    expect(CourseMapSchema.safeParse({ schemaVersion: 1, sourceCourseIds: [], requiredTagIds: [], weeks: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify the schemas are missing**

Run: `npm test -- --run web/src/domain/content/schemas.test.ts`

Expected: FAIL because `./schemas` does not exist.

- [ ] **Step 3: Implement the complete runtime contracts**

Create `web/src/domain/content/schemas.ts`:

```ts
import { z } from 'zod';

const Id = z.string().min(1).regex(/^[a-z0-9][a-z0-9.-]*$/);
const RepositoryPath = z.string().min(1).refine((value) => !value.includes('..'), '路径不能包含 ..');

export const KnowledgeTagSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2),
  plainLanguage: z.string().min(10),
  prerequisiteTagIds: z.array(Id),
});

export const LessonManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  week: z.number().int().min(1).max(24),
  title: z.string().min(2),
  estimatedMinutes: z.number().int().min(15).max(480),
  sourceCourseIds: z.array(z.string().min(2)),
  prerequisiteTagIds: z.array(Id),
  targetTagIds: z.array(Id).min(1),
  objectives: z.array(z.string().min(8)).min(1),
  conceptPath: RepositoryPath,
  labIds: z.array(Id),
  assessmentId: Id,
  safety: z.array(z.string().min(8)).min(1),
});

export const WeekManifestSchema = z.object({
  schemaVersion: z.literal(1),
  week: z.number().int().min(1).max(24),
  title: z.string().min(2),
  phase: z.number().int().min(1).max(6),
  sourceCourseIds: z.array(z.string()),
  lessonIds: z.array(Id).min(1),
  gateAfter: z.boolean(),
});

export const LabManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  lessonId: Id,
  title: z.string().min(2),
  hardware: z.array(z.string().min(2)),
  wiringChecklist: z.array(z.string().min(8)).min(1),
  safety: z.array(z.string().min(8)).min(1),
  expectedObservations: z.array(z.string().min(4)).min(1),
  faultTasks: z.array(z.string().min(8)).min(1),
  evidenceModes: z.array(z.enum(['automatic', 'semi-automatic', 'manual'])).min(1),
  firmwareProject: RepositoryPath.optional(),
});

export const AssessmentItemSchema = z.object({
  id: Id,
  kind: z.enum(['concept', 'configuration', 'practical', 'reflection']),
  prompt: z.string().min(8),
  tagIds: z.array(Id).min(1),
  maxScore: z.number().int().positive(),
  answer: z.string().min(1).optional(),
  rubric: z.array(z.string().min(4)).min(1),
});

export const AssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  lessonId: Id,
  items: z.array(AssessmentItemSchema).min(4),
});

export const CourseMapSchema = z.object({
  schemaVersion: z.literal(1),
  sourceCourseIds: z.array(z.string()).length(46),
  requiredTagIds: z.array(Id).min(12),
  weeks: z.array(WeekManifestSchema).length(24),
});
```

Create `web/src/domain/content/types.ts`:

```ts
import type { z } from 'zod';
import type {
  AssessmentSchema,
  CourseMapSchema,
  KnowledgeTagSchema,
  LabManifestSchema,
  LessonManifestSchema,
  WeekManifestSchema,
} from './schemas';

export type Assessment = z.infer<typeof AssessmentSchema>;
export type CourseMap = z.infer<typeof CourseMapSchema>;
export type KnowledgeTag = z.infer<typeof KnowledgeTagSchema>;
export type LabManifest = z.infer<typeof LabManifestSchema>;
export type LessonManifest = z.infer<typeof LessonManifestSchema>;
export type WeekManifest = z.infer<typeof WeekManifestSchema>;
```

- [ ] **Step 4: Verify contracts and type safety**

Run:

```powershell
npm test -- --run web/src/domain/content/schemas.test.ts
npm run typecheck
```

Expected: three schema tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the contracts**

```powershell
git add web/src/domain/content
git commit -m "feat: define course content contracts"
```

### Task 3: Add the authoritative 24-week map and repository validator

**Files:**
- Create: `curriculum/course-map.json`
- Create: `scripts/content-validation/validate-content.test.ts`
- Create: `scripts/content-validation/validate-content.ts`

**Interfaces:**
- Consumes: `CourseMapSchema` from Task 2.
- Produces: `validateCourseMap(input: unknown): ValidationReport` and CLI exit code 0/1.

- [ ] **Step 1: Write failing validator tests**

Create `scripts/content-validation/validate-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateCourseMap } from './validate-content';

describe('validateCourseMap', () => {
  it('reports missing source IDs and missing required topics', () => {
    const report = validateCourseMap({ schemaVersion: 1, sourceCourseIds: [], requiredTagIds: [], weeks: [] });
    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('课程地图结构无效');
  });

  it('reports duplicate week numbers after schema validation', async () => {
    const valid = (await import('../../curriculum/course-map.json', { with: { type: 'json' } })).default;
    const broken = structuredClone(valid);
    broken.weeks[1].week = 1;
    const report = validateCourseMap(broken);
    expect(report.errors).toContain('周编号必须恰好覆盖 1–24，不能重复');
  });
});
```

- [ ] **Step 2: Run the tests and verify the validator is missing**

Run: `npm test -- --run scripts/content-validation/validate-content.test.ts`

Expected: FAIL because `validate-content.ts` does not exist.

- [ ] **Step 3: Create the complete source and week map**

Create `curriculum/course-map.json` with this exact source sequence and week allocation:

```json
{
  "schemaVersion": 1,
  "sourceCourseIds": ["05", "06-1", "06-2", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49"],
  "requiredTagIds": ["gpio.output-mode", "exti.event-flow", "nvic.priority", "tim.timebase", "adc.sampling", "dma.transfer", "usart.physical-frame", "i2c.protocol", "spi.protocol", "rtc.time", "pwr.low-power", "wdg.recovery", "flash.persistence"],
  "weeks": [
    {"schemaVersion":1,"week":1,"title":"电学、面包板与数制","phase":1,"sourceCourseIds":[],"lessonIds":["w01-foundations"],"gateAfter":false},
    {"schemaVersion":1,"week":2,"title":"C 语言与内存基础","phase":1,"sourceCourseIds":["07"],"lessonIds":["w02-c-language"],"gateAfter":false},
    {"schemaVersion":1,"week":3,"title":"STM32 工具链与第一个工程","phase":1,"sourceCourseIds":["05","06-1"],"lessonIds":["w03-first-project"],"gateAfter":false},
    {"schemaVersion":1,"week":4,"title":"GPIO 输出、LED 与蜂鸣器","phase":1,"sourceCourseIds":["05","06-1","06-2"],"lessonIds":["w04-gpio-output"],"gateAfter":true},
    {"schemaVersion":1,"week":5,"title":"GPIO 输入、按键与传感器","phase":2,"sourceCourseIds":["07","08"],"lessonIds":["w05-gpio-input"],"gateAfter":false},
    {"schemaVersion":1,"week":6,"title":"OLED 与调试观察","phase":2,"sourceCourseIds":["09","10"],"lessonIds":["w06-oled-debug"],"gateAfter":false},
    {"schemaVersion":1,"week":7,"title":"EXTI、NVIC 与事件计数","phase":2,"sourceCourseIds":["11","12"],"lessonIds":["w07-exti-events"],"gateAfter":false},
    {"schemaVersion":1,"week":8,"title":"TIM 时基、定时中断与外部时钟","phase":2,"sourceCourseIds":["13","14"],"lessonIds":["w08-tim-timebase"],"gateAfter":true},
    {"schemaVersion":1,"week":9,"title":"输出比较与 PWM","phase":3,"sourceCourseIds":["15"],"lessonIds":["w09-pwm-basics"],"gateAfter":false},
    {"schemaVersion":1,"week":10,"title":"PWM 驱动 LED、舵机与电机","phase":3,"sourceCourseIds":["16"],"lessonIds":["w10-pwm-actuators"],"gateAfter":false},
    {"schemaVersion":1,"week":11,"title":"输入捕获、PWMI 与编码器测速","phase":3,"sourceCourseIds":["17","18","19","20"],"lessonIds":["w11-tim-measurement"],"gateAfter":false},
    {"schemaVersion":1,"week":12,"title":"ADC 原理与多通道采样","phase":3,"sourceCourseIds":["21","22"],"lessonIds":["w12-adc"],"gateAfter":true},
    {"schemaVersion":1,"week":13,"title":"DMA 与 ADC 扫描","phase":4,"sourceCourseIds":["23","24"],"lessonIds":["w13-dma"],"gateAfter":false},
    {"schemaVersion":1,"week":14,"title":"USART 协议、外设与收发","phase":4,"sourceCourseIds":["25","26","27"],"lessonIds":["w14-usart"],"gateAfter":false},
    {"schemaVersion":1,"week":15,"title":"串口数据包与下载诊断","phase":4,"sourceCourseIds":["28","29","30"],"lessonIds":["w15-usart-packets"],"gateAfter":false},
    {"schemaVersion":1,"week":16,"title":"I2C 协议与 MPU6050","phase":4,"sourceCourseIds":["31","32"],"lessonIds":["w16-i2c-basics"],"gateAfter":true},
    {"schemaVersion":1,"week":17,"title":"软件 I2C 与硬件 I2C 外设","phase":5,"sourceCourseIds":["33","34"],"lessonIds":["w17-i2c-implementations"],"gateAfter":false},
    {"schemaVersion":1,"week":18,"title":"硬件 I2C 读取 MPU6050","phase":5,"sourceCourseIds":["35"],"lessonIds":["w18-mpu6050"],"gateAfter":false},
    {"schemaVersion":1,"week":19,"title":"SPI、W25Q64 与软件 SPI","phase":5,"sourceCourseIds":["36","37","38"],"lessonIds":["w19-spi-basics"],"gateAfter":false},
    {"schemaVersion":1,"week":20,"title":"硬件 SPI 与连续传输","phase":5,"sourceCourseIds":["39","40"],"lessonIds":["w20-hardware-spi"],"gateAfter":true},
    {"schemaVersion":1,"week":21,"title":"Unix 时间、RTC 与 BKP","phase":6,"sourceCourseIds":["41","42","43"],"lessonIds":["w21-rtc-bkp"],"gateAfter":false},
    {"schemaVersion":1,"week":22,"title":"PWR、WDG、FLASH 与芯片 ID","phase":6,"sourceCourseIds":["44","45","46","47","48","49"],"lessonIds":["w22-reliability-storage"],"gateAfter":false},
    {"schemaVersion":1,"week":23,"title":"综合数据记录器","phase":6,"sourceCourseIds":[],"lessonIds":["w23-capstone"],"gateAfter":false},
    {"schemaVersion":1,"week":24,"title":"总考核、补洞与后续路线","phase":6,"sourceCourseIds":[],"lessonIds":["w24-mastery-transfer"],"gateAfter":true}
  ]
}
```

- [ ] **Step 4: Implement deterministic validation and a CLI**

Create `scripts/content-validation/validate-content.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CourseMapSchema } from '../../web/src/domain/content/schemas';

export interface ValidationReport { ok: boolean; errors: string[] }

const EXPECTED_SOURCE_IDS = ['05', '06-1', '06-2', ...Array.from({ length: 43 }, (_, index) => String(index + 7).padStart(2, '0'))];
const REQUIRED_TOPICS = ['gpio.output-mode', 'exti.event-flow', 'nvic.priority', 'tim.timebase', 'adc.sampling', 'dma.transfer', 'usart.physical-frame', 'i2c.protocol', 'spi.protocol', 'rtc.time', 'pwr.low-power', 'wdg.recovery', 'flash.persistence'];

export function validateCourseMap(input: unknown): ValidationReport {
  const parsed = CourseMapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ['课程地图结构无效', ...parsed.error.issues.map((issue) => issue.path.join('.') + ': ' + issue.message)] };

  const errors: string[] = [];
  const data = parsed.data;
  const weeks = [...data.weeks.map((week) => week.week)].sort((a, b) => a - b);
  if (weeks.join(',') !== Array.from({ length: 24 }, (_, index) => index + 1).join(',')) errors.push('周编号必须恰好覆盖 1–24，不能重复');

  const actualSources = [...new Set(data.sourceCourseIds)].sort();
  const expectedSources = [...EXPECTED_SOURCE_IDS].sort();
  if (actualSources.join(',') !== expectedSources.join(',')) errors.push('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');

  const mappedSources = new Set(data.weeks.flatMap((week) => week.sourceCourseIds));
  const unmapped = EXPECTED_SOURCE_IDS.filter((id) => !mappedSources.has(id));
  if (unmapped.length) errors.push(`未映射源课程：${unmapped.join(', ')}`);

  const missingTopics = REQUIRED_TOPICS.filter((topic) => !data.requiredTagIds.includes(topic));
  if (missingTopics.length) errors.push(`缺少核心主题：${missingTopics.join(', ')}`);
  return { ok: errors.length === 0, errors };
}

async function main() {
  const path = fileURLToPath(new URL('../../curriculum/course-map.json', import.meta.url));
  const report = validateCourseMap(JSON.parse(await readFile(path, 'utf8')));
  if (!report.ok) {
    console.error(report.errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('内容地图验证通过：24 周，46 份源课程，13 个核心主题。');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
```

- [ ] **Step 5: Verify validator success and failure behavior**

Run:

```powershell
npm test -- --run scripts/content-validation/validate-content.test.ts
npm run validate:content
```

Expected: two tests pass; CLI prints `内容地图验证通过：24 周，46 份源课程，13 个核心主题。`.

- [ ] **Step 6: Commit the map and validator**

```powershell
git add curriculum/course-map.json scripts/content-validation
git commit -m "feat: validate complete STM32 course map"
```

### Task 4: Load the validated map into a working 24-week screen

**Files:**
- Create: `web/src/domain/content/loadCourseMap.test.ts`
- Create: `web/src/domain/content/loadCourseMap.ts`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `CourseMapSchema` and `curriculum/course-map.json`.
- Produces: `loadCourseMap(): CourseMap` and a rendered list of 24 weeks.

- [ ] **Step 1: Write failing loader and UI tests**

Create `web/src/domain/content/loadCourseMap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadCourseMap } from './loadCourseMap';

describe('loadCourseMap', () => {
  it('returns the complete ordered learning path', () => {
    const map = loadCourseMap();
    expect(map.weeks).toHaveLength(24);
    expect(map.weeks[0].week).toBe(1);
    expect(map.weeks[23].week).toBe(24);
    expect(new Set(map.sourceCourseIds)).toHaveLength(46);
  });
});
```

Add to `web/src/App.test.tsx`:

```tsx
it('shows all 24 weeks from validated content', () => {
  render(<App />);
  expect(screen.getAllByRole('listitem')).toHaveLength(24);
  expect(screen.getByText('第 24 周 · 总考核、补洞与后续路线')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify the loader is missing**

Run: `npm test -- --run web/src/domain/content/loadCourseMap.test.ts web/src/App.test.tsx`

Expected: FAIL because `loadCourseMap` does not exist and the UI has no list.

- [ ] **Step 3: Implement the validated loader and map screen**

Create `web/src/domain/content/loadCourseMap.ts`:

```ts
import rawCourseMap from '../../../../curriculum/course-map.json';
import { CourseMapSchema } from './schemas';
import type { CourseMap } from './types';

export function loadCourseMap(): CourseMap {
  return CourseMapSchema.parse(rawCourseMap);
}
```

Replace `web/src/App.tsx`:

```tsx
import { loadCourseMap } from './domain/content/loadCourseMap';

export function App() {
  const courseMap = loadCourseMap();
  return (
    <main>
      <h1>STM32 系统学习平台</h1>
      <p>24 周，从零基础到能独立排查问题</p>
      <ol aria-label="24 周学习地图">
        {courseMap.weeks.map((week) => (
          <li key={week.week}>{`第 ${week.week} 周 · ${week.title}`}</li>
        ))}
      </ol>
    </main>
  );
}
```

- [ ] **Step 4: Verify loading, type checking, content validation, and production build**

Run:

```powershell
npm test
npm run validate:content
npm run typecheck
npm run build
```

Expected: tests pass, validator reports 24/46/13, TypeScript exits 0, and `dist/index.html` exists.

- [ ] **Step 5: Commit the first working product slice**

```powershell
git add web/src
git commit -m "feat: render validated 24-week learning map"
```

### Task 5: Add continuous verification and setup documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.gitignore`
- Create: `README.md`
- Create: `docs/setup/windows-toolchain.md`

**Interfaces:**
- Consumes: root npm commands from Tasks 1–4.
- Produces: CI status and a non-programmer setup path.

- [ ] **Step 1: Add the CI workflow with the same local commands**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  web-and-content:
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
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
work/
playwright-report/
test-results/
*.log
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Write setup documentation with verified local paths**

Create `docs/setup/windows-toolchain.md` with these exact checkpoints:

```markdown
# Windows 开发环境

## 这套工具各自做什么

- STM32CubeMX：用图形界面选择芯片、引脚、时钟和外设，然后生成工程。
- VS Code：编辑、构建、下载和调试代码。
- STM32CubeCLT：提供编译器、CMake、Ninja、烧录器和调试服务。

## 当前电脑已验证的位置

- STM32CubeMX：`F:\stm\mx\STM32CubeMX.exe`
- STM32CubeCLT：`F:\stm\STM32CubeCLT_1.22.0`
- VS Code 扩展：`stmicroelectronics.stm32-vscode-extension-3.9.0`

## 首次检查

在 VS Code 终端依次运行 `arm-none-eabi-gcc --version`、`cmake --version` 和 `ninja --version`。三个命令都显示版本后再进入第 3 周工程；命令找不到时先重启 VS Code，让新环境变量生效。
```

Create `README.md`:

```markdown
# STM32 系统学习平台

这是一个面向零基础学习者的 24 周 STM32F103 学习仓库。网页负责引导、记录、评分和补修；STM32CubeMX 与 VS Code 负责真实工程和调试。

## 本地查看

1. 安装 Node.js 22 或更高兼容版本。
2. 在仓库目录运行 `npm ci`。
3. 运行 `npm run dev`，打开终端给出的本地地址。

## 每次提交前

运行 `npm run validate:content`、`npm test`、`npm run typecheck` 和 `npm run build`。四项都通过才表示网页和课程结构没有已知错误；这不等于真实硬件已经验证。

详细环境说明见 `docs/setup/windows-toolchain.md`。
```

- [ ] **Step 3: Run the complete foundation gate**

Run:

```powershell
npm ci
npm run validate:content
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: every command exits 0; `dist/index.html` exists; `git diff --check` prints nothing.

- [ ] **Step 4: Commit the foundation gate**

```powershell
git add .github .gitignore README.md docs/setup
git commit -m "ci: verify platform foundation"
```

## Foundation Plan Acceptance

- [ ] A fresh clone can run `npm ci` and the four verification commands.
- [ ] The UI renders 24 ordered weeks from validated repository content.
- [ ] The validator proves all 46 source IDs and all 13 required topic families are represented.
- [ ] Invalid content produces Chinese error output and a non-zero exit code.
- [ ] The repository contains no generated `node_modules` or `dist` files.
- [ ] `git status --short` is empty after the final commit.
