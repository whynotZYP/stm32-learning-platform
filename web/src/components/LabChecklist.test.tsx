import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LabManifest } from '../domain/content/types';
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

describe('LabChecklist', () => {
  it('requires the exact safety and named observation confirmations before emitting one manual record', () => {
    const onConfirm = vi.fn();
    render(<LabChecklist lab={lab} tagIds={['gpio.output-mode']} now="2026-07-19T00:00:00.000Z" onConfirm={onConfirm} />);
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
});
