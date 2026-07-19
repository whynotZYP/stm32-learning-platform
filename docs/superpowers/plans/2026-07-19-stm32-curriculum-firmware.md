# STM32 Curriculum and Firmware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the complete 24-week teaching content, labs, assessments, remediation material, note prompts, and buildable STM32CubeMX/HAL firmware projects.

**Architecture:** Each week has one manifest and one Markdown lesson; labs and assessments are separate validated records referenced by ID. Firmware projects are independent CubeMX-generated CMake projects so a learner can open, build, flash, and debug one concept without inheriting unrelated peripherals.

**Tech Stack:** Markdown, JSON, Zod, TypeScript content validation, STM32CubeMX 6.18.0, STM32CubeCLT 1.22.0, CMake, Ninja, arm-none-eabi-gcc, STM32F1 HAL/LL.

## Global Constraints

- Exactly 24 week manifests and 24 detailed Markdown lessons must exist.
- Every one of the 46 source IDs is present in `curriculum/course-map.json` and referenced by at least one week.
- `curriculum/source-api-inventory.json` is the versioned authoritative source inventory: it contains each of `05`, `06-1`, `06-2`, and `07` through `49` exactly once, with provenance and an explicit SPL-symbol array.
- Every core topic has a plain-language explanation, CubeMX rationale, minimum lab, debug observation, injected fault, explain-back prompt, assessment, and note task.
- Every lesson and lab declares one `automatic`, one `semi-automatic`, and one `manual` shared `detectionChecks` record; a mode that does not apply states `applicable: false` and a non-empty reason. Core hardware topics retain at least one device/semi-automatic path and one manual path; simulator output never proves physical hardware behavior.
- HAL is the runnable mainline; each peripheral week includes at least one register/LL observation and a SPL-to-HAL mapping note where the source material used SPL names.
- Hardware instructions state 3.3 V logic, disconnected-power rewiring, current limiting, common ground, and load-power boundaries where relevant.
- Generated CubeMX files are committed; learner edits stay in generated `USER CODE` regions or focused `App/` files.
- Each firmware project builds independently; compilation is evidence of syntax/link correctness, not physical behavior.
- Real-device observations remain manual or Web Serial evidence and are never inferred from a successful build.
- Content tasks and firmware tasks each end with validation and a focused commit.

---

## File Map

- `curriculum/knowledge-tags.json`: tag titles, plain explanations, and prerequisite graph.
- `curriculum/source-api-inventory.json`: versioned provenance and SPL-symbol inventory for all 46 source courses.
- `curriculum/weeks/w01.json` … `w24.json`: validated week/lesson metadata.
- `curriculum/weeks/w01.md` … `w24.md`: detailed learner-facing lessons.
- `curriculum/remediation/*.md`: deterministic mini-lessons selected by tag/action.
- `curriculum/extensions/*.md`: FreeRTOS, control, protocol, driver, low-power, digital-logic, and FPGA/PLA bridges.
- `labs/manifests/lab-w01-*.json` … `lab-w23-*.json`: wiring, safety, observations, faults, evidence modes, firmware path.
- `assessments/question-banks/assessment-w01.json` … `assessment-w24.json`: four-category evidence items.
- `assessments/practicals/gate-01.json` … `gate-06.json`: every-four-week integrated practicals.
- `assessments/rubrics/common-rubric.md`: exact 25/25/35/15 scoring guide.
- `docs/references/spl-to-hal-map.md`: source-course SPL API names mapped to HAL/LL/register concepts.
- `notes/templates/weekly-note.md`: GitHub note structure.
- `firmware/lessons/*`: CubeMX projects for core hardware labs.
- `firmware/shared/`: only protocol-independent helpers that are used by at least three projects.
- `firmware/projects.json`: explicit build matrix.
- `scripts/firmware/build-all.ps1`: build every committed firmware target.
- `scripts/content-validation/validate-content.ts`: extended cross-file coverage validator.

### Task 1: Lock the tag graph and full-content validation rules

**Files:**
- Create: `curriculum/knowledge-tags.json`
- Create: `curriculum/source-api-inventory.json`
- Create: `scripts/content-validation/repository-content.test.ts`
- Modify: `scripts/content-validation/validate-content.ts`
- Modify: `web/src/domain/content/schemas.ts`

**Interfaces:**
- Consumes: course contracts and course map from the foundation plan.
- Produces: `validateRepositoryContent(root, options): Promise<ValidationReport>`, an acyclic tag graph, and a validated source API inventory.

- [ ] **Step 1: Create the versioned source API inventory and exact tag inventory**

Create `curriculum/source-api-inventory.json` with `schemaVersion: 1` and exactly 46 records. The `sourceCourseId` values are `05`, `06-1`, `06-2`, and every ID from `07` through `49`, each exactly once. Every record has this complete shape:

```json
{
  "sourceCourseId": "05",
  "sourceTitle": "source-course title captured at access time",
  "sourceUrl": "https://…",
  "accessedAt": "YYYY-MM-DD",
  "splSymbols": []
}
```

`sourceUrl` and `accessedAt` are required provenance for every record. `splSymbols` is always an explicit array; use `[]` when the accessed source contains no SPL identifier. Do not derive this file from unversioned inputs at validation time.

Create `curriculum/knowledge-tags.json` with schema version 1 and these IDs. Each record includes a Chinese title, a 10+ character plain-language explanation, and the listed prerequisites:

| Tag ID | Plain purpose | Prerequisites |
|---|---|---|
| `foundation.electricity` | voltage/current/resistance and current path | none |
| `foundation.binary` | bits, hex, masks | none |
| `c.control-flow` | expressions, branches, loops, functions | `foundation.binary` |
| `c.memory` | types, structs, pointers, addresses | `c.control-flow` |
| `mcu.memory-map` | memory/peripheral addresses | `c.memory` |
| `toolchain.build-debug` | CubeMX→CMake→compiler→flash→debug | `c.control-flow` |
| `gpio.output-mode` | push-pull/open-drain and output path | `foundation.electricity`, `mcu.memory-map` |
| `gpio.input-bias` | floating/pull-up/pull-down | `foundation.electricity`, `gpio.output-mode` |
| `debug.observation` | breakpoint/watch/register/OLED/serial evidence | `toolchain.build-debug` |
| `nvic.priority` | interrupt ordering and preemption | `mcu.memory-map` |
| `exti.event-flow` | edge→pending bit→ISR→clear | `gpio.input-bias`, `nvic.priority` |
| `tim.timebase` | clock, prescaler, auto-reload, update event | `foundation.binary`, `nvic.priority` |
| `tim.pwm` | frequency and duty cycle generation | `tim.timebase`, `gpio.output-mode` |
| `tim.capture` | timestamp edges and measure signals | `tim.timebase`, `gpio.input-bias` |
| `tim.encoder` | quadrature direction and count | `tim.capture` |
| `adc.sampling` | sample, quantize, align, calibrate | `foundation.electricity`, `tim.timebase` |
| `dma.transfer` | peripheral-memory transfers without CPU copying | `c.memory`, `mcu.memory-map` |
| `usart.physical-frame` | voltage, baud, start/data/stop bits | `foundation.binary`, `gpio.output-mode` |
| `usart.packet` | framing, boundaries, validation, timeout | `usart.physical-frame`, `exti.event-flow` |
| `i2c.protocol` | open-drain bus, address, ACK, START/STOP | `gpio.output-mode`, `usart.packet` |
| `i2c.mpu6050` | read a sensor register map | `i2c.protocol`, `debug.observation` |
| `spi.protocol` | clock polarity/phase, chip select, shifting | `foundation.binary`, `gpio.output-mode` |
| `spi.w25q64` | JEDEC ID, erase/program/read constraints | `spi.protocol`, `c.memory` |
| `rtc.time` | Unix time, backup domain, RTC counter | `tim.timebase`, `c.memory` |
| `pwr.low-power` | sleep/stop/standby and wake sources | `rtc.time`, `exti.event-flow` |
| `wdg.recovery` | independent/window watchdog and reset cause | `tim.timebase`, `debug.observation` |
| `flash.persistence` | erase/program/alignment/reserved page/chip ID | `c.memory`, `mcu.memory-map` |
| `system.integration` | combine sensing, storage, display, time, recovery | `gpio.output-mode`, `exti.event-flow`, `tim.pwm`, `tim.capture`, `adc.sampling`, `dma.transfer`, `usart.packet`, `i2c.mpu6050`, `spi.w25q64`, `rtc.time`, `pwr.low-power`, `wdg.recovery`, `flash.persistence` |

- [ ] **Step 2: Write failing repository-level tests**

Include fixtures for a missing/duplicate source inventory ID, missing provenance, an omitted `splSymbols` field, and a lesson or lab that omits a required detection mode or non-applicable reason.

Create `scripts/content-validation/repository-content.test.ts` with temporary-repository fixtures that prove the validator reports each of these exact failures separately:

```ts
const expectedFailures = [
  '必须恰好有 24 个周清单和 24 个周正文',
  '知识标签存在循环前置关系',
  '周正文缺少章节：故障注入',
  '实验缺少断电接线安全项',
  '考核未覆盖四类证据',
  '核心主题缺少实验',
  '源课程未被周清单引用',
  '固件路径不存在',
];
```

Also test the checked-in repository after all later tasks, but mark that assertion with a fixture-generated minimal complete repository until Tasks 2–8 populate real content; never skip the test.

- [ ] **Step 3: Run tests and verify repository validation is absent**

Run: `npm test -- --run scripts/content-validation/repository-content.test.ts`

Expected: FAIL because `validateRepositoryContent` is not exported.

- [ ] **Step 4: Extend schemas and validator with exact cross-file checks**

Add `RemediationManifestSchema`, `ExtensionManifestSchema`, and `PracticalGateSchema` to `schemas.ts`. Extend `validate-content.ts` to:

1. Read JSON and Markdown as UTF-8.
2. Require exactly `w01`–`w24` JSON/Markdown pairs.
3. Validate each referenced lesson, lab, assessment, tag, firmware path, remediation path, and extension path.
4. Parse Markdown headings and require: `学完后能解释`, `学完后能做到`, `概念模型`, `CubeMX 为什么这样配`, `最小实验`, `调试与寄存器观察`, `故障注入`, `复述检查`, `学习笔记`, `资料来源`.
5. Verify every lab contains a safety line matching `断电` and any motor/servo lab contains `独立供电` plus `共地`.
6. Verify every assessment has at least one item of each `EvidenceKind` and category maximums total 25/25/35/15.
7. Detect tag cycles by depth-first traversal with visiting/visited sets.
8. Verify the union of week `sourceCourseIds` equals all 46 course-map IDs.

Also validate `curriculum/source-api-inventory.json`: require exactly the 46 course-map IDs once each; require non-empty `sourceTitle`, HTTPS `sourceUrl`, `accessedAt` in `YYYY-MM-DD`, and an explicit `splSymbols` array for every record. Require every lesson and lab to pass the shared `detectionChecks` schema, including all three modes and explicit non-applicable reasons. For core hardware tags, require an applicable `semi-automatic` check and an applicable `manual` check; reject simulator-only evidence as proof of physical behavior.
9. Verify required core topic tags each have at least one lesson, lab, fault task, and assessment item.
10. Require `资料来源` to contain at least one HTTPS URL and `访问日期：YYYY-MM-DD`; peripheral weeks 3–22 must contain at least one `st.com` or `dev.st.com` primary source.

Use these exported signatures:

```ts
export interface RepositoryValidationOptions { weeks?: number[]; requireCompleteRepository: boolean }
export async function validateRepositoryContent(root: string, options: RepositoryValidationOptions): Promise<ValidationReport>;
```

The CLI accepts either `--weeks 1-4` (validate only that exact week set plus its referenced files) or no `--weeks` (require the complete repository). A scoped run still enforces all lesson/lab/assessment/safety rules for its weeks; it only postpones the 24-week union and shared-final-artifact checks.

- [ ] **Step 5: Verify fixture behavior and commit the contracts**

Run: `npm test -- --run scripts/content-validation/repository-content.test.ts`

Expected: every intentionally broken fixture returns its named failure; the minimal complete fixture passes.

```powershell
git add curriculum/knowledge-tags.json scripts/content-validation web/src/domain/content/schemas.ts
git commit -m "feat: validate complete curriculum evidence"
```

### Task 2: Author Weeks 1–4 and the first phase gate

**Files:**
- Create: `curriculum/weeks/w01.json`, `w01.md`, `w02.json`, `w02.md`, `w03.json`, `w03.md`, `w04.json`, `w04.md`
- Create: `labs/manifests/lab-w01-breadboard.json`, `lab-w02-bitmask.json`, `lab-w03-first-project.json`, `lab-w04-gpio-output.json`
- Create: `assessments/question-banks/assessment-w01.json` … `assessment-w04.json`
- Create: `assessments/practicals/gate-01.json`
- Create: `firmware/lessons/w03-first-project/` and `firmware/lessons/w04-gpio-output/`

**Interfaces:**
- Consumes: week/lab/assessment schemas and STM32 toolchain.
- Produces: phase 1 content and build targets `w03-first-project`, `w04-gpio-output`.

- [ ] **Step 1: Write the phase-specific failing coverage test**

Add a test asserting weeks 1–4 have 4 manifests, 4 Markdown bodies, 4 labs, 4 assessments, one gate, and firmware paths for weeks 3–4. It must fail before files are authored.

- [ ] **Step 2: Author the exact learning spine**

For every lesson and lab authored in Tasks 2 through 7, populate the foundation plan's shared `detectionChecks` contract. Declare all three modes. For core hardware topics include an applicable device/semi-automatic path and an applicable manual path; express any unavailable mode as `applicable: false` with its reason, and never treat simulator output as physical-hardware proof.

Use the common ten-heading Markdown contract and this week-specific content:

| Week | Concepts that must be explained | Minimum lab | Injected fault | Explain-back proof |
|---|---|---|---|---|
| 1 | voltage as potential difference, current path, resistance, breadboard rails, 3.3 V vs 5 V, binary/hex | identify rails, calculate a 1 kΩ LED current, continuity-style connection check without powering GPIO | reverse LED and open the resistor path while power is disconnected | draw the complete current loop and explain why the resistor protects the LED/GPIO |
| 2 | integer widths, signed/unsigned, bit operators, masks, functions, arrays, structs, enum, pointer/address | desktop C exercises that set/clear/test bits and inspect a struct address | use `=` instead of `==` in a controlled exercise and shift beyond intended bit | trace one expression bit by bit and distinguish value from address |
| 3 | Cortex-M3/STM32F103 overview, clock tree, memory map, build/link/flash/debug chain, generated code boundaries | create CubeMX CMake project, build, flash, halt at `main`, inspect RCC/GPIO registers | select wrong debugger/target and diagnose from tool output | narrate `.c` source → object → ELF → flash → CPU execution |
| 4 | GPIO input/output structure, push-pull/open-drain, speed as edge drive, ODR/BSRR/IDR, LED/buzzer circuit | blink LED, alternate two LEDs, command buzzer with HAL; observe ODR/BSRR | choose open-drain without pull-up and remove a required current path | explain the pin transistor path and why BSRR avoids read-modify-write races |

Each assessment contains exactly four category totals: 25 concept, 25 configuration/code, 35 practical/troubleshooting, 15 reflection/note. Gate 1 asks the learner to create a fresh LED project, explain every CubeMX choice, repair one injected GPIO fault, and commit a Markdown note.

- [ ] **Step 3: Create CubeMX projects with exact baseline settings**

For both projects select STM32F103C8Tx, HSE crystal when the board has one, 72 MHz system clock, Serial Wire debug, CMake toolchain, and STM32CubeF1 HAL. Keep `SystemClock_Config`, `MX_GPIO_Init`, and HAL initialization generated.

`w03-first-project` toggles the board LED once per second from `App/app.c`. `w04-gpio-output` exposes `App_SetLed(bool on)`, `App_ToggleLed()`, and `App_SetBuzzer(bool on)`; pin aliases come from CubeMX-generated `main.h`, not numeric literals in application code.

- [ ] **Step 4: Build, validate, and commit phase 1**

Run:

```powershell
npm run validate:content -- --weeks 1-4
Push-Location firmware/lessons/w03-first-project
cmake --preset Debug
cmake --build --preset Debug --parallel
Pop-Location
Push-Location firmware/lessons/w04-gpio-output
cmake --preset Debug
cmake --build --preset Debug --parallel
Pop-Location
```

Expected: phase coverage test passes and both `.elf` files link without overflow.

```powershell
git add curriculum/weeks/w0[1-4]* labs/manifests/lab-w0[1-4]* assessments firmware/lessons/w03-first-project firmware/lessons/w04-gpio-output
git commit -m "feat: teach foundations and GPIO output"
```

### Task 3: Author Weeks 5–8 and the second phase gate

**Files:**
- Create: week files `w05`–`w08`
- Create: labs `lab-w05-gpio-input`, `lab-w06-oled-debug`, `lab-w07-exti-events`, `lab-w08-tim-timebase`
- Create: assessments `assessment-w05`–`assessment-w08`, practical `gate-02`
- Create: firmware projects `w05-gpio-input`, `w06-oled-debug`, `w07-exti-events`, `w08-tim-timebase`

**Interfaces:**
- Produces: phase 2 content and four buildable HAL projects.

- [ ] **Step 1: Add a failing phase 2 coverage/build-matrix test**

Assert exact files, source IDs 07–14 as allocated by the course map, four evidence categories per week, and four unique firmware targets.

- [ ] **Step 2: Author these exact learning outcomes**

| Week | Concepts | Minimum lab | Injected fault | Register/LL observation |
|---|---|---|---|---|
| 5 | floating/pull-up/pull-down, active-low input, switch bounce, sensor digital output, polling/state change | debounced button controls LED; light module triggers buzzer | floating input or inverted active level | compare IDR and HAL read result |
| 6 | OLED pixel/page memory, I2C/SPI distinction for the owned module, display as debug output, breakpoint/watch limits | display counter, input state, and one diagnostic code | wrong display address or swapped SCL/SDA | watch buffer bytes before transfer |
| 7 | interrupt lifecycle, pending flag, priority group, EXTI line mapping, ISR brevity, encoder/IR events | count IR pulses and encoder steps with EXTI | omit pending-bit clear and observe interrupt storm | inspect EXTI PR, IMR and NVIC pending state |
| 8 | timer clock source, PSC/ARR equation, update event, interrupt period, external clock mode | 1 ms tick plus 1 s event; count external pulses | off-by-one PSC/ARR and wrong timer clock assumption | inspect CNT, PSC, ARR, SR UIF |

Gate 2 requires event-driven counting without blocking delay, OLED/serial evidence, one priority explanation, and repair of a pending-flag bug.

- [ ] **Step 3: Generate focused CubeMX/HAL projects**

Use EXTI on a documented button/sensor pin, priority values recorded in each lab manifest, TIM2 for the timebase unless a board pin conflict is documented, and generated IRQ handlers that call focused `App_*` callbacks. The OLED driver stays inside `App/Display/` and exposes only `Display_Init`, `Display_Clear`, `Display_WriteLine`, and `Display_Refresh`.

- [ ] **Step 4: Validate, build all four targets, and commit**

Run each project's configure/build presets from inside its project directory, then `npm run validate:content -- --weeks 5-8`. Expected: four ELF files and no source/tag coverage error.

```powershell
git add curriculum/weeks/w0[5-8]* labs assessments firmware/lessons/w0[5-8]*
git commit -m "feat: teach GPIO events OLED and timer base"
```

### Task 4: Author Weeks 9–12 and the third phase gate

**Files:**
- Create: week files `w09`–`w12`
- Create: labs `lab-w09-pwm`, `lab-w10-actuators`, `lab-w11-tim-measurement`, `lab-w12-adc`
- Create: assessments `assessment-w09`–`assessment-w12`, practical `gate-03`
- Create: firmware projects `w09-pwm`, `w10-actuators`, `w11-tim-measurement`, `w12-adc`

**Interfaces:**
- Produces: timer/ADC phase content and four firmware targets.

- [ ] **Step 1: Add the failing phase 3 content/build test**

Require source IDs 15–22, PWM and input-capture loopback evidence, ADC calibration/sampling coverage, motor safety text, and the four targets.

- [ ] **Step 2: Author this week-specific content**

| Week | Concepts | Minimum lab | Injected fault | Physical/manual evidence |
|---|---|---|---|---|
| 9 | output compare, PWM frequency/duty, preload, polarity, timer channel path | 1 kHz PWM, change duty in steps, LED breathing | wrong channel pin alternate function or no preload | LED brightness is manual; PWM value is loopback-measurable later |
| 10 | servo pulse width, motor inductive load, TB6612 inputs, separate power/common ground | command servo angles and motor speed/direction | missing common ground or disabled driver standby | motion/sound/current are manual only |
| 11 | input capture edge timestamps, overflow, PWMI slave reset, quadrature encoder | output PWM wired to capture; measure frequency/duty; encoder speed | capture wrong edge or overflow ignored | Web/device loopback can verify numeric tolerance |
| 12 | successive approximation, reference voltage, sample time, channel sequence, alignment, calibration | read potentiometer and two sensors, convert raw value to voltage | GPIO not analog or sample time too short | voltage accuracy requires meter; range/change can be automatic |

Gate 3 requires deriving timer values on paper, PWM→capture error within 2%, safe actuator wiring explanation, and diagnosing one ADC configuration fault.

- [ ] **Step 3: Generate and structure the four firmware projects**

Use TIM2/TIM3 channels selected by conflict-free `.ioc` pin assignments. Keep actuator commands bounded in `App/actuators.c`; reject servo pulse outside 500–2500 µs and motor command outside -1000..1000. ADC project runs calibration once after enable and exposes raw plus millivolt values.

- [ ] **Step 4: Validate, build, and commit phase 3**

Run all four configure/build presets from inside each project directory and `npm run validate:content -- --weeks 9-12`. Expected: no linker overflow; every actuator lab includes `独立供电` and `共地`.

```powershell
git add curriculum/weeks/w09* curriculum/weeks/w1[0-2]* labs assessments firmware/lessons/w09-pwm firmware/lessons/w1[0-2]*
git commit -m "feat: teach PWM capture encoders and ADC"
```

### Task 5: Author Weeks 13–16 and the fourth phase gate

**Files:**
- Create: week files `w13`–`w16`
- Create: labs `lab-w13-dma`, `lab-w14-usart`, `lab-w15-usart-packets`, `lab-w16-i2c-basics`
- Create: assessments `assessment-w13`–`assessment-w16`, practical `gate-04`
- Create: firmware projects `w13-adc-dma`, `w14-usart`, `w15-usart-packets`, `w16-i2c-mpu6050-id`

**Interfaces:**
- Produces: data movement and communication fundamentals plus four firmware targets.

- [ ] **Step 1: Add failing phase 4 coverage tests**

Require source IDs 23–32, DMA alignment/circular mode, USART electrical/frame/packet layers, CH340 safety, I2C open-drain/ACK, and explicit packet timeout/fault evidence.

- [ ] **Step 2: Author these outcomes**

| Week | Concepts | Minimum lab | Injected fault | Evidence |
|---|---|---|---|---|
| 13 | DMA request, direction, width/alignment, count, circular buffer, ADC scan | memory copy then four-channel ADC circular buffer | mismatched peripheral/memory width | compare buffer and transfer flags automatically |
| 14 | serial/parallel, simplex/duplex, async frame, baud, TTL level, USART block, polling/IRQ | CH340 transmit/receive and `printf` without blocking critical paths | wrong baud and crossed/missing ground | valid echo/packet is automatic; wire safety manual |
| 15 | text vs HEX, frame boundaries, length, checksum, timeout, state machine, bootloader principle | send/receive robust command packets with partial delivery | drop byte, corrupt checksum, concatenate frames | parser success/failure automatic |
| 16 | I2C open-drain/pull-up, address/RW bit, START/STOP/ACK/NACK, MPU6050 map | software sequence drawing and WHO_AM_I read | use 8-bit address as 7-bit or remove pull-up | WHO_AM_I automatic when device connected |

Gate 4 requires explaining CPU vs DMA data flow, repairing a corrupted USART frame, and tracing an I2C register read from START to STOP.

- [ ] **Step 3: Generate four focused firmware projects**

DMA project exposes a stable snapshot API rather than reading a half-updated buffer. USART packet project uses a bounded receive state machine and never calls blocking display code inside an IRQ. I2C project reads only WHO_AM_I in this week; full sensor data waits until week 18.

- [ ] **Step 4: Validate, build, and commit phase 4**

Run all four project builds plus `npm run validate:content -- --weeks 13-16` and the focused tests. Expected: parser host tests include partial and concatenated frames; firmware ELFs link.

```powershell
git add curriculum/weeks/w1[3-6]* labs assessments firmware/lessons/w1[3-6]*
git commit -m "feat: teach DMA USART packets and I2C basics"
```

### Task 6: Author Weeks 17–20 and the fifth phase gate

**Files:**
- Create: week files `w17`–`w20`
- Create: labs `lab-w17-i2c-compare`, `lab-w18-mpu6050`, `lab-w19-software-spi`, `lab-w20-hardware-spi`
- Create: assessments `assessment-w17`–`assessment-w20`, practical `gate-05`
- Create: firmware projects `w17-i2c-compare`, `w18-mpu6050`, `w19-software-spi-w25q64`, `w20-hardware-spi-w25q64`

**Interfaces:**
- Produces: driver-reading skill, I2C/SPI implementation comparison, and safe W25Q64 storage.

- [ ] **Step 1: Add failing phase 5 coverage tests**

Require source IDs 33–40, software/hardware comparison, MPU6050 data conversion, all four SPI modes conceptually, JEDEC ID, page/sector constraints, and reserved-test-region safety.

- [ ] **Step 2: Author these outcomes**

| Week | Concepts | Minimum lab | Injected fault | Evidence |
|---|---|---|---|---|
| 17 | bit-banged I2C timing, hardware state machine, timeout/recovery, waveform comparison | read same register with software and hardware I2C | hold SDA low/NACK and require bounded timeout | results/logs automatic; waveform description manual |
| 18 | MPU6050 accel/gyro registers, signed 16-bit combine, scale, bias, simple filtering | stream six axes and observe orientation changes | swapped high/low byte or wrong full-scale factor | WHO_AM_I/value change automatic, physical orientation manual |
| 19 | SPI full duplex, CPOL/CPHA, chip select, shift order, W25Q status/write enable/page/sector | software SPI JEDEC ID and reserved sector write/read | wrong mode or omit write-enable | ID/write-read automatic |
| 20 | hardware SPI block, flags, continuous/non-continuous transfer, performance | repeat ID/write-read via hardware SPI and compare time | CS toggled between command/address/data | automatic comparison and failure log |

Gate 5 requires reading a new sensor/flash register from its data sheet, explaining protocol timing, recovering one stuck-bus/mode fault, and proving W25Q64 writes only the reserved region.

- [ ] **Step 3: Generate and bound the four firmware projects**

I2C drivers return explicit timeout/error codes. MPU conversion combines bytes with unsigned shifts then casts to `int16_t`. Both W25Q64 projects centralize `TEST_SECTOR_ADDRESS`, verify it lies inside a linker-independent documented reserved sector, preserve previous bytes, and restore them after the test.

- [ ] **Step 4: Validate, build, and commit phase 5**

Run all four builds and `npm run validate:content -- --weeks 17-20`. Expected: every bus wait has a timeout path and no write routine accepts an unrestricted address from Web Serial.

```powershell
git add curriculum/weeks/w1[7-9]* curriculum/weeks/w20* labs assessments firmware/lessons/w1[7-9]* firmware/lessons/w20*
git commit -m "feat: teach MPU6050 and W25Q64 drivers"
```

### Task 7: Author Weeks 21–24, capstone, and final gate

**Files:**
- Create: week files `w21`–`w24`
- Create: labs `lab-w21-rtc-bkp`, `lab-w22-reliability-storage`, `lab-w23-capstone`, `lab-w24-final-practical`
- Create: assessments `assessment-w21`–`assessment-w24`, practical `gate-06`
- Create: firmware projects `w21-rtc-bkp`, `w22-pwr-wdg-flash`, `w23-capstone`
- Create: `curriculum/extensions/freertos.md`, `control.md`, `protocols.md`, `device-drivers.md`, `low-power.md`, `digital-logic-fpga-pla.md`

**Interfaces:**
- Produces: reliability/storage content, integrated project, final assessment, and transfer routes.

- [ ] **Step 1: Add failing final-phase and extension tests**

Require source IDs 41–49, RTC/BKP/PWR/IWDG/WWDG/FLASH/chip ID coverage, three build targets, capstone rubric, six extension files, and explicit `待实机验证` fields for power/current/reset observations.

- [ ] **Step 2: Author these outcomes**

| Week | Concepts | Minimum lab | Injected fault | Evidence |
|---|---|---|---|---|
| 21 | Unix time, UTC/local display, RTC clock/prescaler/counter, backup domain, reset vs power loss | set time, store initialization marker, verify reset persistence | skip RTC synchronization or wrong prescaler | counter/BKP automatic; true power-loss test manual |
| 22 | sleep/stop/standby, wake/reset sources, IWDG vs WWDG, FLASH erase/program/alignment, option-byte caution, chip ID | wake cycle, watchdog reset-cause log, reserved-page write/read, unique ID | feed watchdog incorrectly or write without erase/alignment | reset/ID/readback automatic; current measurement manual |
| 23 | requirements, state machine, sampling schedule, display, RTC timestamp, MPU/light/temp, W25Q64 log, USART health | build low-power environment/motion recorder with recoverable data format | disconnect one sensor, corrupt one record, force watchdog recovery | subsystem evidence plus manual system observation |
| 24 | architecture explanation, fault isolation, HAL→LL/register trace, SPL map, Git history/note quality, learning transfer | unseen fault practical and project defense | examiner-selected configuration/wiring/software fault | rubric evidence; no automatic pass from self-report |

Gate 6 requires phase average ≥75, all core prerequisite tags ≥70, practical ≥70, a working capstone evidence bundle, and a clear list of any still-pending physical tests.

- [ ] **Step 3: Generate reliability and capstone firmware**

Reserve the last explicitly configured FLASH page for tests and keep capstone settings in a different documented page. Record reset cause before clearing flags. Separate capstone modules into `Sensors`, `Storage`, `Clock`, `Display`, `Health`, and `App`, with a non-blocking top-level state machine. Do not introduce an RTOS.

- [ ] **Step 4: Author extension bridges with tag-based entry conditions**

Each extension file states: required mastered tags, why the next topic fits, one concrete starter project, what new concept is not yet mastered, and one authoritative source. `digital-logic-fpga-pla.md` maps GPIO/timing/state-machine/register knowledge to combinational logic, sequential logic, Verilog simulation, FPGA pins, and PLA product terms without claiming equivalence.

- [ ] **Step 5: Validate, build, and commit phase 6**

Run all three builds, `npm run validate:content -- --weeks 21-24`, focused web tests, and typecheck. Expected: the final four week pairs, reliability topics, capstone, and six extensions pass; the all-24 union waits for Task 8.

```powershell
git add curriculum/weeks/w2[1-4]* curriculum/extensions labs assessments firmware/lessons/w2[1-3]*
git commit -m "feat: complete reliability capstone and transfer curriculum"
```

### Task 8: Add common rubrics, note template, remediation modules, and firmware build matrix

**Files:**
- Create: `assessments/rubrics/common-rubric.md`
- Create: `docs/references/spl-to-hal-map.md`
- Create: `notes/templates/weekly-note.md`
- Create: `curriculum/remediation/*.md`
- Create: `firmware/projects.json`
- Create: `scripts/firmware/build-all.ps1`
- Create: `scripts/firmware/build-all.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: all content and firmware targets from Tasks 2–7.
- Produces: uniform learner evidence guidance and `npm run build:firmware`.

- [ ] **Step 1: Write failing matrix and source-map tests**

Test that `firmware/projects.json` lists exactly these 21 targets and that every target directory contains `.ioc`, `CMakePresets.json`, `CMakeLists.txt`, `Core`, and `App`. Also read the checked-in `curriculum/source-api-inventory.json` and fail when a unique non-empty `splSymbols` identifier has zero rows or more than one row in `docs/references/spl-to-hal-map.md`:

```text
w03-first-project, w04-gpio-output, w05-gpio-input, w06-oled-debug,
w07-exti-events, w08-tim-timebase, w09-pwm, w10-actuators,
w11-tim-measurement, w12-adc, w13-adc-dma, w14-usart,
w15-usart-packets, w16-i2c-mpu6050-id, w17-i2c-compare,
w18-mpu6050, w19-software-spi-w25q64, w20-hardware-spi-w25q64,
w21-rtc-bkp, w22-pwr-wdg-flash, w23-capstone
```

- [ ] **Step 2: Add the uniform evidence documents**

`common-rubric.md` defines observable anchors for 0/25/50/75/100 within each category and explains the 25/25/35/15 weighting. `weekly-note.md` contains YAML metadata and the seven export sections used by `toMarkdownNote`.

`docs/references/spl-to-hal-map.md` groups every SPL name appearing in source courses 06-1 through 49 by peripheral. Each row contains the SPL symbol, HAL/LL replacement or “直接寄存器概念”, required CubeMX setting, relevant register/flag, and a warning when behavior is not one-to-one. The validator extracts SPL-like identifiers from the source mapping inventory and fails if any identifier has no row.

The SPL map is derived only from the versioned `curriculum/source-api-inventory.json`: every unique non-empty `splSymbols` value has exactly one row, and the validator rejects missing or duplicate rows. This supersedes any attempt to scan unversioned source-course inputs at validation time.

Create remediation files for these exact action/tag families:

```text
concept-breakdown.md
signal-to-register-gpio-exti.md
signal-to-register-tim-adc-dma.md
shared-protocol-foundation.md
minimal-lab-wiring.md
prerequisite-electricity.md
prerequisite-binary-c.md
prerequisite-memory-map.md
watchdog-recovery.md
flash-safety.md
```

Each file contains a 20–40 minute goal, explanation, one tiny exercise, one check question, pass evidence, and return link to the failed tag.

- [ ] **Step 3: Implement a fail-fast PowerShell build runner**

Create `scripts/firmware/build-all.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$manifestPath = Join-Path $repoRoot 'firmware\projects.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

foreach ($project in $manifest.projects) {
  $source = Join-Path $repoRoot $project.path
  Push-Location $source
  try {
    & cmake --preset Debug
    if ($LASTEXITCODE -ne 0) { throw "配置失败：$($project.id)" }
    & cmake --build --preset Debug --parallel
    if ($LASTEXITCODE -ne 0) { throw "构建失败：$($project.id)" }
  } finally {
    Pop-Location
  }
}

Write-Output "固件构建通过：$($manifest.projects.Count) 个工程。"
```

Add `"build:firmware": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/firmware/build-all.ps1"` to `package.json`.

- [ ] **Step 4: Run the complete curriculum/firmware gate**

Run:

```powershell
npm run validate:content
npm test
npm run typecheck
npm run build
npm run build:firmware
git diff --check
```

Expected: content validator reports 24 weeks/46 sources/all core topics; all web tests pass; build runner prints `固件构建通过：21 个工程。`.

- [ ] **Step 5: Commit the complete curriculum gate**

```powershell
git add assessments/rubrics docs/references/spl-to-hal-map.md notes/templates curriculum/remediation firmware/projects.json scripts/firmware package.json
git commit -m "test: verify complete curriculum and firmware matrix"
```

## Curriculum and Firmware Acceptance

- [ ] All 24 week manifests and Markdown lessons pass the ten-heading contract.
- [ ] All 46 source IDs are mapped and no required peripheral lacks concept/lab/assessment/fault evidence.
- [ ] The versioned source API inventory has exactly 46 provenance-complete records, and every unique non-empty inventory SPL symbol has exactly one SPL-to-HAL map row.
- [ ] Every lesson and lab has automatic, semi-automatic, and manual `detectionChecks`; core hardware retains applicable device and manual paths, while simulator evidence never proves physical behavior.
- [ ] Each week assessment implements 25/25/35/15 evidence categories.
- [ ] Every four weeks has an integrated gate with the approved thresholds.
- [ ] All hardware labs have specific safety, wiring, observation, and recovery instructions.
- [ ] All 21 firmware targets configure and build with STM32CubeCLT/CMake/Ninja.
- [ ] Build success is never recorded as physical success.
- [ ] Capstone and six extension bridges are complete and contain no unclaimed mastery.
- [ ] `git status --short` is empty after the final commit.
