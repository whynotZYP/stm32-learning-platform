import { z } from 'zod';

const Id = z.string().min(1).regex(/^[a-z0-9][a-z0-9.-]*$/);
const RepositoryPath = z.string().min(1).refine((value) => !value.includes('..'), '路径不能包含 ..');

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
  conceptPath: RepositoryPath,
  labIds: z.array(Id),
  assessmentId: Id,
  safety: z.array(z.string().min(8)).min(1),
  detectionChecks: DetectionChecksSchema,
  remediationPaths: z.array(RepositoryPath).optional(),
  extensionPaths: z.array(RepositoryPath).optional(),
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

export const RemediationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2),
  targetTagIds: z.array(Id).min(1),
  estimatedMinutes: z.number().int().min(20).max(30),
  contentPath: RepositoryPath,
  returnLessonId: Id,
});

export const ExtensionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  title: z.string().min(2),
  requiredTagIds: z.array(Id).min(1),
  contentPath: RepositoryPath,
});

export const PracticalGateSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  phase: z.number().int().min(1).max(6),
  title: z.string().min(2),
  lessonIds: z.array(Id).min(1),
  requiredTagIds: z.array(Id).min(1),
  items: z.array(AssessmentItemSchema).min(1),
});

export const CourseMapSchema = z.object({
  schemaVersion: z.literal(1),
  sourceCourseIds: z.array(z.string()).length(46),
  requiredTagIds: z.array(Id).min(12),
  weeks: z.array(WeekManifestSchema).length(24),
});
