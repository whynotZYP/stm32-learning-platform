export interface DeviceTransport {
  readonly kind: 'serial' | 'simulator';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeLine(line: string): Promise<void>;
  readChunks(signal?: AbortSignal): AsyncIterable<string>;
}
