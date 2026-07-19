import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeviceTransport } from '../transport/DeviceTransport';
import { SimulatorTransport } from '../transport/SimulatorTransport';
import { DeviceRunError, runDeviceTest } from './runDeviceTest';

class ScriptedTransport implements DeviceTransport {
  readonly kind = 'serial' as const;
  writes: string[] = [];
  closed = false;

  constructor(private readonly chunks: string[]) {}

  async connect() {}
  async disconnect() {}
  async writeLine(line: string) { this.writes.push(line); }

  async *readChunks(): AsyncIterable<string> {
    try {
      for (const chunk of this.chunks) yield chunk;
    } finally {
      this.closed = true;
    }
  }
}

const progress = JSON.stringify({
  v: 1,
  id: 'req-1',
  type: 'progress',
  test: 'system.hello',
  step: '握手中',
  percent: 50,
});
const result = (id: string, test = 'system.hello') => JSON.stringify({
  v: 1,
  id,
  type: 'result',
  test,
  status: 'pass',
  details: { firmware: 'device-test-v1' },
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runDeviceTest', () => {
  it('ignores progress and another request ID, then returns the matching result', async () => {
    const transport = new ScriptedTransport([
      `${progress}\n${result('another')}\n`,
      `${result('req-1')}\n`,
    ]);

    const outcome = await runDeviceTest({
      transport,
      testId: 'system.hello',
      requestId: 'req-1',
      now: () => '2026-07-19T12:00:00.000Z',
    });

    expect(outcome.result.id).toBe('req-1');
    expect(outcome.receivedAt).toBe('2026-07-19T12:00:00.000Z');
    expect(transport.closed).toBe(true);
    expect(JSON.parse(transport.writes[0])).toEqual({
      v: 1,
      id: 'req-1',
      type: 'run',
      test: 'system.hello',
      params: {},
    });
  });

  it('turns a matching device error into a typed failure and closes the reader', async () => {
    const transport = new ScriptedTransport([`${JSON.stringify({
      v: 1,
      id: 'req-1',
      type: 'error',
      test: 'system.hello',
      code: 'HARDWARE',
      message: '串口自检失败',
    })}\n`]);

    await expect(runDeviceTest({ transport, testId: 'system.hello', requestId: 'req-1' }))
      .rejects.toMatchObject({ code: 'DEVICE_ERROR', deviceCode: 'HARDWARE', message: '串口自检失败' });
    expect(transport.closed).toBe(true);
  });

  it('rejects malformed or wrong-version messages explicitly', async () => {
    const malformed = new ScriptedTransport(['{not-json}\n']);
    await expect(runDeviceTest({ transport: malformed, testId: 'system.hello', requestId: 'req-1' }))
      .rejects.toMatchObject({ code: 'INVALID_MESSAGE' });

    const wrongVersion = new ScriptedTransport([`${JSON.stringify({
      v: 2,
      id: 'req-1',
      type: 'result',
      test: 'system.hello',
      status: 'pass',
      details: {},
    })}\n`]);
    await expect(runDeviceTest({ transport: wrongVersion, testId: 'system.hello', requestId: 'req-1' }))
      .rejects.toMatchObject({ code: 'INVALID_MESSAGE' });
  });

  it('aborts at the catalog timeout', async () => {
    vi.useFakeTimers();
    const transport = new SimulatorTransport('timeout', 0);
    await transport.connect();
    const running = runDeviceTest({ transport, testId: 'system.hello', requestId: 'req-timeout' });
    const rejection = expect(running).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(2_000);

    await rejection;
  });

  it('supports external cancellation', async () => {
    const transport = new SimulatorTransport('timeout', 0);
    const abort = new AbortController();
    await transport.connect();
    const running = runDeviceTest({
      transport,
      testId: 'system.hello',
      requestId: 'req-abort',
      signal: abort.signal,
    });
    abort.abort();

    await expect(running).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('rejects a concurrent request on the same transport as busy', async () => {
    vi.useFakeTimers();
    const transport = new SimulatorTransport('timeout', 0);
    await transport.connect();
    const first = runDeviceTest({ transport, testId: 'system.hello', requestId: 'req-first' });

    await expect(runDeviceTest({ transport, testId: 'system.chip-id', requestId: 'req-second' }))
      .rejects.toEqual(expect.objectContaining<Partial<DeviceRunError>>({ code: 'BUSY' }));

    const rejection = expect(first).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(2_000);
    await rejection;
  });
});
