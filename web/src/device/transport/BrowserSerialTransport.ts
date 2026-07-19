import type { DeviceTransport } from './DeviceTransport';

export type SerialConnectionErrorCode =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'OPEN_FAILED'
  | 'DISCONNECTED'
  | 'WRITE_FAILED';

export class SerialConnectionError extends Error {
  readonly name = 'SerialConnectionError';

  constructor(
    readonly code: SerialConnectionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export class BrowserSerialTransport implements DeviceTransport {
  readonly kind = 'serial' as const;

  private port?: SerialPort;
  private connected = false;
  private physicalDisconnect = false;
  private activeReader?: ReadableStreamDefaultReader<Uint8Array>;
  private activeWriter?: WritableStreamDefaultWriter<Uint8Array>;

  constructor(private readonly serial: Serial | undefined) {}

  async connect(): Promise<void> {
    if (!this.serial) {
      throw new SerialConnectionError('UNSUPPORTED', '当前浏览器不支持 Web Serial，请使用最新版 Chrome 或 Edge');
    }

    let port: SerialPort;
    try {
      port = await this.serial.requestPort();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new SerialConnectionError('PERMISSION_DENIED', '未获得串口权限，请重新点击连接并选择 CH340');
      }
      throw new SerialConnectionError('OPEN_FAILED', '无法选择串口设备');
    }

    try {
      await port.open({ baudRate: 115_200, bufferSize: 1_024 });
    } catch {
      try {
        await port.close();
      } catch {
        // An unopened port may reject close; the public error remains OPEN_FAILED.
      }
      throw new SerialConnectionError('OPEN_FAILED', '串口打开失败，请关闭占用串口的软件后重试');
    }

    this.port = port;
    this.connected = true;
    this.physicalDisconnect = false;
    this.serial.addEventListener('disconnect', this.handleDisconnect);
  }

  async disconnect(): Promise<void> {
    const port = this.port;
    this.connected = false;
    this.physicalDisconnect = false;
    this.serial?.removeEventListener('disconnect', this.handleDisconnect);

    const reader = this.activeReader;
    this.activeReader = undefined;
    if (reader) {
      try { await reader.cancel(); } catch { /* already disconnected */ }
      try { reader.releaseLock(); } catch { /* already released */ }
    }
    const writer = this.activeWriter;
    this.activeWriter = undefined;
    if (writer) {
      try { await writer.abort(); } catch { /* already disconnected */ }
      try { writer.releaseLock(); } catch { /* already released */ }
    }

    this.port = undefined;
    if (port) {
      try {
        await port.close();
      } catch {
        throw new SerialConnectionError('DISCONNECTED', '串口已经断开，无法正常关闭');
      }
    }
  }

  async writeLine(line: string): Promise<void> {
    const writable = this.port?.writable;
    if (!this.connected || !writable) {
      throw new SerialConnectionError('DISCONNECTED', '串口尚未连接');
    }

    const writer = writable.getWriter();
    this.activeWriter = writer;
    try {
      await writer.write(new TextEncoder().encode(line));
    } catch {
      throw new SerialConnectionError('WRITE_FAILED', '串口写入失败，请检查连接后重试');
    } finally {
      if (this.activeWriter === writer) {
        this.activeWriter = undefined;
        writer.releaseLock();
      }
    }
  }

  async *readChunks(signal?: AbortSignal): AsyncIterable<string> {
    const readable = this.port?.readable;
    if (!this.connected || !readable) {
      throw new SerialConnectionError('DISCONNECTED', '串口尚未连接');
    }

    const reader = readable.getReader();
    const decoder = new TextDecoder();
    const cancel = () => { void reader.cancel(); };
    this.activeReader = reader;
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      while (true) {
        let next: ReadableStreamReadResult<Uint8Array>;
        try {
          next = await reader.read();
        } catch {
          if (signal?.aborted) return;
          throw new SerialConnectionError('DISCONNECTED', '串口读取失败，请重新连接');
        }
        if (next.done) {
          if (this.physicalDisconnect) {
            throw new SerialConnectionError('DISCONNECTED', '开发板串口已断开');
          }
          const tail = decoder.decode();
          if (tail) yield tail;
          return;
        }
        const chunk = decoder.decode(next.value, { stream: true });
        if (chunk) yield chunk;
      }
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (this.activeReader === reader) {
        this.activeReader = undefined;
        reader.releaseLock();
      }
    }
  }

  private readonly handleDisconnect = (event: Event) => {
    if ((event as SerialConnectionEvent).port !== this.port) return;
    this.connected = false;
    this.physicalDisconnect = true;
    void this.activeReader?.cancel();
  };
}
