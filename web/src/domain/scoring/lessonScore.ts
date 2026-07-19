import type { EvidenceKind } from '../progress/types';

const WEIGHTS: Record<EvidenceKind, number> = {
  concept: 0.25,
  configuration: 0.25,
  practical: 0.35,
  reflection: 0.15,
};

export function calculateLessonScore(scores: Partial<Record<EvidenceKind, number>>): number {
  for (const kind of Object.keys(WEIGHTS) as EvidenceKind[]) {
    const score = scores[kind];
    if (score === undefined) throw new Error(`缺少评分项：${kind}`);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`${kind} 必须在 0–100 之间`);
  }

  return Math.round(
    (Object.keys(WEIGHTS) as EvidenceKind[]).reduce((total, kind) => total + scores[kind]! * WEIGHTS[kind], 0),
  );
}
