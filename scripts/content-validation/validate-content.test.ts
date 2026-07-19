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

  it('requires exact source and topic sets for schema-valid maps', async () => {
    const valid = (await import('../../curriculum/course-map.json', { with: { type: 'json' } })).default;
    const broken = structuredClone(valid);
    broken.sourceCourseIds[0] = '50';
    broken.weeks[0].sourceCourseIds.push('50');
    broken.requiredTagIds.push('unexpected.topic', 'gpio.output-mode');

    const report = validateCourseMap(broken);

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
    expect(report.errors).toContain('周映射包含未知源课程：50');
    expect(report.errors).toContain('核心主题必须与规定主题精确相等，不能缺少、额外或重复');
  });

  it('reports every semantic error for a schema-valid mixed invalid map', async () => {
    const valid = (await import('../../curriculum/course-map.json', { with: { type: 'json' } })).default;
    const broken = structuredClone(valid);
    broken.weeks[1].week = 1;
    broken.sourceCourseIds[0] = '50';
    broken.weeks[0].sourceCourseIds.push('50');
    broken.weeks[21].sourceCourseIds = broken.weeks[21].sourceCourseIds.filter((id) => id !== '49');
    broken.requiredTagIds = broken.requiredTagIds.filter((id) => id !== 'flash.persistence');
    broken.requiredTagIds.push('unexpected.topic', 'gpio.output-mode');

    const report = validateCourseMap(broken);

    expect(report.errors).toContain('周编号必须恰好覆盖 1–24，不能重复');
    expect(report.errors).toContain('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
    expect(report.errors).toContain('周映射包含未知源课程：50');
    expect(report.errors).toContain('未映射源课程：49');
    expect(report.errors).toContain('核心主题必须与规定主题精确相等，不能缺少、额外或重复');
  });

  it('reports all readable semantic errors alongside schema errors', async () => {
    const valid = (await import('../../curriculum/course-map.json', { with: { type: 'json' } })).default;
    const broken = structuredClone(valid);
    broken.weeks[0].title = '';
    broken.weeks[1].week = 1;
    broken.sourceCourseIds[0] = '50';
    broken.weeks[0].sourceCourseIds.push('50');
    broken.weeks[21].sourceCourseIds = broken.weeks[21].sourceCourseIds.filter((id) => id !== '49');
    broken.requiredTagIds = broken.requiredTagIds.filter((id) => id !== 'flash.persistence');
    broken.requiredTagIds.push('unexpected.topic', 'gpio.output-mode');

    const report = validateCourseMap(broken);

    expect(report.errors).toContain('课程地图结构无效');
    expect(report.errors).toContain('周编号必须恰好覆盖 1–24，不能重复');
    expect(report.errors).toContain('源课程必须完整覆盖 05–49，并包含 06-1/06-2，共 46 份');
    expect(report.errors).toContain('周映射包含未知源课程：50');
    expect(report.errors).toContain('未映射源课程：49');
    expect(report.errors).toContain('核心主题必须与规定主题精确相等，不能缺少、额外或重复');
  });
});
