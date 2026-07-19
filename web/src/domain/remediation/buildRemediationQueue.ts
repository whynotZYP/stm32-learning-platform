import type { RemediationItem } from '../progress/types';
import type { TagMastery } from '../scoring/mastery';

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
      reason: `${item.tagId} 褰撳墠鎺屾彙搴?${item.score}锛屼綆浜庨樁娈佃姹?70`,
      action: actionFor(item.tagId, item.score),
      status: 'queued',
    }));
}
