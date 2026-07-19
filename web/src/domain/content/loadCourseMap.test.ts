import { describe, expect, it } from 'vitest';
import { loadCourseMap } from './loadCourseMap';

describe('loadCourseMap', () => {
  it('returns the complete ordered learning path', () => {
    const map = loadCourseMap();

    expect(map.weeks).toHaveLength(24);
    expect(map.weeks[0].week).toBe(1);
    expect(map.weeks[23].week).toBe(24);
    expect(new Set(map.sourceCourseIds)).toHaveLength(46);
  });
});
