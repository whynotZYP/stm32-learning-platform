import type { TagMastery } from '../scoring/mastery';

export interface DiagnosticPath {
  recommendedWeek: 1 | 3 | 5;
  validationTaskIds: string[];
  reasons: string[];
}

const foundationTagIds = ['foundation.electricity', 'foundation.binary', 'c.control-flow', 'c.memory'];

function validScore(score: number): number {
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : 0;
}

export function buildDiagnosticPath(mastery: TagMastery[]): DiagnosticPath {
  const scores = new Map<string, number>();
  for (const item of mastery) {
    const score = validScore(item.score);
    scores.set(item.tagId, Math.min(scores.get(item.tagId) ?? score, score));
  }
  const mastered = (ids: string[]) => ids.every((id) => (scores.get(id) ?? 0) >= 85);
  const cReady = mastered(foundationTagIds);
  if (cReady && mastered(['gpio.output-mode'])) {
    return { recommendedWeek: 5, validationTaskIds: ['gate-01-practical'], reasons: ['基础、电学、C 和 GPIO 标签均达到 85；先通过第一阶段实操再跳到第 5 周。'] };
  }
  if (cReady) {
    return { recommendedWeek: 3, validationTaskIds: ['lab-w03-first-project'], reasons: ['基础和 C 标签达到 85；从工具链实操开始。'] };
  }
  return { recommendedWeek: 1, validationTaskIds: [], reasons: ['基础标签尚未全部达到 85；从第 1 周建立安全和数制基础。'] };
}
