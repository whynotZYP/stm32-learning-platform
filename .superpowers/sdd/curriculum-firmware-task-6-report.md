# Task 6 验证报告

## 交付范围

- 第 17–20 周课程页、课程元数据、题库、实验清单与 Gate 05。
- 四个可独立生成 ELF 的 STM32CubeMX/CMake 工程：软件/硬件 I2C 对比、MPU6050、软件 SPI W25Q64、硬件 SPI2 W25Q64。
- 可移植主机 C 行为测试和 Phase 05 内容验证；Linux/Windows CI 均执行这些测试。
- W25Q64 公共生产模块集中实现固定测试扇区、边界检查、备份、测试、整扇区恢复及恢复后回读。

## TDD 记录

- RED：先加入 Phase 05 内容/工程测试；四周文件尚不存在时，6 项测试全部按预期失败。
- GREEN：实现课程、清单、工程和生产模块后，同一测试 6/6 通过。
- 主机 C 测试直接编译生产模块，而不是复制一套仅供测试的实现。
- 变异验证：把固定测试地址从 `0x007FF000` 改为 `0` 时，主机测试会失败。

## 关键行为证据

- 第 17 周软件 I2C 只提供“拉低/释放”操作，不主动推高总线；错误分为 timeout、NACK、bus-stuck。恢复先释放 SDA，再固定发 9 个完整 SCL 脉冲和 STOP，随后明确重试一次。测试覆盖“首次 bus-stuck、恢复成功、重试 NACK”，证明恢复成功不会被误报成 WHO_AM_I 读取成功。
- 软件 I2C 使用 DWT cycle counter 形成约 5 us 的半周期，并将约 10 ms 的 SCL stretch deadline 换算为 cycle ticks；硬件 I2C HAL 读取也使用 10 ms 有界等待。
- 第 18 周先将高低字节组合为无符号 `uint16_t`，再转换为 `int16_t`；测试覆盖 `0x7FFF`、`0x8000`、`0xFFFF`，并覆盖量程、bias、限幅和有界滤波。
- W25Q64 状态轮询使用 `HAL_GetTick` 对应的毫秒时钟和 wrap-safe 差值；页编程期限 10 ms、扇区擦除期限 500 ms。fake bus 每次状态读取推进虚拟时钟，测试同时覆盖 ready 和持续 busy 超时，未用固定次数冒充真实 deadline。
- 两个 W25 工程在 `App_Init` 读取 JEDEC ID 后立即校验，只接受 `EF4017`，不匹配时明确记录 `W25Q64_RESULT_ID`；固定扇区测试入口也再次校验。对应 RED 测试曾因缺少共享 ID 判断函数和 App 初始化检查而失败，修复后主机与静态内容断言通过。
- 两个 W25 工程在写前执行 WREN/WEL 检查；软件 SPI 和 SPI2 都在整个 command/address/data transaction 期间保持 CS 为低。
- 破坏性测试地址固定为 `0x007FF000`。流程保存完整 4 KiB，测试 256 B page，随后恢复全部 16 页并逐页回读；只要破坏性命令可能已执行，后续失败仍强制恢复，恢复失败就是最终失败。
- 没有 chip erase、mass erase、bootloader、网页输入地址或上电自动擦写入口；HAL 等待均有界，应用未使用 `HAL_Delay`。

## 验证命令与结果

```powershell
npm run validate:content -- --weeks 17-20
npx vitest run scripts/content-validation/phase-05-content.test.ts
npm test
npm run typecheck
npx vite build --config web/vite.config.ts
cmake --fresh --preset Debug
cmake --build --preset Debug
git diff --check
```

- 指定周内容验证通过。
- Phase 05：1 个测试文件、6 项测试全部通过，其中主机 C 行为测试由当前平台可用的 C 编译器执行。
- 全量测试：27 个测试文件、252 项测试全部通过。
- TypeScript 类型检查通过；Vite 构建成功，共转换 133 个模块。
- 四个工程均从 fresh CMake 配置重新生成并成功链接 ELF：
  - w17：RAM 1672 B / 20 KiB，FLASH 10932 B，ELF 文件 733536 B。
  - w18：RAM 1760 B / 20 KiB，FLASH 10180 B，ELF 文件 729472 B。
  - w19：RAM 5728 B / 20 KiB，FLASH 7372 B，ELF 文件 696540 B。
  - w20：RAM 5800 B / 20 KiB，FLASH 8676 B，ELF 文件 729968 B。
- 空白检查通过。

## 独立审查修复

- RED：严格顺序测试先以 `fake.sda_release_count == 2U` 失败，证明原恢复函数没有在首个 SCL 脉冲前释放 SDA。
- 根因：`WriteByte(0x00)` 在 SCL stretch 超时时，主机仍可能主动拉低 SDA；紧接着的失败 STOP 也可能来不及释放 SDA，因此恢复流程会从无效总线状态开始。
- 修复：恢复 API 自身首先释放 SDA；主机 fake 分离“主机释放 SDA”和“从机保持 SDA 为低”，并记录事件序列，严格断言“释放 SDA → 9 个完整 SCL 脉冲 → STOP”。
- GREEN：Phase 05 的 6/6 测试通过，固定扇区变异测试通过；“恢复成功但重试 NACK”仍返回 NACK，没有误报成功。

## 实机状态与诚实证据

本任务没有连接开发板、MPU6050 或 W25Q64 实物，因此不声称实机通过。自动测试证明可移植逻辑、边界、安全恢复与工程可构建；真实 I2C/SPI 波形、JEDEC ID、传感器读数和 Flash 写后恢复结果均标记为“待实机验证”。

## Commit

`feat: teach MPU6050 and W25Q64 drivers`

`fix: release SDA before I2C recovery`
