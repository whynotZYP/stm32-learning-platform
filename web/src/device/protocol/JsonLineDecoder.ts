import { DeviceMessageSchema, type DeviceMessage } from './messages';

export type DecodeEvent =
  | { kind: 'message'; message: DeviceMessage }
  | { kind: 'error'; code: 'LINE_TOO_LONG' | 'INVALID_JSON' | 'INVALID_MESSAGE'; line?: string };

export class JsonLineDecoder {
  private buffer = '';
  private discardingOversizedLine = false;

  constructor(private readonly maxLineBytes = 512) {}

  push(chunk: string): DecodeEvent[] {
    const events: DecodeEvent[] = [];
    this.buffer += chunk;

    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;

      const raw = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (this.discardingOversizedLine) {
        this.discardingOversizedLine = false;
        continue;
      }

      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (!line) continue;
      if (this.byteLength(line) > this.maxLineBytes) {
        events.push({ kind: 'error', code: 'LINE_TOO_LONG' });
        continue;
      }
      events.push(this.decodeLine(line));
    }

    if (!this.discardingOversizedLine && this.byteLength(this.buffer) > this.maxLineBytes) {
      this.buffer = '';
      this.discardingOversizedLine = true;
      events.push({ kind: 'error', code: 'LINE_TOO_LONG' });
    }

    return events;
  }

  private decodeLine(line: string): DecodeEvent {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return { kind: 'error', code: 'INVALID_JSON', line };
    }

    const parsed = DeviceMessageSchema.safeParse(value);
    return parsed.success
      ? { kind: 'message', message: parsed.data }
      : { kind: 'error', code: 'INVALID_MESSAGE', line };
  }

  private byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }
}
