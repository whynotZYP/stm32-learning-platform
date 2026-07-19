import { z } from 'zod';

const Id = z.string().min(1).regex(/^[a-z0-9][a-z0-9.-]*$/);
export const RepositoryPathSchema = z.string().min(1)
  .refine((value) => !/^[A-Za-z]:/.test(value) && !value.startsWith('/') && !value.startsWith('\\') && !value.includes('\\'), '路径必须是使用正斜杠的仓库相对路径')
  .refine((value) => !value.split('/').includes('..'), '路径不能包含 ..');
const RemediationContentPathSchema = RepositoryPathSchema.refine((value) => /^curriculum\/remediation\/[^/]+\.md$/.test(value), '补救内容必须位于 curriculum/remediation/*.md');
const ExtensionContentPathSchema = RepositoryPathSchema.refine((value) => /^curriculum\/extensions\/[^/]+\.md$/.test(value), '拓展内容必须位于 curriculum/extensions/*.md');

export const KnowledgeTagSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2).regex(/\p{Script=Han}/u, '标题必须包含中文'),
  plainLanguage: z.string().min(10).regex(/\p{Script=Han}/u, '通俗说明必须包含中文'),
  prerequisiteTagIds: z.array(Id),
});

export const DetectionModeSchema = z.enum(['automatic', 'semi-automatic', 'manual']);
export const DetectionEvidenceSourceSchema = z.enum(['simulator', 'device', 'manual']);
export const CORE_HARDWARE_TAG_IDS = [
  'gpio.output-mode', 'exti.event-flow', 'tim.timebase', 'adc.sampling',
  'dma.transfer', 'usart.physical-frame', 'i2c.protocol', 'spi.protocol',
  'rtc.time', 'pwr.low-power', 'wdg.recovery', 'flash.persistence',
] as const;
export const DetectionCheckSchema = z.object({
  mode: DetectionModeSchema,
  action: z.string().min(8),
  expectedEvidence: z.string().min(4),
  limitation: z.string().min(4),
  applicable: z.boolean(),
  evidenceSource: DetectionEvidenceSourceSchema,
  physicalHardware: z.boolean(),
  reason: z.string().min(1).optional(),
}).superRefine((check, context) => {
  if (!check.applicable && !check.reason?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: '不适用时必须说明原因' });
  if (check.evidenceSource === 'simulator' && check.physicalHardware) context.addIssue({ code: z.ZodIssueCode.custom, path: ['physicalHardware'], message: '模拟器不能声明物理硬件证据' });
});

const DetectionChecksSchema = z.array(DetectionCheckSchema).length(3).superRefine((checks, context) => {
  const modes = checks.map((check) => check.mode);
  if (new Set(modes).size !== 3 || !['automatic', 'semi-automatic', 'manual'].every((mode) => modes.includes(mode as typeof checks[number]['mode']))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '必须分别声明 automatic、semi-automatic、manual 三种检测方式' });
  }
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
  conceptPath: RepositoryPathSchema,
  labIds: z.array(Id),
  assessmentId: Id,
  safety: z.array(z.string().min(8)).min(1),
  detectionChecks: DetectionChecksSchema,
  remediationPaths: z.array(RepositoryPathSchema).optional(),
  extensionPaths: z.array(RepositoryPathSchema).optional(),
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
  safety: z.array(z.string().min(7)).min(1),
  expectedObservations: z.array(z.string().min(4)).min(1),
  faultTasks: z.array(z.string().min(8)).min(1),
  detectionChecks: DetectionChecksSchema,
  firmwareProject: RepositoryPathSchema.optional(),
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

export const RemediationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2),
  targetTagIds: z.array(Id).min(1),
  estimatedMinutes: z.number().int().min(20).max(40),
  contentPath: RemediationContentPathSchema,
  returnLessonId: Id,
}).strict();

export const ExtensionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2),
  requiredTagIds: z.array(Id).min(1),
  contentPath: ExtensionContentPathSchema,
}).strict();

export const PracticalGateSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  phase: z.number().int().min(1).max(6),
  title: z.string().min(2),
  lessonIds: z.array(Id).min(1),
  requiredTagIds: z.array(Id).min(1),
  items: z.array(AssessmentItemSchema).min(4),
}).strict().superRefine((gate, context) => {
  const itemIds = gate.items.map((item) => item.id);
  if (new Set(itemIds).size !== itemIds.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: '实践考核题目 ID 必须唯一' });
  const expectedTotals: Record<string, number> = { concept: 25, configuration: 25, practical: 35, reflection: 15 };
  const actualTotals: Record<string, number> = {};
  for (const item of gate.items) actualTotals[item.kind] = (actualTotals[item.kind] ?? 0) + item.maxScore;
  if (Object.entries(expectedTotals).some(([kind, total]) => actualTotals[kind] !== total)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: '实践考核必须按 25/25/35/15 覆盖四类证据' });
  }
});

export const CourseMapSchema = z.object({
  schemaVersion: z.literal(1),
  sourceCourseIds: z.array(z.string()).length(46),
  requiredTagIds: z.array(Id).min(12),
  weeks: z.array(WeekManifestSchema).length(24),
});
