import { z } from 'zod';

const Id = z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/);
const TestId = z.string().min(1).max(64).regex(/^[a-z0-9.-]+$/);
const Scalar = z.union([
  z.string().max(160),
  z.number().finite(),
  z.boolean(),
]);
const Details = z.record(z.string().min(1).max(64), Scalar);

export const DeviceRunRequestSchema = z.object({
  v: z.literal(1),
  id: Id,
  type: z.literal('run'),
  test: TestId,
  params: Details,
}).strict();

export const DeviceProgressSchema = z.object({
  v: z.literal(1),
  id: Id,
  type: z.literal('progress'),
  test: TestId,
  step: z.string().min(1).max(120),
  percent: z.number().int().min(0).max(100),
}).strict();

export const DeviceResultSchema = z.object({
  v: z.literal(1),
  id: Id,
  type: z.literal('result'),
  test: TestId,
  status: z.enum(['pass', 'fail']),
  details: Details,
}).strict();

export const DeviceErrorSchema = z.object({
  v: z.literal(1),
  id: Id,
  type: z.literal('error'),
  test: TestId.optional(),
  code: z.enum([
    'INVALID_REQUEST',
    'UNSUPPORTED_VERSION',
    'UNKNOWN_TEST',
    'BUSY',
    'PRECONDITION',
    'TIMEOUT',
    'HARDWARE',
  ]),
  message: z.string().min(1).max(160),
}).strict();

export const DeviceMessageSchema = z.discriminatedUnion('type', [
  DeviceProgressSchema,
  DeviceResultSchema,
  DeviceErrorSchema,
]);

export type DeviceRunRequest = z.infer<typeof DeviceRunRequestSchema>;
export type DeviceMessage = z.infer<typeof DeviceMessageSchema>;
export type DeviceProgress = z.infer<typeof DeviceProgressSchema>;
export type DeviceResult = z.infer<typeof DeviceResultSchema>;
export type DeviceError = z.infer<typeof DeviceErrorSchema>;
