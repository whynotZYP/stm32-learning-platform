import { describe, expect, it, vi } from 'vitest';

import {
  BrowserSerialTransport,
  SerialConnectionError,
} from './BrowserSerialTransport';

class FakePort implements SerialPort {
  readonly written: Uint8Array[] = [];
  readonly open = vi.fn(async (_options: { baudRate: number; bufferSize?: number }) => {});
  readonly close = vi.fn(async () => {});
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;

  constructor(input: { chunks?: string[]; writeError?: Error; readError?: Error } = {}) {
    this.readable = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of input.chunks ?? []) controller.enqueue(new TextEncoder().encode(chunk));
        if (input.readError) controller.error(input.readError);
        else controller.close();
      },
    });
    const written = this.written;
    this.writable = new WritableStream<Uint8Array>({
      write(chunk) {
        if (input.writeError) throw input.writeError;
        written.push(chunk);
      },
    });
  }
}

class FakeSerial extends EventTarget implements Serial {
  readonly requestPort = vi.fn<() => Promise<SerialPort>>();

  constructor(portOrError: SerialPort | Error) {
    super();
    this.requestPort.mockImplementation(async () => {
      if (portOrError instanceof Error || portOrError instanceof DOMException) throw portOrError;
      return portOrError;
    });
  }

  disconnect(port: SerialPort) {
    const event = new Event('disconnect') as SerialConnectionEvent;
    Object.defineProperty(event, 'port', { value: port });
    this.dispatchEvent(event);
  }
}

describe('BrowserSerialTransport', () => {
  it('reports an unsupported browser before requesting a port', async () => {
    const transport = new BrowserSerialTransport(undefined);

    await expect(transport.connect()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('maps user permission rejection without trying to open a port', async () => {
    const denied = new DOMException('denied', 'NotAllowedError');
    const transport = new BrowserSerialTransport(new FakeSerial(denied));

    await expect(transport.connect()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('requests a port only on connect and opens at 115200 with a bounded buffer', async () => {
    const port = new FakePort();
    const serial = new FakeSerial(port);
    const transport = new BrowserSerialTransport(serial);
    expect(serial.requestPort).not.toHaveBeenCalled();

    await transport.connect();

    expect(serial.requestPort).toHaveBeenCalledOnce();
    expect(port.open).toHaveBeenCalledWith({ baudRate: 115_200, bufferSize: 1_024 });
  });

  it('reports a port-open failure with a stable error code', async () => {
    const port = new FakePort();
    port.open.mockRejectedValueOnce(new Error('open failed'));
    const transport = new BrowserSerialTransport(new FakeSerial(port));

    await expect(transport.connect()).rejects.toMatchObject({ code: 'OPEN_FAILED' });
  });

  it('writes UTF-8 with the caller newline and releases the writer lock', async () => {
    const port = new FakePort();
    const transport = new BrowserSerialTransport(new FakeSerial(port));
    await transport.connect();

    await transport.writeLine('你好\n');

    expect(new TextDecoder().decode(port.written[0])).toBe('你好\n');
    expect(port.writable?.locked).toBe(false);
  });

  it('streams fragmented UTF-8 chunks and releases the reader lock', async () => {
    const port = new FakePort({ chunks: ['{"v":', '1}\n'] });
    const transport = new BrowserSerialTransport(new FakeSerial(port));
    await transport.connect();
    const chunks: string[] = [];

    for await (const chunk of transport.readChunks()) chunks.push(chunk);

    expect(chunks).toEqual(['{"v":', '1}\n']);
    expect(port.readable?.locked).toBe(false);
  });

  it('turns a physical disconnect event into a typed read failure', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const port = new FakePort();
    port.readable = new ReadableStream({ start(current) { controller = current; } });
    const serial = new FakeSerial(port);
    const transport = new BrowserSerialTransport(serial);
    await transport.connect();
    const next = transport.readChunks()[Symbol.asyncIterator]().next();

    serial.disconnect(port);

    await expect(next).rejects.toMatchObject({ code: 'DISCONNECTED' });
  });

  it('explicitly closes the port', async () => {
    const port = new FakePort();
    const transport = new BrowserSerialTransport(new FakeSerial(port));
    await transport.connect();

    await transport.disconnect();

    expect(port.close).toHaveBeenCalledOnce();
  });

  it('releases stream locks after write and read errors', async () => {
    const writePort = new FakePort({ writeError: new Error('write failed') });
    const writer = new BrowserSerialTransport(new FakeSerial(writePort));
    await writer.connect();
    await expect(writer.writeLine('request\n')).rejects.toEqual(
      expect.objectContaining<Partial<SerialConnectionError>>({ code: 'WRITE_FAILED' }),
    );
    expect(writePort.writable?.locked).toBe(false);

    const readPort = new FakePort({ readError: new Error('read failed') });
    const reader = new BrowserSerialTransport(new FakeSerial(readPort));
    await reader.connect();
    await expect(reader.readChunks()[Symbol.asyncIterator]().next()).rejects.toMatchObject({ code: 'DISCONNECTED' });
    expect(readPort.readable?.locked).toBe(false);
  });
});
