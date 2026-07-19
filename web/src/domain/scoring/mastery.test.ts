import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '../progress/types';
import { calculateTagMastery } from './mastery';

const evidence = (
  score: number,
  createdAt: string,
  status: EvidenceRecord['status'] = 'auto-pass',
  tagIds = ['gpio.output-mode'],
): EvidenceRecord => ({
  id: `${score}-${createdAt}`,
  learnerId: 'local',
  lessonId: 'w04-gpio-output',
  tagIds,
  kind: 'concept',
  status,
  score,
  source: 'assessment',
  createdAt,
  details: {},
});

describe('calculateTagMastery', () => {
  it('weights newest three valid scores 50/30/20', () => {
    const records = [
      evidence(60, '2026-01-01T00:00:00.000Z'),
      evidence(70, '2026-02-01T00:00:00.000Z'),
      evidence(80, '2026-03-01T00:00:00.000Z'),
      evidence(90, '2026-04-01T00:00:00.000Z'),
    ];

    const result = calculateTagMastery('gpio.output-mode', records);

    expect(result.score).toBe(83);
    expect(result.band).toBe('review');
    expect(result.evidenceIds).toEqual([
      '90-2026-04-01T00:00:00.000Z',
      '80-2026-03-01T00:00:00.000Z',
      '70-2026-02-01T00:00:00.000Z',
    ]);
    expect(records.map((item) => item.id)).toEqual([
      '60-2026-01-01T00:00:00.000Z',
      '70-2026-02-01T00:00:00.000Z',
      '80-2026-03-01T00:00:00.000Z',
      '90-2026-04-01T00:00:00.000Z',
    ]);
  });

  it('normalizes one valid score after excluding pending evidence', () => {
    const result = calculateTagMastery('gpio.output-mode', [
      evidence(95, '2026-04-01T00:00:00.000Z', 'pending'),
      evidence(55, '2026-03-01T00:00:00.000Z', 'failed'),
    ]);

    expect(result.score).toBe(55);
    expect(result.band).toBe('relearn');
    expect(result.evidenceIds).toEqual(['55-2026-03-01T00:00:00.000Z']);
  });

  it('returns relearn with no score when there is no valid evidence for the tag', () => {
    expect(calculateTagMastery('gpio.output-mode', [
      evidence(100, '2026-04-01T00:00:00.000Z', 'pending'),
      evidence(100, '2026-03-01T00:00:00.000Z', 'auto-pass', ['timer.pwm']),
    ])).toEqual({ tagId: 'gpio.output-mode', score: 0, band: 'relearn', evidenceIds: [] });
  });

  it.each([
    [0, 'relearn'],
    [60, 'remediate'],
    [70, 'review'],
    [85, 'mastered'],
  ] as const)('assigns %i to the exact %s band boundary', (score, band) => {
    expect(calculateTagMastery('gpio.output-mode', [
      evidence(score, '2026-04-01T00:00:00.000Z'),
    ])).toMatchObject({ score, band });
  });

  it('rounds a fractional weighted score once', () => {
    expect(calculateTagMastery('gpio.output-mode', [
      evidence(1, '2026-01-01T00:00:00.000Z'),
      evidence(1, '2026-02-01T00:00:00.000Z'),
      evidence(2, '2026-03-01T00:00:00.000Z'),
    ])).toMatchObject({ score: 2, band: 'relearn' });
  });

  it('normalizes the newest two scores by their available weights', () => {
    expect(calculateTagMastery('gpio.output-mode', [
      evidence(40, '2026-01-01T00:00:00.000Z'),
      evidence(80, '2026-02-01T00:00:00.000Z'),
    ])).toMatchObject({ score: 65, band: 'remediate' });
  });
});
