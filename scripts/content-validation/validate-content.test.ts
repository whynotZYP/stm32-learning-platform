import { describe, expect, it } from 'vitest';
import { validateCourseMap } from './validate-content';

describe('validateCourseMap', () => {
  it('reports missing source IDs and missing required topics', () => {
    const report = validateCourseMap({ schemaVersion: 1, sourceCourseIds: [], requiredTagIds: [], weeks: [] });

    expect(report.ok).toBe(false);
    expect(report.errors.join('\n')).toContain('课程地图结构无效');
  });

  it('reports duplicate week numbers after schema validation', async () => {
    const valid = (await import('../../curriculum/course-map.json', { with: { type: 'json' } })).default;
    const broken = structuredClone(valid);
    broken.weeks[1].week = 1;
    const report = validateCourseMap(broken);

    expect(report.errors).toContain('周编号必须恰好覆盖 1–24，不能重复');
  });
});
