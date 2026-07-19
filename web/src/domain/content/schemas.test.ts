import { describe, expect, it } from 'vitest';
import { CourseMapSchema, LabManifestSchema, LessonManifestSchema } from './schemas';

describe('content contracts', () => {
  it('accepts a lesson with objectives, evidence and safety text', () => {
    const result = LessonManifestSchema.safeParse({
      schemaVersion: 1,
      id: 'w04-gpio-output',
      week: 4,
      title: 'GPIO 输出与电流路径',
      estimatedMinutes: 180,
      sourceCourseIds: ['05', '06-1', '06-2'],
      prerequisiteTagIds: ['electricity.current-path'],
      targetTagIds: ['gpio.output-mode'],
      objectives: ['能解释推挽输出时电流从哪里流到哪里'],
      conceptPath: 'curriculum/weeks/w04.md',
      labIds: ['lab-w04-gpio-output'],
      assessmentId: 'assessment-w04',
      safety: ['LED 必须串联限流电阻。'],
      detectionChecks: [
        { mode: 'automatic', action: '运行 GPIO 回读检查', expectedEvidence: '串口返回引脚高低电平', limitation: '不能证明 LED 亮度', applicable: true, evidenceSource: 'device', physicalHardware: true },
        { mode: 'semi-automatic', action: '按下按键并确认计数变化', expectedEvidence: '计数和观察确认', limitation: '需要学习者确认现象', applicable: true, evidenceSource: 'device', physicalHardware: true },
        { mode: 'manual', action: '观察 LED 是否点亮', expectedEvidence: '学习者勾选观察结果', limitation: '不能由模拟器或构建结果证明', applicable: true, evidenceSource: 'manual', physicalHardware: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a hardware lesson without a safety instruction', () => {
    const result = LessonManifestSchema.safeParse({
      schemaVersion: 1,
      id: 'w04-gpio-output',
      week: 4,
      title: 'GPIO 输出',
      estimatedMinutes: 180,
      sourceCourseIds: ['05'],
      prerequisiteTagIds: [],
      targetTagIds: ['gpio.output-mode'],
      objectives: ['能解释推挽输出'],
      conceptPath: 'curriculum/weeks/w04.md',
      labIds: ['lab-w04-gpio-output'],
      assessmentId: 'assessment-w04',
      safety: [],
      detectionChecks: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a course map with fewer than 24 weeks', () => {
    expect(CourseMapSchema.safeParse({ schemaVersion: 1, sourceCourseIds: [], requiredTagIds: [], weeks: [] }).success).toBe(false);
  });

  it('rejects missing modes and a non-applicable check without a reason', () => {
    expect(LessonManifestSchema.safeParse({ schemaVersion: 1, id: 'w01-foundations', week: 1, title: '基础', estimatedMinutes: 180, sourceCourseIds: ['05'], prerequisiteTagIds: [], targetTagIds: ['foundation.binary'], objectives: ['能够解释二进制与十六进制的关系'], conceptPath: 'curriculum/weeks/w01.md', labIds: ['lab-w01-breadboard'], assessmentId: 'assessment-w01', safety: ['断电后再检查接线。'], detectionChecks: [{ mode: 'automatic', action: '运行桌面练习', expectedEvidence: '测试输出', limitation: '不涉及物理硬件', applicable: false, evidenceSource: 'simulator', physicalHardware: false }] }).success).toBe(false);
    expect(LessonManifestSchema.safeParse({ schemaVersion: 1, id: 'w01-foundations', week: 1, title: '基础', estimatedMinutes: 180, sourceCourseIds: ['05'], prerequisiteTagIds: [], targetTagIds: ['foundation.binary'], objectives: ['能够解释二进制与十六进制的关系'], conceptPath: 'curriculum/weeks/w01.md', labIds: ['lab-w01-breadboard'], assessmentId: 'assessment-w01', safety: ['断电后再检查接线。'], detectionChecks: [{ mode: 'automatic', action: '运行模拟器检查', expectedEvidence: '模拟器日志', limitation: '不能证明物理硬件', applicable: true, evidenceSource: 'simulator', physicalHardware: true, reason: '故意构造无效物理声明' }, { mode: 'semi-automatic', action: '设备检查', expectedEvidence: '设备日志', limitation: '需确认', applicable: true, evidenceSource: 'device', physicalHardware: true }, { mode: 'manual', action: '手动观察', expectedEvidence: '观察记录', limitation: '主观确认', applicable: true, evidenceSource: 'manual', physicalHardware: true }] }).success).toBe(false);
    expect(LabManifestSchema.safeParse({ schemaVersion: 1, id: 'lab-w01-breadboard', lessonId: 'w01-foundations', title: '面包板检查', hardware: ['面包板'], wiringChecklist: ['断电后检查电源轨与导线'], safety: ['断电后再接线。'], expectedObservations: ['连接路径完整'], faultTasks: ['断开一根导线后定位'], detectionChecks: [] }).success).toBe(false);
  });
});
