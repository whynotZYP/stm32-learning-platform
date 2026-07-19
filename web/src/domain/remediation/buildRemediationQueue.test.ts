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
      reason: 'gpio 当前掌握度 58，低于阶段要求 70',
      action: 'prerequisite-reset',
      status: 'queued',
    });
  });

  it('uses tag name as a deterministic tie-breaker and maps protocol actions', () => {
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

  it('orders different scores before tag names when input is unordered', () => {
    const result = buildRemediationQueue([
      mastery('zeta', 65),
      mastery('gpio', 62),
      mastery('adc', 62),
    ]);

    expect(result.map((item) => item.tagId)).toEqual(['adc', 'gpio', 'zeta']);
  });

  it('keeps a fallback action within the three-item limit', () => {
    const result = buildRemediationQueue([
      mastery('spi', 63),
      mastery('custom', 62),
      mastery('i2c', 61),
      mastery('gpio', 60),
    ]);

    expect(result).toEqual([
      expect.objectContaining({ tagId: 'gpio', action: 'signal-to-register' }),
      expect.objectContaining({ tagId: 'i2c', action: 'shared-protocol-foundation' }),
      expect.objectContaining({ tagId: 'custom', action: 'concept-breakdown' }),
    ]);
  });

  it('uses signal-to-register at the score 60 boundary', () => {
    expect(buildRemediationQueue([mastery('gpio', 60)])).toEqual([
      expect.objectContaining({ action: 'signal-to-register' }),
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

  it('keeps the lowest duplicate tag score without consuming another queue slot', () => {
    const input = [
      mastery('adc', 63),
      mastery('gpio', 68),
      mastery('tim', 60),
      mastery('gpio', 58),
      mastery('adc', 65),
    ];
    const original = structuredClone(input);

    expect(buildRemediationQueue(input)).toEqual([
      expect.objectContaining({ tagId: 'gpio', reason: 'gpio 当前掌握度 58，低于阶段要求 70' }),
      expect.objectContaining({ tagId: 'tim' }),
      expect.objectContaining({ tagId: 'adc' }),
    ]);
    expect(input).toEqual(original);
  });

  it.each([Number.NaN, Infinity, -Infinity, -0.01, 100.01])('rejects invalid mastery score %s', (score) => {
    expect(() => buildRemediationQueue([mastery('gpio', score)])).toThrow(
      '掌握度分数必须是 0 到 100 之间的有限数值',
    );
  });
});
