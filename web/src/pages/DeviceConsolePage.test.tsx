import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgressProvider } from '../app/ProgressContext';
import { createDefaultState } from '../domain/progress/defaultState';
import type { ProgressRepository } from '../domain/progress/repository';
import type { DeviceTransport } from '../device/transport/DeviceTransport';
import { SimulatorTransport } from '../device/transport/SimulatorTransport';
import { DeviceConsolePage } from './DeviceConsolePage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'serial', { configurable: true, value: undefined });
});

function repository() {
  const saved: ReturnType<typeof createDefaultState>[] = [];
  let state = createDefaultState('2026-07-19T00:00:00.000Z');
  const store: ProgressRepository & { saved: typeof saved } = {
    saved,
    async load() { return structuredClone(state); },
    async save(next) { state = structuredClone(next); saved.push(structuredClone(next)); },
    async snapshot() { return structuredClone(state); },
    async replace(next) { state = structuredClone(next); },
  };
  return store;
}

function completeSafety() {
  for (const label of ['3.3 V TTL', 'TX/RX 交叉', '已经共地', '单一供电来源']) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(label) }));
  }
}

function renderPage(props: React.ComponentProps<typeof DeviceConsolePage> = {}) {
  const store = repository();
  render(<ProgressProvider repository={store}><DeviceConsolePage {...props} /></ProgressProvider>);
  return store;
}

class RespondingTransport implements DeviceTransport {
  readonly kind = 'serial' as const;
  connected = false;
  constructor(
    private readonly resultDetails: Record<string, string | number | boolean> = {},
    private readonly failure?: Error,
  ) {}
  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  async writeLine(line: string) { this.request = JSON.parse(line); }
  private request?: { id: string; test: string };
  async *readChunks() {
    if (this.failure) throw this.failure;
    yield `${JSON.stringify({
      v: 1,
      id: this.request?.id,
      type: 'result',
      test: this.request?.test,
      status: 'pass',
      details: this.resultDetails,
    })}\n`;
  }
}

describe('DeviceConsolePage', () => {
  it('keeps port selection behind four explicit safety confirmations and a click', async () => {
    const port = {
      readable: new ReadableStream<Uint8Array>(),
      writable: new WritableStream<Uint8Array>(),
      open: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } satisfies SerialPort;
    const serial = Object.assign(new EventTarget(), { requestPort: vi.fn(async () => port) }) as Serial;
    Object.defineProperty(navigator, 'serial', { configurable: true, value: serial });
    renderPage();
    const connect = screen.getByRole('button', { name: '连接开发板' });
    expect(connect).toBeDisabled();
    expect(serial.requestPort).not.toHaveBeenCalled();

    completeSafety();
    expect(connect).toBeEnabled();
    fireEvent.click(connect);

    await waitFor(() => expect(serial.requestPort).toHaveBeenCalledOnce());
    expect(await screen.findByText('开发板已连接')).toBeInTheDocument();
  });

  it('shows Chrome/Edge guidance and manual mode when Web Serial is unsupported', async () => {
    renderPage();
    completeSafety();
    fireEvent.click(screen.getByRole('button', { name: '连接开发板' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chrome 或 Edge');
    expect(screen.getByRole('heading', { name: '人工观察记录' })).toBeInTheDocument();
  });

  it('disables unsafe tests after a wrong-firmware hello but keeps identity checks available', async () => {
    const transport = new RespondingTransport({ firmware: 'other-firmware' });
    const store = renderPage({ createSerialTransport: () => transport });
    completeSafety();
    fireEvent.click(screen.getByRole('button', { name: '连接开发板' }));
    await screen.findByText('开发板已连接');
    fireEvent.click(within(screen.getByRole('article', { name: '检测固件握手' })).getByRole('button', { name: '开始检测' }));
    expect(await screen.findByRole('status')).toHaveTextContent('固件版本不匹配');

    expect(within(screen.getByRole('article', { name: 'W25Q64 固定扇区往返' })).getByRole('button', { name: '开始检测' })).toBeDisabled();
    expect(within(screen.getByRole('article', { name: '读取芯片唯一标识' })).getByRole('button', { name: '开始检测' })).toBeEnabled();
    expect(store.saved.at(-1)?.evidence.at(-1)?.status).toBe('failed');
  });

  it('records a simulator pass as pending and labels it as non-physical', async () => {
    const store = renderPage({
      simulatorEnabled: true,
      createSimulatorTransport: () => new SimulatorTransport('pass', 0),
    });
    completeSafety();
    fireEvent.click(screen.getByRole('button', { name: '使用模拟器' }));
    await screen.findByText('模拟器已连接');
    fireEvent.click(within(screen.getByRole('article', { name: '检测固件握手' })).getByRole('button', { name: '开始检测' }));

    expect(await screen.findByText('模拟结果，不能计为实机通过')).toBeInTheDocument();
    await waitFor(() => expect(store.saved.at(-1)?.evidence.at(-1)).toMatchObject({
      status: 'pending',
      score: 0,
      details: { simulated: true },
    }));
  });

  it('lets the development simulator reproduce a failed device result', async () => {
    const store = renderPage({ simulatorEnabled: true });
    completeSafety();
    fireEvent.change(screen.getByLabelText('模拟场景'), { target: { value: 'fail' } });
    fireEvent.click(screen.getByRole('button', { name: '使用模拟器' }));
    await screen.findByText('模拟器已连接');
    const card = screen.getByRole('article', { name: '检测固件握手' });
    fireEvent.click(within(card).getByRole('button', { name: '开始检测' }));

    await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent('system.hello: fail'));
    expect(store.saved.at(-1)?.evidence.at(-1)?.status).toBe('pending');
  });

  it('requires a separate named observation before confirming semi-automatic evidence', async () => {
    const store = renderPage({ createSerialTransport: () => new RespondingTransport({ eventCount: 3 }) });
    completeSafety();
    fireEvent.click(screen.getByRole('button', { name: '连接开发板' }));
    await screen.findByText('开发板已连接');
    const card = screen.getByRole('article', { name: 'EXTI 事件计数' });
    fireEvent.click(within(card).getByRole('button', { name: '开始检测' }));
    await within(card).findByText('待人工确认');
    const confirm = within(card).getByRole('button', { name: '确认观察现象' });
    expect(confirm).toBeDisabled();

    fireEvent.click(within(card).getByRole('checkbox', { name: /返回事件次数和时间戳/ }));
    fireEvent.click(confirm);

    await waitFor(() => expect(store.saved.at(-1)?.evidence.at(-1)).toMatchObject({
      status: 'manual-confirmed',
      source: 'manual',
    }));
    expect(store.saved.at(-1)?.evidence.at(-1)?.details).not.toHaveProperty('eventCount');
  });

  it('keeps the log and shows a concrete retry checklist after disconnect', async () => {
    renderPage({ createSerialTransport: () => new RespondingTransport({}, new Error('USB cable removed')) });
    completeSafety();
    fireEvent.click(screen.getByRole('button', { name: '连接开发板' }));
    await screen.findByText('开发板已连接');
    fireEvent.click(within(screen.getByRole('article', { name: '检测固件握手' })).getByRole('button', { name: '开始检测' }));

    expect(await screen.findByRole('heading', { name: '重试前检查' })).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('system.hello');
    expect(screen.getByRole('log')).toHaveTextContent('USB cable removed');
  });
});
