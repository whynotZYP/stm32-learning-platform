import { describe, expect, it } from 'vitest';

import {
  DeviceMessageSchema,
  DeviceRunRequestSchema,
} from './messages';

describe('device protocol v1 schemas', () => {
  it('accepts the documented run request and result', () => {
    const request = {
      v: 1,
      id: 'req-42',
      type: 'run',
      test: 'spi.flash-id',
      params: {},
    };
    const result = {
      v: 1,
      id: 'req-42',
      type: 'result',
      test: 'spi.flash-id',
      status: 'pass',
      details: { jedecId: 'EF4017' },
    };

    expect(DeviceRunRequestSchema.parse(request)).toEqual(request);
    expect(DeviceMessageSchema.parse(result)).toEqual(result);
  });

  it('rejects unsupported versions, missing IDs and unsafe identifiers', () => {
    const base = { v: 1, id: 'req-42', type: 'run', test: 'system.hello', params: {} };

    expect(DeviceRunRequestSchema.safeParse({ ...base, v: 2 }).success).toBe(false);
    expect(DeviceRunRequestSchema.safeParse({ ...base, id: undefined }).success).toBe(false);
    expect(DeviceRunRequestSchema.safeParse({ ...base, id: '../escape' }).success).toBe(false);
    expect(DeviceRunRequestSchema.safeParse({ ...base, test: 'System Hello' }).success).toBe(false);
  });

  it('bounds identifiers, scalar details and progress values', () => {
    const result = {
      v: 1,
      id: 'a'.repeat(65),
      type: 'result',
      test: 'system.hello',
      status: 'pass',
      details: {},
    };
    const progress = {
      v: 1,
      id: 'req-1',
      type: 'progress',
      test: 'system.hello',
      step: '握手',
      percent: 101,
    };

    expect(DeviceMessageSchema.safeParse(result).success).toBe(false);
    expect(DeviceMessageSchema.safeParse(progress).success).toBe(false);
    expect(DeviceMessageSchema.safeParse({
      ...result,
      id: 'req-1',
      details: { note: 'x'.repeat(161) },
    }).success).toBe(false);
  });
});
