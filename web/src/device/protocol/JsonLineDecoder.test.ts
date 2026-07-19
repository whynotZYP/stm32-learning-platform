import { describe, expect, it } from 'vitest';

import { JsonLineDecoder } from './JsonLineDecoder';

const result = (id = 'req-42') => ({
  v: 1 as const,
  id,
  type: 'result' as const,
  test: 'spi.flash-id',
  status: 'pass' as const,
  details: { jedecId: 'EF4017' },
});

describe('JsonLineDecoder', () => {
  it('emits two messages from one chunk and accepts CRLF', () => {
    const decoder = new JsonLineDecoder();
    const events = decoder.push(`${JSON.stringify(result('one'))}\r\n${JSON.stringify(result('two'))}\n`);

    expect(events).toEqual([
      { kind: 'message', message: result('one') },
      { kind: 'message', message: result('two') },
    ]);
  });

  it('emits one message only after a fragmented line is complete', () => {
    const decoder = new JsonLineDecoder();
    const line = JSON.stringify(result());

    expect(decoder.push(line.slice(0, 9))).toEqual([]);
    expect(decoder.push(line.slice(9, 33))).toEqual([]);
    expect(decoder.push(`${line.slice(33)}\n`)).toEqual([
      { kind: 'message', message: result() },
    ]);
  });

  it('rejects a 513-byte unterminated line and discards its tail through newline', () => {
    const decoder = new JsonLineDecoder();

    expect(decoder.push('x'.repeat(513))).toEqual([{ kind: 'error', code: 'LINE_TOO_LONG' }]);
    expect(decoder.push('still-the-same-line')).toEqual([]);
    expect(decoder.push('\n')).toEqual([]);
  });

  it('recovers after an oversized line and decodes the following valid line', () => {
    const decoder = new JsonLineDecoder();

    expect(decoder.push(`${'x'.repeat(513)}\n${JSON.stringify(result())}\n`)).toEqual([
      { kind: 'error', code: 'LINE_TOO_LONG' },
      { kind: 'message', message: result() },
    ]);
  });

  it('reports invalid JSON without preventing the following valid line', () => {
    const decoder = new JsonLineDecoder();
    const events = decoder.push(`{not-json}\n${JSON.stringify(result())}\n`);

    expect(events[0]).toEqual({ kind: 'error', code: 'INVALID_JSON', line: '{not-json}' });
    expect(events[1]).toEqual({ kind: 'message', message: result() });
  });

  it('distinguishes valid JSON with an invalid message shape', () => {
    const decoder = new JsonLineDecoder();

    expect(decoder.push('{"v":1,"type":"result"}\n')).toEqual([
      { kind: 'error', code: 'INVALID_MESSAGE', line: '{"v":1,"type":"result"}' },
    ]);
  });

  it('measures the limit in UTF-8 bytes and keeps an exact 512-byte line', () => {
    const decoder = new JsonLineDecoder(512);
    const base = { ...result(), details: { a: 'a'.repeat(160), b: 'b'.repeat(160), c: '' } };
    const baseLine = JSON.stringify(base);
    const fillerLength = 512 - new TextEncoder().encode(baseLine).length;
    const line = JSON.stringify({ ...base, details: { ...base.details, c: 'c'.repeat(fillerLength) } });

    expect(fillerLength).toBeGreaterThan(0);
    expect(fillerLength).toBeLessThanOrEqual(160);
    expect(new TextEncoder().encode(line)).toHaveLength(512);
    expect(decoder.push(`${line}\n`)[0]?.kind).toBe('message');

    const utf8Decoder = new JsonLineDecoder(3);
    expect(utf8Decoder.push('中')).toEqual([]);
    expect(utf8Decoder.push('文')).toEqual([{ kind: 'error', code: 'LINE_TOO_LONG' }]);
  });
});
