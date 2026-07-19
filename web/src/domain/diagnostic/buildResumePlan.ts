import type { LearnerState } from '../progress/types';
import type { TagMastery } from '../scoring/mastery';

export interface ResumePlan {
  needsRecall: boolean;
  currentWeek: number;
  durationMinutes: 0 | 10;
  recallTagIds: string[];
}

function parseDate(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('日期无效');
  return timestamp;
}

export function buildResumePlan(state: LearnerState, mastery: TagMastery[], now: string): ResumePlan {
  const updatedAt = parseDate(state.updatedAt);
  const current = parseDate(now);
  if (current < updatedAt) return { needsRecall: false, currentWeek: state.currentWeek, durationMinutes: 0, recallTagIds: [] };
  const gapDays = (current - updatedAt) / 86_400_000;
  if (gapDays <= 7) return { needsRecall: false, currentWeek: state.currentWeek, durationMinutes: 0, recallTagIds: [] };

  const candidates = new Map<string, number>();
  mastery.forEach((item) => {
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) throw new Error('掌握分数无效');
    if (item.band !== 'mastered' && item.band !== 'review') return;
    candidates.set(item.tagId, Math.min(candidates.get(item.tagId) ?? item.score, item.score));
  });
  const recallTagIds = [...candidates.entries()]
    .filter(([, score]) => score >= 70)
    .sort(([tagA, scoreA], [tagB, scoreB]) => scoreA - scoreB || tagA.localeCompare(tagB))
    .slice(0, 3)
    .map(([tagId]) => tagId);
  return { needsRecall: true, currentWeek: state.currentWeek, durationMinutes: 10, recallTagIds };
}
