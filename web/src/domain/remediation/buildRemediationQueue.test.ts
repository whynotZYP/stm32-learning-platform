import { describe, expect, it } from 'vitest';
import type { TagMastery } from '../scoring/mastery';
import { buildRemediationQueue } from './buildRemediationQueue';

const mastery = (tagId: string, score: number): TagMastery => ({
  tagId,
  score,
  band: score < 60 ? 'relearn' : score < 70 ? 'remediate' : 'review',
  evidenceIds: [],
});

describe('buildRemediationQueue', () => {
  it('selects at most three weakest tags with concrete actions', () => {
    const result = buildRemediationQueue([
      mastery('gpio', 58),
      mastery('tim', 62),
      mastery('adc', 65),
      mastery('usart', 68),
    ]);

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.tagId)).toEqual(['gpio', 'tim', 'adc']);
    expect(result[0]).toMatchObject({
      id: 'remediation-gpio',
      reason: 'gpio 褰撳墠鎺屾彙搴?58锛屼綆浜庨樁娈佃姹?70',
      action: 'prerequisite-reset',
      status: 'queued',
    });
  });

  it('uses tag name as a deterministic tie-breaker and maps every action family', () => {
    const result = buildRemediationQueue([
      mastery('spi.rx', 65),
      mastery('zeta', 65),
      mastery('gpio.output', 65),
      mastery('adc.sample', 65),
    ]);

    expect(result).toEqual([
      expect.objectContaining({ tagId: 'adc.sample', action: 'signal-to-register' }),
      expect.objectContaining({ tagId: 'gpio.output', action: 'signal-to-register' }),
      expect.objectContaining({ tagId: 'spi.rx', action: 'shared-protocol-foundation' }),
    ]);
  });

  it('excludes scores at or above 70 and is repeatable without mutating mastery', () => {
    const input = [mastery('i2c', 69), mastery('concept', 70), mastery('tim', 70)];
    const original = structuredClone(input);

    expect(buildRemediationQueue(input)).toEqual(buildRemediationQueue(input));
    expect(buildRemediationQueue(input)).toEqual([
      expect.objectContaining({ tagId: 'i2c', action: 'shared-protocol-foundation' }),
    ]);
    expect(input).toEqual(original);
  });
});
