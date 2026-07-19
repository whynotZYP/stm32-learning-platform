import { describe, expect, it } from 'vitest';

import { SimulatorTransport, type SimulatorScenario } from './SimulatorTransport';

const request = JSON.stringify({
  v: 1,
  id: 'req-sim',
  type: 'run',
  test: 'system.hello',
  params: {},
});

async function firstChunk(scenario: SimulatorScenario) {
  const transport = new SimulatorTransport(scenario, 0);
  await transport.connect();
  await transport.writeLine(`${request}\n`);
  return transport.readChunks()[Symbol.asyncIterator]().next();
}

describe('SimulatorTransport', () => {
  it('echoes request identity and marks pass results as simulated', async () => {
    const chunk = await firstChunk('pass');
    expect(JSON.parse(chunk.value as string)).toEqual({
      v: 1,
      id: 'req-sim',
      type: 'result',
      test: 'system.hello',
      status: 'pass',
      details: { simulated: true },
    });
  });

  it('emits a deterministic simulated failure', async () => {
    const chunk = await firstChunk('fail');
    expect(JSON.parse(chunk.value as string)).toMatchObject({
      id: 'req-sim',
      test: 'system.hello',
      status: 'fail',
      details: { simulated: true },
    });
  });

  it('waits without output in timeout mode until the reader is aborted', async () => {
    const transport = new SimulatorTransport('timeout', 0);
    const abort = new AbortController();
    await transport.connect();
    await transport.writeLine(`${request}\n`);
    const next = transport.readChunks(abort.signal)[Symbol.asyncIterator]().next();
    abort.abort();

    await expect(next).resolves.toEqual({ done: true, value: undefined });
  });

  it('rejects the reader when the simulated port disconnects', async () => {
    const transport = new SimulatorTransport('disconnect', 0);
    await transport.connect();
    await transport.writeLine(`${request}\n`);

    await expect(transport.readChunks()[Symbol.asyncIterator]().next()).rejects.toThrow('模拟串口已断开');
  });

  it('can emit malformed JSON and a wrong protocol version', async () => {
    expect((await firstChunk('malformed')).value).toBe('{not-json}\n');
    expect(JSON.parse((await firstChunk('wrong-version')).value as string)).toMatchObject({
      v: 2,
      id: 'req-sim',
      test: 'system.hello',
    });
  });

  it('changes scenarios without reconnecting', async () => {
    const transport = new SimulatorTransport('fail', 0);
    await transport.connect();
    transport.setScenario('pass');
    await transport.writeLine(`${request}\n`);
    const chunk = await transport.readChunks()[Symbol.asyncIterator]().next();

    expect(JSON.parse(chunk.value as string).status).toBe('pass');
  });
});
