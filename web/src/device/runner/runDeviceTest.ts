import { getDeviceTest, type DeviceTestDefinition } from '../catalog/testCatalog';
import { JsonLineDecoder } from '../protocol/JsonLineDecoder';
import {
  DeviceRunRequestSchema,
  type DeviceError,
  type DeviceResult,
} from '../protocol/messages';
import type { DeviceTransport } from '../transport/DeviceTransport';

export type DeviceRunErrorCode =
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'INVALID_MESSAGE'
  | 'DEVICE_ERROR'
  | 'ABORTED'
  | 'BUSY';

export class DeviceRunError extends Error {
  readonly name = 'DeviceRunError';

  constructor(
    readonly code: DeviceRunErrorCode,
    message: string,
    readonly deviceCode?: DeviceError['code'],
  ) {
    super(message);
  }
}

export interface DeviceRunOutcome {
  definition: DeviceTestDefinition;
  transportKind: DeviceTransport['kind'];
  result: DeviceResult;
  receivedAt: string;
}

const activeTransports = new WeakSet<DeviceTransport>();

export async function runDeviceTest(input: {
  transport: DeviceTransport;
  testId: string;
  params?: Record<string, string | number | boolean>;
  requestId: string;
  now?: () => string;
  signal?: AbortSignal;
}): Promise<DeviceRunOutcome> {
  const { transport } = input;
  if (input.signal?.aborted) throw new DeviceRunError('ABORTED', '检测已取消');
  if (activeTransports.has(transport)) throw new DeviceRunError('BUSY', '已有一个开发板检测正在运行');

  const definition = getDeviceTest(input.testId);
  const request = DeviceRunRequestSchema.parse({
    v: 1,
    id: input.requestId,
    type: 'run',
    test: definition.id,
    params: input.params ?? {},
  });
  const controller = new AbortController();
  let abortReason: 'timeout' | 'external' | undefined;
  let iterator: AsyncIterator<string> | undefined;
  const abortExternally = () => {
    if (!abortReason) abortReason = 'external';
    controller.abort();
  };
  input.signal?.addEventListener('abort', abortExternally, { once: true });
  const timeout = setTimeout(() => {
    if (!abortReason) abortReason = 'timeout';
    controller.abort();
  }, definition.timeoutMs);

  activeTransports.add(transport);
  try {
    try {
      await transport.writeLine(`${JSON.stringify(request)}\n`);
    } catch (error) {
      if (controller.signal.aborted) throw abortError(abortReason);
      throw new DeviceRunError('DISCONNECTED', error instanceof Error ? error.message : '无法向开发板发送请求');
    }
    if (controller.signal.aborted) throw abortError(abortReason);

    const decoder = new JsonLineDecoder();
    iterator = transport.readChunks(controller.signal)[Symbol.asyncIterator]();
    for (;;) {
      let next: IteratorResult<string>;
      try {
        next = await iterator.next();
      } catch (error) {
        if (controller.signal.aborted) throw abortError(abortReason);
        throw new DeviceRunError('DISCONNECTED', error instanceof Error ? error.message : '开发板连接已断开');
      }

      if (next.done) {
        if (controller.signal.aborted) throw abortError(abortReason);
        throw new DeviceRunError('DISCONNECTED', '开发板连接已断开，未收到检测结果');
      }

      for (const event of decoder.push(next.value)) {
        if (event.kind === 'error') {
          throw new DeviceRunError('INVALID_MESSAGE', `收到无效开发板消息：${event.code}`);
        }
        const message = event.message;
        if (message.id !== request.id) continue;
        if ('test' in message && message.test !== undefined && message.test !== request.test) {
          throw new DeviceRunError('INVALID_MESSAGE', '响应 ID 正确但检测项目不匹配');
        }
        if (message.type === 'progress') continue;
        if (message.type === 'error') {
          throw new DeviceRunError('DEVICE_ERROR', message.message, message.code);
        }
        return {
          definition,
          transportKind: transport.kind,
          result: message,
          receivedAt: input.now?.() ?? new Date().toISOString(),
        };
      }
    }
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abortExternally);
    controller.abort();
    try {
      await iterator?.return?.();
    } catch {
      // The test outcome is more useful than a secondary reader-close failure.
    }
    activeTransports.delete(transport);
  }
}

function abortError(reason: 'timeout' | 'external' | undefined): DeviceRunError {
  return reason === 'timeout'
    ? new DeviceRunError('TIMEOUT', '开发板检测超时，请检查接线和固件后重试')
    : new DeviceRunError('ABORTED', '检测已取消');
}
