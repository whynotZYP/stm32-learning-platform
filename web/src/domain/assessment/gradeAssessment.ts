import type { Assessment } from '../content/types';
import type { EvidenceRecord } from '../progress/types';

export interface AssessmentAnswer {
  score: number;
  response: string;
}

const normalizeAnswer = (value: string) => value.trim().toLocaleLowerCase('en-US');

function normalizedScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round((Math.min(Math.max(score, 0), maxScore) / maxScore) * 100);
}

export function gradeAssessment(assessment: Assessment, answers: Record<string, AssessmentAnswer>, now: string): EvidenceRecord[] {
  return assessment.items.map((item) => {
    const answer = answers[item.id];
    const response = answer?.response ?? '';
    const score = normalizedScore(answer?.score ?? 0, item.maxScore);
    const submitted = response.trim().length > 0;
    const objectiveMatch = Boolean(item.answer) && normalizeAnswer(response) === normalizeAnswer(item.answer!);
    const status = !submitted || score === 0
      ? 'failed'
      : item.answer
        ? objectiveMatch ? 'auto-pass' : 'failed'
        : 'manual-confirmed';
    return {
      id: `assessment-${assessment.id}-${item.id}-${now}`,
      learnerId: 'local',
      lessonId: assessment.lessonId,
      tagIds: [...item.tagIds],
      kind: item.kind,
      status,
      score: status === 'failed' ? 0 : score,
      source: 'assessment',
      createdAt: now,
      details: { prompt: item.prompt, response, maxScore: item.maxScore },
    };
  });
}
