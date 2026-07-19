import { DeviceRunRequestSchema } from '../protocol/messages';
import type { DeviceTransport } from './DeviceTransport';

export type SimulatorScenario =
  | 'pass'
  | 'fail'
  | 'timeout'
  | 'disconnect'
  | 'malformed'
  | 'wrong-version';

export class SimulatorTransport implements DeviceTransport {
  readonly kind = 'simulator' as const;

  private connected = false;
  private output: string[] = [];
  private readError?: Error;
  private readonly wakeReaders = new Set<() => void>();

  constructor(
    private scenario: SimulatorScenario,
    private readonly latencyMs = 1,
  ) {}

  setScenario(scenario: SimulatorScenario): void {
    this.scenario = scenario;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.output = [];
    this.readError = undefined;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.readError = undefined;
    this.wakeAllReaders();
  }

  async writeLine(line: string): Promise<void> {
    if (!this.connected) throw new Error('模拟串口尚未连接');
    const request = DeviceRunRequestSchema.parse(JSON.parse(line.replace(/\r?\n$/, '')));
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    if (this.scenario === 'timeout') return;
    if (this.scenario === 'disconnect') {
      this.connected = false;
      this.readError = new Error('模拟串口已断开');
      this.wakeAllReaders();
      return;
    }
    if (this.scenario === 'malformed') {
      this.enqueue('{not-json}\n');
      return;
    }

    const message = {
      v: this.scenario === 'wrong-version' ? 2 : 1,
      id: request.id,
      type: 'result',
      test: request.test,
      status: this.scenario === 'fail' ? 'fail' : 'pass',
      details: { simulated: true },
    };
    this.enqueue(`${JSON.stringify(message)}\n`);
  }

  async *readChunks(signal?: AbortSignal): AsyncIterable<string> {
    while (true) {
      if (signal?.aborted) return;
      if (this.readError) throw this.readError;
      const chunk = this.output.shift();
      if (chunk !== undefined) {
        yield chunk;
        continue;
      }
      if (!this.connected) return;
      await this.waitForOutput(signal);
    }
  }

  private enqueue(chunk: string): void {
    this.output.push(chunk);
    this.wakeAllReaders();
  }

  private waitForOutput(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        this.wakeReaders.delete(finish);
        signal?.removeEventListener('abort', finish);
        resolve();
      };
      this.wakeReaders.add(finish);
      signal?.addEventListener('abort', finish, { once: true });
      if (signal?.aborted) finish();
    });
  }

  private wakeAllReaders(): void {
    for (const wake of [...this.wakeReaders]) wake();
  }
}
