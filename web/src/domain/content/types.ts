import type { z } from 'zod';
import type {
  AssessmentSchema,
  CourseMapSchema,
  DetectionCheckSchema,
  KnowledgeTagSchema,
  LabManifestSchema,
  LessonManifestSchema,
  WeekManifestSchema,
} from './schemas';

export type Assessment = z.infer<typeof AssessmentSchema>;
export type CourseMap = z.infer<typeof CourseMapSchema>;
export type DetectionCheck = z.infer<typeof DetectionCheckSchema>;
export type KnowledgeTag = z.infer<typeof KnowledgeTagSchema>;
export type LabManifest = z.infer<typeof LabManifestSchema>;
export type LessonManifest = z.infer<typeof LessonManifestSchema>;
export type WeekManifest = z.infer<typeof WeekManifestSchema>;
