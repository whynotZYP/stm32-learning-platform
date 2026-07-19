import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LabManifest, LessonManifest } from '../domain/content/types';
import { LabChecklist } from './LabChecklist';

afterEach(cleanup);

const lab: LabManifest = {
  schemaVersion: 1, id: 'lab-w04-led', lessonId: 'w04-gpio-output', title: 'LED 输出实验',
  hardware: ['STM32 开发板', 'LED'], wiringChecklist: ['将 LED 与限流电阻串联后接到 GPIO。'], safety: ['接线已断电复核'],
  expectedObservations: ['LED 按设定周期闪烁'], faultTasks: ['断开限流电阻并说明为什么不能上电。'],
  detectionChecks: [
    { mode: 'automatic', action: '读取 GPIO 状态寄存器', expectedEvidence: '寄存器状态变化', limitation: '不能证明外部 LED 发光', applicable: true, evidenceSource: 'device', physicalHardware: true },
    { mode: 'semi-automatic', action: '拍摄 LED 闪烁视频', expectedEvidence: '视频显示闪烁', limitation: '需要人工核对视频', applicable: true, evidenceSource: 'device', physicalHardware: true },
    { mode: 'manual', action: '观察 LED 是否按周期闪烁', expectedEvidence: '人工观察记录', limitation: '不能替代电气测量', applicable: true, evidenceSource: 'manual', physicalHardware: true },
  ],
};

const lesson: LessonManifest = {
  schemaVersion: 1, id: 'w04-gpio-output', week: 4, title: 'GPIO 输出', estimatedMinutes: 60, sourceCourseIds: ['05'], prerequisiteTagIds: [], targetTagIds: ['gpio.output-mode'], objectives: ['完成一个安全的 GPIO 输出实验。'], conceptPath: 'curriculum/w04.md', labIds: ['lab-w04-led'], assessmentId: 'entry-diagnostic', safety: ['接线已断电复核并确认极性'], detectionChecks: lab.detectionChecks,
};

describe('LabChecklist', () => {
  it('requires the exact safety and named observation confirmations before emitting one manual record', () => {
    const onConfirm = vi.fn();
    render(<LabChecklist lesson={lesson} lab={lab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: '记录实验观察' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '接线已断电复核' }));
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '观察到：LED 按设定周期闪烁' }));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ lessonId: 'w04-gpio-output', tagIds: ['gpio.output-mode'], kind: 'practical', status: 'manual-confirmed', score: 100, source: 'manual', createdAt: '2026-07-19T00:00:00.000Z', details: expect.objectContaining({ safetyConfirmed: true, observation: 'LED 按设定周期闪烁', detectionMode: 'manual' }) }));
  });

  it('refuses an inapplicable or non-manual detection path and a mismatched lesson', () => {
    const onConfirm = vi.fn();
    const unavailableLab: LabManifest = { ...lab, detectionChecks: lab.detectionChecks.map((check) => check.mode === 'manual' ? { ...check, evidenceSource: 'device' } : check) };
    const { rerender } = render(<LabChecklist lesson={lesson} lab={unavailableLab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    expect(screen.getByText('此实验暂时不能记录人工观察。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记录实验观察' })).toBeDisabled();
    rerender(<LabChecklist lesson={{ ...lesson, id: 'w05-gpio-input' }} lab={lab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    expect(screen.getByText('实验与课程信息不匹配，暂时不能记录。')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not trust a caller object that is not a valid lesson manifest', () => {
    const onConfirm = vi.fn();
    const invalidLesson = { ...lesson, estimatedMinutes: 1 } as LessonManifest;
    render(<LabChecklist lesson={invalidLesson} lab={lab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    expect(screen.getByText('此实验暂时不能记录人工观察。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记录实验观察' })).toBeDisabled();
  });

  it('requires the lab to be listed by its matching lesson before recording evidence', () => {
    const onConfirm = vi.fn();
    render(<LabChecklist lesson={{ ...lesson, labIds: ['lab-other'] }} lab={lab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    expect(screen.getByText('实验与课程信息不匹配，暂时不能记录。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '记录实验观察' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resets confirmations for a new matching lab and derives that lesson targets', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<LabChecklist lesson={lesson} lab={lab} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('checkbox', { name: '接线已断电复核' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '观察到：LED 按设定周期闪烁' }));
    fireEvent.click(screen.getByRole('button', { name: '记录实验观察' }));
    const nextLab = { ...lab, id: 'lab-w05-button', lessonId: 'w05-gpio-input', expectedObservations: ['按键按下后 LED 改变状态'] };
    const nextLesson = { ...lesson, id: 'w05-gpio-input', week: 5, targetTagIds: ['gpio.input-mode'], labIds: ['lab-w05-button'] };
    rerender(<LabChecklist lesson={nextLesson} lab={nextLab} now="2026-07-20T00:00:00.000Z" onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: '记录实验观察' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '接线已断电复核' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '观察到：按键按下后 LED 改变状态' }));
    fireEvent.click(screen.getByRole('button', { name: '记录实验观察' }));
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ lessonId: 'w05-gpio-input', tagIds: ['gpio.input-mode'] }));
  });
});
