import type { RemediationItem } from '../progress/types';
import type { TagMastery } from '../scoring/mastery';

const assertValidMasteryScore = (score: number) => {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('掌握度分数必须是 0 到 100 之间的有限数值');
  }
};

const actionFor = (tagId: string, score: number): RemediationItem['action'] => {
  if (score < 60) return 'prerequisite-reset';
  if (['usart', 'i2c', 'spi'].some((prefix) => tagId.startsWith(prefix))) return 'shared-protocol-foundation';
  if (['gpio', 'exti', 'tim', 'adc', 'dma'].some((prefix) => tagId.startsWith(prefix))) return 'signal-to-register';
  return 'concept-breakdown';
};

export function buildRemediationQueue(mastery: TagMastery[]): RemediationItem[] {
  const weakestByTag = new Map<string, TagMastery>();

  for (const item of mastery) {
    assertValidMasteryScore(item.score);
    const current = weakestByTag.get(item.tagId);
    if (!current || item.score < current.score) weakestByTag.set(item.tagId, item);
  }

  return [...weakestByTag.values()]
    .filter((item) => item.score < 70)
    .sort((first, second) => first.score - second.score || first.tagId.localeCompare(second.tagId))
    .slice(0, 3)
    .map((item) => ({
      id: `remediation-${item.tagId}`,
      tagId: item.tagId,
      reason: `${item.tagId} 当前掌握度 ${item.score}，低于阶段要求 70`,
      action: actionFor(item.tagId, item.score),
      status: 'queued',
    }));
}
