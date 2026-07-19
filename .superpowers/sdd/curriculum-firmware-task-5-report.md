# Task 5 验证报告：DMA、USART、数据包与 I2C 基础

## 状态与范围

- 状态：DONE
- 基线：`3dcbb712cae3ad2a85ae64653ff56c820b276007`
- 范围：仅新增第 13–16 周课程、实验、题库、Gate 04、四个 STM32CubeMX/HAL 固件项目，以及执行这些项目中纯 C 生产模块的主机测试。
- 未修改 Phase 3 文件，也未加入后续第 17–24 周内容。

## 已交付内容

- Week 13：ADC 多通道扫描、循环 DMA、半传输/全传输回调与稳定快照。
- Week 14：USART1 115200 8N1、中断接收、环形队列、错误/ORE 恢复、重启接收失败计数。
- Week 15：分包状态机、部分包、粘包、校验和、超时、超长、丢包后恢复；中断只入队，主循环解析。
- Week 16：I2C1 100 kHz、MPU6050 `WHO_AM_I` 读取、7-bit/HAL 地址区分以及超时、总线错误、错误 ID 分类。
- 四个真实 CubeMX/HAL 工程：`w13-adc-dma`、`w14-usart`、`w15-usart-packets`、`w16-i2c-mpu6050-id`。

## TDD 与 mutation 证据

- 初始内容测试 RED：Phase 4 文件缺失，6 项失败。
- 初始主机测试 RED：生产源文件缺失，测试被阻断。
- 首轮 GREEN：15 项生产 C 行为测试通过。
- 数据包恢复补测 RED：超时遇到新 SOF、超长后新 SOF 两项失败；修复状态机后 GREEN。
- USART 可观察性补测 RED：静态门禁发现 W14/W15 无法观察接收重启失败；加入 `rearm_failure_count` 后 GREEN。
- mutation RED：先编译未修改的 `packet_parser.c` 副本并运行坏校验和 case，变体可存活，测试按预期失败（16 通过、1 失败）。
- mutation GREEN：临时复制生产 `packet_parser.c`，把 checksum 拒绝判定从 `!= 0U` 翻转为 `== 0U`；使用同一生产 headers、同一 harness 重新编译并执行 case 7，变异可执行文件返回非零，17 项主机测试全部通过。测试不是文本断言，而是真实编译和执行变异代码。

## CubeMX 与固件验证

- 使用 STM32CubeMX batch 模式分别重新生成四个工程，日志均返回 `project generate ... OK`。
- 四个工程使用 STM32CubeCLT CMake Debug preset 全新配置、编译和链接成功。
- ELF 尺寸：
  - W13：Flash 10636 B，RAM 1840 B。
  - W14：Flash 9168 B，RAM 1744 B。
  - W15：Flash 9756 B，RAM 1784 B。
  - W16：Flash 8284 B，RAM 1672 B。
- CMake 仅提示 Windows 路径较长，没有编译或链接错误。

## 自动验证

- `npm run validate:content -- --weeks 13-16`：通过。
- `npm test`：28 个测试文件、268 项测试全部通过，其中 Phase 4 主机测试 17 项。
- `npm run typecheck`：通过。
- `npx vite build --config web/vite.config.ts`：通过，133 个模块完成构建。
- `git diff --check`：通过。
- 不带周范围的 `npm run validate:content` 仍会报告第 17–24 周及后续 SPI/RTC/PWR/WDG/FLASH 内容缺失；这些属于后续任务，不是 Task 5 回归。Task 5 的范围门禁已通过。

## 实机边界与 concerns

- 没有虚构开发板实测结果。ADC 引脚采样、USART 线缆回环、I2C 上拉与 MPU6050 实物通信仍需在真实硬件上完成半自动/人工证据采集。
- 主机测试优先使用 `HOST_CC`，否则查找 `clang`、`gcc`、`cc`；本机验证通过未跟踪的 TinyCC 执行，CI/Linux 可使用标准 clang/gcc/cc。
- 生产代码审查发现并修复了 USART 重启接收失败不可观察的问题；最终风险主要是尚未进行实机电气与时序验证。

## 独立复核后的修正

- Windows 不再回退到只能生成 ARM 目标的 `starm-clang`；候选编译器必须先编译并实际运行一个本机探针，显式无效的 `HOST_CC` 会直接失败，禁止静默跳过主机测试。
- CI 增加 Ubuntu/GCC 与 Windows/Clang 两条 Phase 4 host-C 门禁。
- W14/W15 的中断共享重挂接失败计数改为 `volatile`。
- W15 队列用例现在链接 W15 自己的 `usart_rx.c` 生产对象。
- 修正后 focused 26/26、全量 28 个文件 271 项测试通过；四个工程再次 fresh 构建成功。

## Commit

`feat: teach DMA USART packets and I2C basics`
