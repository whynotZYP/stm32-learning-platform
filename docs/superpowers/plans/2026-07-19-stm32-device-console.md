# STM32 Device Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learning site connect to STM32 through CH340, run bounded objective checks, record honest evidence, and fall back cleanly when Web Serial or hardware is unavailable.

**Architecture:** A transport-independent JSON Lines protocol separates device semantics from browser permissions. The same runner uses either `BrowserSerialTransport` or `SimulatorTransport`; the catalog consumes the foundation plan's shared `DetectionCheck` contract for each test rather than defining a second detection model, and only the evidence mapper may convert device results into learning records.

**Tech Stack:** TypeScript, Zod, Web Serial, Vitest, Testing Library, Playwright, STM32F1 HAL, small bounded C parser, CMake/Ninja.

## Global Constraints

- Browser support target is current Chrome/Edge in a secure context; every port request starts from a visible user click.
- Default link is USART1: PA9 TX → CH340 RX, PA10 RX ← CH340 TX, plus GND; the UI requires confirmation of 3.3 V TTL and one selected power source.
- Protocol is UTF-8 JSON Lines, version `1`, maximum input line 512 bytes, one request ID per result.
- Unknown protocol versions/tests, malformed input, busy state, timeout, and disconnected transport produce explicit structured errors.
- Automatic device evidence may prove values/data flow only; LED brightness, sound, motor/servo motion, real current, and true power-loss behavior require manual evidence. Catalog detection checks use the shared `mode`, action, expected evidence, limitation, applicability, and non-applicable-reason fields.
- W25Q64 and internal FLASH tests operate only on documented reserved regions and restore previous data when applicable.
- Simulator results always carry `simulated: true` and map to `pending`, never `auto-pass`.
- Every task is test-first and ends with a focused commit.

---

## File Map

- `web/src/device/protocol/messages.ts`: Zod request/result/error/progress schemas and types.
- `web/src/device/protocol/JsonLineDecoder.ts`: chunk-to-message decoder with line limit.
- `web/src/device/transport/DeviceTransport.ts`: transport interface.
- `web/src/device/transport/SimulatorTransport.ts`: deterministic scenario transport.
- `web/src/device/transport/BrowserSerialTransport.ts`: Web Serial adapter only.
- `web/src/device/catalog/testCatalog.ts`: test definitions and proof boundaries.
- `web/src/device/runner/runDeviceTest.ts`: request matching, timeout, cancel, result.
- `web/src/device/evidence/deviceResultToEvidence.ts`: honest result-to-evidence conversion.
- `web/src/pages/DeviceConsolePage.tsx`: connection/safety/test/log UI.
- `web/src/device/web-serial.d.ts`: minimal browser serial types when TypeScript DOM lacks them.
- `firmware/device-test/stm32f103/`: CubeMX detection firmware.
- `firmware/device-test/stm32f103/App/protocol.*`: bounded JSON-line request parser/response writer.
- `firmware/device-test/stm32f103/App/test_registry.*`: command registry and safety gates.
- `firmware/device-test/stm32f103/App/tests/*`: focused peripheral checks.
- `docs/device/protocol-v1.md`: wire contract and error codes.

### Task 1: Define and parse protocol version 1

**Files:**
- Create: `web/src/device/protocol/messages.test.ts`
- Create: `web/src/device/protocol/messages.ts`
- Create: `web/src/device/protocol/JsonLineDecoder.test.ts`
- Create: `web/src/device/protocol/JsonLineDecoder.ts`
- Create: `docs/device/protocol-v1.md`

**Interfaces:**
- Consumes: arbitrary UTF-8 text chunks.
- Produces: `DeviceRunRequest`, `DeviceMessage`, and `JsonLineDecoder.push(chunk): DecodeEvent[]`.

- [ ] **Step 1: Write failing schema and fragmentation tests**

Create tests that prove:

```ts
const validRequest = { v: 1, id: 'req-42', type: 'run', test: 'spi.flash-id', params: {} };
const validResult = { v: 1, id: 'req-42', type: 'result', test: 'spi.flash-id', status: 'pass', details: { jedecId: 'EF4017' } };
```

- Version 2 and missing IDs are rejected.
- Two messages in one chunk emit two messages.
- One message split across three chunks emits once after newline.
- A 513-byte unterminated line emits `LINE_TOO_LONG` and resets the buffer.
- Invalid JSON emits `INVALID_JSON` without preventing the following valid line.

- [ ] **Step 2: Run tests and verify protocol modules are missing**

Run: `npm test -- --run web/src/device/protocol`

Expected: FAIL because message schemas and decoder do not exist.

- [ ] **Step 3: Implement exact message schemas**

Create `web/src/device/protocol/messages.ts`:

```ts
import { z } from 'zod';

const Id = z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/);
const TestId = z.string().min(1).max(64).regex(/^[a-z0-9.-]+$/);
const Scalar = z.union([z.string().max(160), z.number().finite(), z.boolean()]);
const Details = z.record(z.string().max(64), Scalar);

export const DeviceRunRequestSchema = z.object({
  v: z.literal(1), id: Id, type: z.literal('run'), test: TestId, params: Details,
});
export const DeviceProgressSchema = z.object({
  v: z.literal(1), id: Id, type: z.literal('progress'), test: TestId, step: z.string().min(1).max(120), percent: z.number().int().min(0).max(100),
});
export const DeviceResultSchema = z.object({
  v: z.literal(1), id: Id, type: z.literal('result'), test: TestId, status: z.enum(['pass', 'fail']), details: Details,
});
export const DeviceErrorSchema = z.object({
  v: z.literal(1), id: Id, type: z.literal('error'), test: TestId.optional(), code: z.enum(['INVALID_REQUEST', 'UNSUPPORTED_VERSION', 'UNKNOWN_TEST', 'BUSY', 'PRECONDITION', 'TIMEOUT', 'HARDWARE']), message: z.string().min(1).max(160),
});

export const DeviceMessageSchema = z.discriminatedUnion('type', [DeviceProgressSchema, DeviceResultSchema, DeviceErrorSchema]);
export type DeviceRunRequest = z.infer<typeof DeviceRunRequestSchema>;
export type DeviceMessage = z.infer<typeof DeviceMessageSchema>;
export type DeviceResult = z.infer<typeof DeviceResultSchema>;
```

- [ ] **Step 4: Implement the bounded line decoder**

Create `web/src/device/protocol/JsonLineDecoder.ts`:

```ts
import { DeviceMessageSchema, type DeviceMessage } from './messages';

export type DecodeEvent = { kind: 'message'; message: DeviceMessage } | { kind: 'error'; code: 'LINE_TOO_LONG' | 'INVALID_JSON' | 'INVALID_MESSAGE'; line?: string };

export class JsonLineDecoder {
  private buffer = '';
  constructor(private readonly maxLineBytes = 512) {}

  push(chunk: string): DecodeEvent[] {
    this.buffer += chunk;
    if (new TextEncoder().encode(this.buffer).length > this.maxLineBytes && !this.buffer.includes('\n')) {
      this.buffer = '';
      return [{ kind: 'error', code: 'LINE_TOO_LONG' }];
    }
    const events: DecodeEvent[] = [];
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (!line) continue;
      if (new TextEncoder().encode(line).length > this.maxLineBytes) { events.push({ kind: 'error', code: 'LINE_TOO_LONG' }); continue; }
      let value: unknown;
      try { value = JSON.parse(line); } catch { events.push({ kind: 'error', code: 'INVALID_JSON', line }); continue; }
      const parsed = DeviceMessageSchema.safeParse(value);
      events.push(parsed.success ? { kind: 'message', message: parsed.data } : { kind: 'error', code: 'INVALID_MESSAGE', line });
    }
    return events;
  }
}
```

- [ ] **Step 5: Document and verify protocol 1**

`docs/device/protocol-v1.md` must include wire settings `115200 8N1`, maximum line, request/progress/result/error examples, all error codes, one-request-at-a-time rule, test catalog IDs, simulator flag policy, and reserved-memory warnings.

Run: `npm test -- --run web/src/device/protocol`

Expected: all schema and decoder tests pass.

- [ ] **Step 6: Commit protocol v1**

```powershell
git add web/src/device/protocol docs/device/protocol-v1.md
git commit -m "feat: define bounded device protocol v1"
```

### Task 2: Build the catalog and deterministic simulator

**Files:**
- Create: `web/src/device/transport/DeviceTransport.ts`
- Create: `web/src/device/catalog/testCatalog.test.ts`
- Create: `web/src/device/catalog/testCatalog.ts`
- Create: `web/src/device/transport/SimulatorTransport.test.ts`
- Create: `web/src/device/transport/SimulatorTransport.ts`

**Interfaces:**
- Produces: `DeviceTransport`, `DEVICE_TESTS`, and scenario-controlled simulator.

- [ ] **Step 1: Define the shared transport contract**

Create `web/src/device/transport/DeviceTransport.ts`:

```ts
export interface DeviceTransport {
  readonly kind: 'serial' | 'simulator';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeLine(line: string): Promise<void>;
  readChunks(signal?: AbortSignal): AsyncIterable<string>;
}
```

- [ ] **Step 2: Write failing catalog safety tests**

Assert the catalog contains exactly these IDs and no duplicate:

```text
system.hello, system.chip-id, gpio.loopback, exti.event-count,
tim.pwm-capture, adc.range-dma, dma.memory-copy, usart.packet,
i2c.mpu6050-id, spi.flash-id, spi.flash-roundtrip, rtc.bkp,
wdg.reset-cause, flash.reserved-page, pwr.sleep-wake
```

Assert every entry declares `detectionCheck`, `timeoutMs`, `firmwareVersion`, `wiring`, `safety`, and `lessonTagIds`; `detectionCheck` is the shared foundation `DetectionCheck` shape, including its `simulator`/`device`/`manual` `evidenceSource` enum and `physicalHardware` boolean. A simulator check must have `physicalHardware: false`; each core-hardware device test consumes the curriculum-declared matching mode rather than defining a second model. Both flash-write tests mention their reserved region and restore behavior.

- [ ] **Step 3: Implement the catalog as immutable data**

Create `testCatalog.ts` with:

```ts
import type { DetectionCheck } from '../../domain/content/types';
export interface DeviceTestDefinition {
  id: string;
  title: string;
  detectionCheck: DetectionCheck;
  timeoutMs: number;
  firmwareVersion: 'device-test-v1';
  wiring: string[];
  safety: string[];
  lessonTagIds: string[];
}
export const DEVICE_TESTS: readonly DeviceTestDefinition[];
export function getDeviceTest(id: string): DeviceTestDefinition;
```

Use `detectionCheck.mode: 'automatic'`, `evidenceSource: 'device'`, and `physicalHardware: true` for hello/chip ID/GPIO loopback/PWM capture/DMA/USART/I2C ID/SPI ID and roundtrip/FLASH reserved page. Use `semi-automatic` with the same device/physical fields for EXTI, ADC movement, RTC/BKP, WDG, and PWR. No catalog entry claims automatic LED, sound, servo, or motor proof; each check supplies the shared action, evidence, limitation, applicability, source, and physical fields.

- [ ] **Step 4: Write failing simulator scenario tests**

Test `pass`, `fail`, `timeout`, `disconnect`, `malformed`, and `wrong-version` scenarios. A pass result must include `simulated: true`; timeout emits no result until aborted; disconnect causes the async iterator to reject with `模拟串口已断开`.

- [ ] **Step 5: Implement simulator without timers longer than tests need**

Create `SimulatorTransport` with constructor:

```ts
export type SimulatorScenario = 'pass' | 'fail' | 'timeout' | 'disconnect' | 'malformed' | 'wrong-version';
export class SimulatorTransport implements DeviceTransport {
  readonly kind = 'simulator' as const;
  constructor(private scenario: SimulatorScenario, private latencyMs = 1) {}
  setScenario(scenario: SimulatorScenario): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeLine(line: string): Promise<void>;
  readChunks(signal?: AbortSignal): AsyncIterable<string>;
}
```

Queue output per request; echo the request ID/test for pass/fail; never return a line when scenario is timeout.

- [ ] **Step 6: Verify and commit catalog/simulator**

Run: `npm test -- --run web/src/device/catalog web/src/device/transport/SimulatorTransport.test.ts`

Expected: catalog and six scenario groups pass.

```powershell
git add web/src/device/catalog web/src/device/transport
git commit -m "feat: add safe device catalog and simulator"
```

### Task 3: Run tests with timeout/cancel and map honest evidence

**Files:**
- Create: `web/src/device/runner/runDeviceTest.test.ts`
- Create: `web/src/device/runner/runDeviceTest.ts`
- Create: `web/src/device/evidence/deviceResultToEvidence.test.ts`
- Create: `web/src/device/evidence/deviceResultToEvidence.ts`

**Interfaces:**
- Consumes: `DeviceTransport`, catalog, `DeviceMessage`.
- Produces: `runDeviceTest(input): Promise<DeviceRunOutcome>` and `deviceResultToEvidence`.

- [ ] **Step 1: Write failing matching, timeout, and evidence tests**

Test that the runner ignores progress and another request ID, returns the matching result, turns an error message into a typed failure, aborts at the catalog timeout, and closes its read iterator. Test evidence rules:

| Transport/result | Evidence status | Score |
|---|---|---|
| serial automatic pass | `auto-pass` | 100 |
| serial automatic fail | `failed` | 0 |
| serial semi-automatic pass | `pending` | 0 until learner confirmation |
| any simulator result | `pending` | 0 |

- [ ] **Step 2: Run tests and verify runner/evidence modules are missing**

Run: `npm test -- --run web/src/device/runner web/src/device/evidence`

Expected: FAIL because both implementations are absent.

- [ ] **Step 3: Implement one-request matching with bounded timeout**

Create `runDeviceTest.ts` with:

```ts
export interface DeviceRunOutcome {
  definition: DeviceTestDefinition;
  transportKind: DeviceTransport['kind'];
  result: DeviceResult;
  receivedAt: string;
}

export async function runDeviceTest(input: {
  transport: DeviceTransport;
  testId: string;
  params?: Record<string, string | number | boolean>;
  requestId: string;
  now?: () => string;
  signal?: AbortSignal;
}): Promise<DeviceRunOutcome>;
```

Create an internal `AbortController`, forward external abort, set a timeout using `definition.timeoutMs`, serialize `DeviceRunRequestSchema.parse(...) + '\n'`, parse lines through `JsonLineDecoder`, and return only a matching result. Throw Chinese `DeviceRunError` codes for timeout, disconnect, invalid message, and device error.

- [ ] **Step 4: Implement the only result-to-evidence conversion**

Create `deviceResultToEvidence.ts`:

```ts
export function deviceResultToEvidence(outcome: DeviceRunOutcome, lessonId: string): EvidenceRecord {
  const simulated = outcome.transportKind === 'simulator';
  const automatic = outcome.definition.detectionCheck.mode === 'automatic'
    && outcome.definition.detectionCheck.applicable
    && outcome.definition.detectionCheck.evidenceSource === 'device'
    && outcome.definition.detectionCheck.physicalHardware;
  const passed = outcome.result.status === 'pass';
  const status = simulated || !automatic ? 'pending' : passed ? 'auto-pass' : 'failed';
  return {
    id: `device-${outcome.result.id}`,
    learnerId: 'local',
    lessonId,
    tagIds: outcome.definition.lessonTagIds,
    kind: 'practical',
    status,
    score: status === 'auto-pass' ? 100 : 0,
    source: 'device',
    createdAt: outcome.receivedAt,
    details: { testId: outcome.definition.id, simulated, ...outcome.result.details },
  };
}
```

- [ ] **Step 5: Verify and commit runner/evidence**

Run: `npm test -- --run web/src/device/runner web/src/device/evidence`

Expected: request matching/timeout tests and all four evidence cases pass.

```powershell
git add web/src/device/runner web/src/device/evidence
git commit -m "feat: run device checks with honest evidence"
```

### Task 4: Implement the browser Web Serial adapter

**Files:**
- Create: `web/src/device/web-serial.d.ts`
- Create: `web/src/device/transport/BrowserSerialTransport.test.ts`
- Create: `web/src/device/transport/BrowserSerialTransport.ts`

**Interfaces:**
- Consumes: `navigator.serial` after user click.
- Produces: `BrowserSerialTransport implements DeviceTransport`.

- [ ] **Step 1: Write failing tests with a fake serial port**

Cover unsupported browser, permission rejection, open at 115200 baud, UTF-8 newline write, fragmented readable chunks, disconnect event, explicit close, and lock release after error.

- [ ] **Step 2: Run tests and verify adapter is missing**

Run: `npm test -- --run web/src/device/transport/BrowserSerialTransport.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add minimal Web Serial declarations and adapter**

Declare only members used by the adapter: `Navigator.serial`, `Serial.requestPort`, `SerialPort.open/close/readable/writable`, and disconnect event. Implement constructor options `{ baudRate: 115200, bufferSize: 1024 }`, hold one reader/writer at a time, decode with streaming `TextDecoder`, split only through `JsonLineDecoder` at the runner layer, and release locks in `finally`.

Public errors are:

```ts
export type SerialConnectionErrorCode = 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'OPEN_FAILED' | 'DISCONNECTED' | 'WRITE_FAILED';
```

- [ ] **Step 4: Verify and commit Web Serial transport**

Run:

```powershell
npm test -- --run web/src/device/transport
npm run typecheck
```

Expected: fake-port tests and simulator tests pass.

```powershell
git add web/src/device/web-serial.d.ts web/src/device/transport
git commit -m "feat: connect browser to STM32 serial"
```

### Task 5: Build the device console and manual fallback

**Files:**
- Create: `web/src/pages/DeviceConsolePage.test.tsx`
- Create: `web/src/pages/DeviceConsolePage.tsx`
- Create: `web/src/components/DeviceSafetyChecklist.tsx`
- Create: `web/src/components/DeviceTestCard.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: catalog, transports, runner, evidence mapper, `recordEvidence`.
- Produces: `/device` route with safe connection and testing workflow.

- [ ] **Step 1: Write failing UI state tests**

Assert:

1. Connection button is disabled until 3.3 V TTL, cross TX/RX, common ground, and single-power-source checks are selected.
2. Clicking connect directly calls `requestPort`; it is never called on mount.
3. Unsupported browser shows manual mode and named Chrome/Edge guidance.
4. Wrong firmware disables write/flash tests but still permits hello/chip ID.
5. Simulated pass displays `模拟结果，不能计为实机通过` and records pending evidence.
6. Semi-automatic tests require a separate observed-phenomenon confirmation.
7. Disconnect/timeout/error keeps the log and shows a concrete retry checklist.

- [ ] **Step 2: Run the UI test and verify the console is missing**

Run: `npm test -- --run web/src/pages/DeviceConsolePage.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement a state-machine UI**

Use states `idle`, `connecting`, `connected`, `running`, `disconnected`, and `error`. Render catalog cards only after a transport is selected. Each card shows wiring, safety, firmware version, proof mode, timeout, latest result, and evidence status. Use `aria-live="polite"` for connection/test status and a bounded 200-line on-screen log.

Manual mode provides the same lab observation checklist and records `manual-confirmed` only after the learner explicitly checks the named phenomenon; it never fabricates device details.

- [ ] **Step 4: Verify and commit the console**

Run:

```powershell
npm test -- --run web/src/pages/DeviceConsolePage.test.tsx
npm run typecheck
npm run build
```

Expected: all seven state cases pass and production build exits 0.

```powershell
git add web/src/pages/DeviceConsolePage* web/src/components/Device* web/src/app/router.tsx web/src/styles.css
git commit -m "feat: add safe development-board console"
```

### Task 6: Create the bounded device-test firmware protocol core

**Files:**
- Create: `firmware/device-test/stm32f103/stm32f103-device-test.ioc`
- Create: `firmware/device-test/stm32f103/CMakeLists.txt`
- Create: `firmware/device-test/stm32f103/CMakePresets.json`
- Create: `firmware/device-test/stm32f103/App/protocol.h`
- Create: `firmware/device-test/stm32f103/App/protocol.c`
- Create: `firmware/device-test/stm32f103/App/test_registry.h`
- Create: `firmware/device-test/stm32f103/App/test_registry.c`
- Create: `firmware/device-test/stm32f103/App/app.c`
- Create: `firmware/device-test/host-tests/protocol_test.c`
- Create: `firmware/device-test/host-tests/CMakeLists.txt`

**Interfaces:**
- Consumes: USART1 RX bytes and HAL peripheral handles.
- Produces: one bounded JSON result/error per run request.

- [ ] **Step 1: Generate the CubeMX base and write failing host parser tests**

Configure STM32F103C8Tx, 72 MHz, Serial Wire, USART1 115200 8N1 with receive interrupt or DMA, GPIO loopback pins, TIM PWM/capture pins, ADC+DMA, I2C1, SPI1, RTC/BKP, PWR, and watchdog support. Keep write-capable tests disabled until their runtime preconditions pass.

Host tests feed valid request, fragmented request, oversized line, wrong version, unknown test, and busy second request. Expected response codes exactly match protocol v1.

- [ ] **Step 2: Run host tests and verify parser functions are missing**

Run:

```powershell
cmake -S firmware/device-test/host-tests -B work/device-host-tests -G Ninja
cmake --build work/device-host-tests
ctest --test-dir work/device-host-tests --output-on-failure
```

Expected: build fails because `Protocol_PushByte` and registry functions are not implemented.

- [ ] **Step 3: Implement a no-allocation bounded parser**

Create `protocol.h` with:

```c
#define PROTOCOL_MAX_LINE 512U
#define PROTOCOL_MAX_ID 64U
#define PROTOCOL_MAX_TEST 64U

typedef struct {
  char id[PROTOCOL_MAX_ID + 1U];
  char test[PROTOCOL_MAX_TEST + 1U];
} ProtocolRequest;

typedef enum { PROTOCOL_MORE, PROTOCOL_READY, PROTOCOL_INVALID, PROTOCOL_TOO_LONG } ProtocolStatus;
ProtocolStatus Protocol_PushByte(uint8_t byte, ProtocolRequest *request);
void Protocol_WriteResult(const ProtocolRequest *request, const char *status, const char *details_json);
void Protocol_WriteError(const char *id, const char *test, const char *code, const char *message);
```

The parser accepts only the fixed version/type/id/test structure, copies with bounds, discards through newline after overflow, and never executes a partial request. Response writing uses bounded `snprintf` and a UART transmit queue, not unbounded `printf` from an interrupt.

- [ ] **Step 4: Implement single-test dispatch**

`test_registry.c` maps the 15 exact catalog IDs to functions returning `TEST_PASS`, `TEST_FAIL`, or `TEST_ERROR`. Maintain one `busy` flag; the second request returns `BUSY`. Unknown tests return `UNKNOWN_TEST`. The main loop, not the USART IRQ, runs tests.

- [ ] **Step 5: Verify host protocol and ARM firmware build**

Run host CTest, then configure/build `firmware/device-test/stm32f103` with Debug preset. Expected: host cases pass and the ARM ELF links within STM32F103C8 flash/RAM limits.

- [ ] **Step 6: Commit protocol firmware core**

```powershell
git add firmware/device-test
git commit -m "feat: add bounded STM32 device-test protocol"
```

### Task 7: Implement non-destructive peripheral test groups

**Files:**
- Create: `firmware/device-test/stm32f103/App/tests/test_system.c`
- Create: `test_gpio_tim.c`, `test_adc_dma.c`, `test_usart.c`
- Create: `test_i2c.c`, `test_spi.c`, `test_rtc_wdg.c`, `test_flash_pwr.c`
- Create: `firmware/device-test/host-tests/test_registry_test.c`
- Modify: `firmware/device-test/stm32f103/App/test_registry.c`

**Interfaces:**
- Consumes: generated HAL handles and fixed test preconditions.
- Produces: structured detail scalars for all 15 catalog tests.

- [ ] **Step 1: Write registry tests for every ID and safety rejection**

Use host HAL fakes to assert each ID dispatches once, timeout becomes `HARDWARE`/`TIMEOUT`, W25Q64 write outside the fixed region is impossible, internal FLASH address is the reserved page constant, and simulator-only flags never appear in firmware output.

- [ ] **Step 2: Run host tests and verify all test functions are missing**

Run CTest. Expected: linker failures name the missing group functions.

- [ ] **Step 3: Implement system, GPIO/TIM, ADC/DMA, and USART checks**

- `system.hello`: firmware/protocol/build strings.
- `system.chip-id`: three STM32 unique-ID words.
- `gpio.loopback`: drive output low/high and read dedicated input both times.
- `exti.event-count`: arm a 10 s window and report count/timestamps as semi-automatic details.
- `tim.pwm-capture`: generate a fixed PWM and require captured frequency/duty within 2%.
- `adc.range-dma`: collect 32 samples, report min/max/change and DMA count.
- `dma.memory-copy`: compare a fixed source/destination array and flags.
- `usart.packet`: validate parser echo, checksum/error counters, and buffer bounds.

- [ ] **Step 4: Implement external bus checks with explicit preconditions**

- `i2c.mpu6050-id`: return PRECONDITION on NACK; require WHO_AM_I `0x68` or configured address variant.
- `spi.flash-id`: read JEDEC ID and reject all-0/all-FF.
- `spi.flash-roundtrip`: read and save 256 bytes at `TEST_SECTOR_ADDRESS`, erase/program a deterministic pattern, verify, then erase/program the saved bytes and verify restoration. A restoration failure returns fail with `restore=false`.

- [ ] **Step 5: Implement RTC/reset/FLASH/PWR checks**

- `rtc.bkp`: write/read a test backup register and measure RTC counter progression; true power-loss remains outside automatic proof.
- `wdg.reset-cause`: report RCC reset flags; a two-stage watchdog exercise uses a BKP magic value and clears it after reporting.
- `flash.reserved-page`: back up the reserved page, erase/program/verify pattern, restore/verify; reject if linker symbols do not bound the page outside code/data.
- `pwr.sleep-wake`: arm wake source, enter selected safe mode, and report wake/reset reason after reconnect; current remains manual.

- [ ] **Step 6: Run all host and ARM builds**

Run host CTest and device-test Debug build. Expected: all 15 IDs pass fake success tests, every destructive fake test verifies restoration, and ARM memory usage stays inside device limits.

- [ ] **Step 7: Commit peripheral test groups**

```powershell
git add firmware/device-test
git commit -m "feat: implement safe STM32 device checks"
```

### Task 8: Verify simulator and browser failure matrix end to end

**Files:**
- Create: `web/e2e/device-console.spec.ts`
- Modify: `web/playwright.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: complete device console and simulator.
- Produces: browser-level proof of all supported failure/recovery states.

- [ ] **Step 1: Add simulator URL control available only in development/test builds**

Support `?deviceSimulator=pass|fail|timeout|disconnect|malformed|wrong-version` when `import.meta.env.DEV` or `MODE === 'test'`; production builds ignore the parameter and never expose fake results as real serial.

- [ ] **Step 2: Write six Playwright scenarios**

For each simulator scenario, open `/device`, complete safety checks, choose simulator, run `system.hello`, and assert the exact visible state. Also assert pass creates pending evidence with `simulated=true`, timeout offers retry, disconnect preserves logs, wrong version disables write tests, and manual fallback records no device-generated values.

- [ ] **Step 3: Run and fix only device integration gaps**

Run: `npm run test:e2e -- web/e2e/device-console.spec.ts`

Expected after focused fixes: six simulator scenarios pass in desktop Chromium.

- [ ] **Step 4: Run the device-console gate**

Run:

```powershell
npm test -- --run web/src/device web/src/pages/DeviceConsolePage.test.tsx
npm run typecheck
npm run build
npm run test:e2e -- web/e2e/device-console.spec.ts
cmake --build work/device-host-tests
ctest --test-dir work/device-host-tests --output-on-failure
cmake --build --preset Debug --parallel
git diff --check
```

Expected: TypeScript/device/UI/E2E/host-C/ARM builds all pass. No output claims real hardware was tested.

- [ ] **Step 5: Commit the verified simulated workflow**

```powershell
git add web package.json firmware/device-test docs/device
git commit -m "test: verify device console failure matrix"
```

## Device Console Acceptance

- [ ] Protocol v1 rejects malformed, oversized, unknown, busy, and wrong-version requests safely.
- [ ] Simulator and serial use the same runner and result-to-evidence conversion.
- [ ] Simulator results can never become mastered evidence.
- [ ] Chrome/Edge port selection happens only after a user click.
- [ ] All 15 catalog checks declare wiring, safety, firmware, timeout, proof mode, and tags.
- [ ] Write-capable flash tests are bounded and verify restoration.
- [ ] Manual physical observations remain visibly separate.
- [ ] Host C tests, ARM build, TypeScript tests, and browser scenarios pass.
- [ ] Real hardware status remains `待实机验证` until the release plan records physical evidence.
- [ ] `git status --short` is empty after the final commit.
