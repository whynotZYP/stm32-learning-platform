# STM32F1 SPL 到 HAL / LL 迁移索引

本索引只读取仓库内版本化的 `curriculum/source-api-inventory.json`：该清单固定为 46 条记录，其中共有 109 个去重后的非空 SPL symbol。首列是机器校验键，每个 symbol 必须且只能出现一次；不要从未版本化的旧课程目录或网页正文补扫名字。

表中“HAL / LL 或寄存器概念”给出迁移入口，不表示可以机械替换。CubeMX 会生成时钟、GPIO 和外设初始化骨架；运行时顺序、清标志语义、阻塞方式和错误恢复仍需逐项核对参考手册。

## GPIO

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `GPIO_Exported_Types` | HAL GPIO 类型与 `GPIO_TypeDef` 寄存器视图 | 选择 GPIO 引脚功能 | CRL、CRH、IDR、ODR | 非 1:1：这是 SPL 类型集合，不是单个可替换 API。 |
| `GPIOSpeed_TypeDef` | `GPIO_InitTypeDef.Speed` 与 `GPIO_SPEED_FREQ_*` | 设置 Maximum output speed | CRL、CRH 的 MODE 位 | 非 1:1：HAL 速度枚举名称与 SPL 不同。 |
| `GPIOMode_TypeDef` | `GPIO_InitTypeDef.Mode` 与 `GPIO_MODE_*` | 设置 Input、Output 或 Alternate Function | CRL、CRH 的 MODE/CNF 位 | 非 1:1：HAL 把 EXTI 模式也并入 GPIO mode。 |
| `GPIO_InitTypeDef` | HAL 同名 `GPIO_InitTypeDef` | 配置 Pin、Mode、Pull、Speed | CRL、CRH、ODR | 非 1:1：HAL 增加 Pull 字段并改变枚举值。 |
| `BitAction` | `GPIO_PinState` | 无额外设置 | BSRR、BRR、ODR | 近似 1:1；枚举名改为 GPIO_PIN_RESET/SET。 |
| `GPIO_pins_define` | `GPIO_PIN_0` 至 `GPIO_PIN_15` | 选择目标引脚 | 位掩码对应单个 pin | 近似 1:1；不要把 pin 掩码当作 pin source 编号。 |
| `GPIO_Pin_sources` | `GPIO_PIN_SOURCE*` 或 LL pin source | EXTI 或 AF remap 时选择 pin source | AFIO EXTICR、MAPR | 非 1:1：普通 HAL GPIO 调用通常不直接需要该值。 |
| `GPIO_Port_Sources` | `GPIO_PORT_SOURCE_GPIO*` 或 AFIO 端口编码 | 选择 EXTI 端口映射 | AFIO EXTICR | 非 1:1：CubeMX 通常代为生成端口到 EXTI 的映射。 |
| `GPIO_DeInit` | `HAL_GPIO_DeInit` | 取消或重置对应引脚配置 | CRL、CRH、ODR | 近似 1:1；HAL 参数是 pin 掩码且不会替你关闭端口时钟。 |
| `GPIO_AFIODeInit` | `__HAL_RCC_AFIO_FORCE_RESET` / RELEASE_RESET | System Core 中检查 AFIO 与 remap | RCC APB2RSTR、AFIO MAPR | 非 1:1：复位整个 AFIO 会影响所有 EXTI/remap。 |
| `GPIO_Init` | `HAL_GPIO_Init` | 在 Pinout 中配置 mode/pull/speed | CRL、CRH、ODR | 近似 1:1；HAL 初始化结构字段不同。 |
| `GPIO_StructInit` | 显式初始化 `GPIO_InitTypeDef` 每个字段 | 由 CubeMX 生成确定值 | 无单独寄存器动作 | 非 1:1：HAL 没有等价 StructInit，不能依赖未初始化字段。 |
| `GPIO_ReadInputDataBit` | `HAL_GPIO_ReadPin` | 设置为输入或可读复用模式 | IDR | 近似 1:1；返回类型改为 GPIO_PinState。 |
| `GPIO_ReadInputData` | 直接读 `GPIOx->IDR` 或 `LL_GPIO_ReadInputPort` | 使能端口时钟并设置输入 | IDR | 非 1:1：HAL 没有整端口读取函数。 |
| `GPIO_ReadOutputDataBit` | 读 `GPIOx->ODR` 后掩码或 LL API | 设置为输出 | ODR | 非 1:1：HAL_GPIO_ReadPin 读取的是 IDR，不等价于输出锁存值。 |
| `GPIO_ReadOutputData` | 直接读 `GPIOx->ODR` 或 `LL_GPIO_ReadOutputPort` | 设置为输出 | ODR | 非 1:1：HAL 没有整端口输出锁存读取函数。 |
| `GPIO_SetBits` | `HAL_GPIO_WritePin(..., GPIO_PIN_SET)` | 设置为输出 | BSRR | 近似 1:1；用 BSRR 保持原子置位。 |
| `GPIO_ResetBits` | `HAL_GPIO_WritePin(..., GPIO_PIN_RESET)` | 设置为输出 | BRR 或 BSRR 高半字 | 近似 1:1；核对 HAL 对目标 F1 的复位写法。 |
| `GPIO_WriteBit` | `HAL_GPIO_WritePin` | 设置为输出 | BSRR、BRR | 近似 1:1；BitAction 改为 GPIO_PinState。 |
| `GPIO_Write` | `GPIOx->ODR = value` 或 `LL_GPIO_WriteOutputPort` | 设置整组引脚为输出 | ODR | 非 1:1：整端口写会同时覆盖其他引脚。 |
| `RCC_APB2PeriphClockCmd` | `__HAL_RCC_GPIOx_CLK_ENABLE` 等 RCC 宏 | CubeMX Clock Configuration 与外设启用 | RCC APB2ENR | 非 1:1：HAL 把每个外设拆成独立 enable/disable 宏。 |

## EXTI / NVIC

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `EXTI_ClearITPendingBit` | `__HAL_GPIO_EXTI_CLEAR_IT` | GPIO mode 选择 External Interrupt | EXTI PR | 近似 1:1；F1 通过写 1 清 pending，不能读改写。 |
| `EXTI_GetITStatus` | `__HAL_GPIO_EXTI_GET_IT` | 使能对应 EXTI line 与 NVIC IRQ | EXTI PR、IMR | 非 1:1：还要结合 IMR 判断是否为已使能中断。 |
| `EXTI_Init` | `HAL_GPIO_Init` 的 GPIO_MODE_IT_* 或 LL EXTI | 选择上升沿、下降沿或双边沿 | EXTI IMR、RTSR、FTSR | 非 1:1：HAL 把 EXTI 触发配置放进 GPIO 初始化。 |
| `GPIO_EXTILineConfig` | CubeMX 生成 AFIO EXTICR 映射或直接寄存器配置 | 将端口 pin 映射到 EXTI line | AFIO EXTICR1–4 | 非 1:1：同一 EXTI line 只能映射一个端口。 |
| `NVIC_Init` | `HAL_NVIC_SetPriority` 加 `HAL_NVIC_EnableIRQ` | NVIC Settings 中勾选 IRQ 并设优先级 | NVIC ISER、IPR | 非 1:1：SPL 一个结构调用拆为两个 HAL 调用。 |
| `NVIC_InitTypeDef` | IRQn、preempt priority、subpriority 参数 | NVIC Settings | NVIC ISER、IPR | 非 1:1：HAL 没有对应初始化结构。 |
| `NVIC_PriorityGroup` | `NVIC_PRIORITYGROUP_*` 常量 | System Core NVIC priority grouping | SCB AIRCR PRIGROUP | 非 1:1：编码名字和值需按 CMSIS/HAL 重新选择。 |
| `NVIC_PriorityGroupConfig` | `HAL_NVIC_SetPriorityGrouping` | System Core NVIC priority grouping | SCB AIRCR PRIGROUP | 近似 1:1；分组会改变全局抢占/子优先级解释。 |

## TIM 基础与 PWM

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `TIM_ClearFlag` | `__HAL_TIM_CLEAR_FLAG` | 选择计数模式与中断 | TIMx SR | 近似 1:1；不同标志的清除写法必须查 F1 手册。 |
| `TIM_Cmd` | `HAL_TIM_Base_Start/Stop` 或 `__HAL_TIM_ENABLE/DISABLE` | 启用对应 TIM 实例 | TIMx CR1 CEN | 非 1:1：HAL Start 还可能处理通道和状态。 |
| `TIM_ETRClockMode2Config` | `HAL_TIM_ConfigClockSource` 加 TIM_CLOCKSOURCE_ETRMODE2 | Clock Source 选择 ETR2 | TIMx SMCR ECE/ETPS/ETF | 非 1:1：极性、滤波和预分频拆到配置结构。 |
| `TIM_InternalClockConfig` | `HAL_TIM_ConfigClockSource` 加 TIM_CLOCKSOURCE_INTERNAL | Clock Source 选择 Internal Clock | TIMx SMCR SMS/ECE | 非 1:1：默认内部时钟时可能无需显式 HAL 调用。 |
| `TIM_ITConfig` | `HAL_TIM_Base_Start_IT` 或 `__HAL_TIM_ENABLE_IT` | NVIC Settings 勾选 TIM IRQ | TIMx DIER | 非 1:1：启用中断源不等于启动计数器。 |
| `TIM_TimeBaseInit` | `HAL_TIM_Base_Init` | Prescaler、Counter Period、Counter Mode | TIMx PSC、ARR、CR1、EGR | 近似 1:1；HAL 结构与时钟分频字段命名不同。 |
| `TIM_TimeBaseInitTypeDef` | `TIM_HandleTypeDef.Init` | TIM Parameter Settings | TIMx PSC、ARR、CR1 | 非 1:1：HAL 把实例和状态放入 handle。 |
| `TIM_OC1Init` | `HAL_TIM_PWM_ConfigChannel` 或 `HAL_TIM_OC_ConfigChannel` | Channel 1 选择 PWM/Output Compare | TIMx CCMR1、CCER、CCR1 | 非 1:1：配置通道后仍需单独 Start。 |
| `TIM_OCInitTypeDef` | `TIM_OC_InitTypeDef` | PWM Generation Channel 参数 | TIMx CCMR1、CCER、CCR1 | 近似 1:1；HAL 字段和值名称不同。 |
| `TIM_OCMode` | `TIM_OCMODE_*` | OC Mode 或 PWM mode 1/2 | TIMx CCMR1 OC1M | 非 1:1：枚举编码相近但名字和适用通道不同。 |
| `TIM_OCNPolarity` | `TIM_OCNPOLARITY_*` | Advanced Timer complementary output polarity | TIMx CCER CC1NP | 非 1:1：普通定时器没有互补输出。 |
| `TIM_OCPolarity` | `TIM_OCPOLARITY_*` | Output polarity High/Low | TIMx CCER CC1P | 近似 1:1；还要结合 GPIO 极性和外部驱动。 |
| `TIM_OutputNState` | `TIM_OUTPUTNSTATE_*` | Advanced Timer complementary channel | TIMx CCER CC1NE、BDTR MOE | 非 1:1：需要高级定时器和主输出使能。 |
| `TIM_OutputState` | `TIM_OUTPUTSTATE_*` | Output Compare channel enable | TIMx CCER CC1E | 非 1:1：HAL 通常在 Start 时使能输出。 |

## ADC

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `ADC_Cmd` | `HAL_ADC_Start/Stop` 或 `__HAL_ADC_ENABLE/DISABLE` | 启用 ADC 实例和通道 | ADCx CR2 ADON | 非 1:1：HAL Start 可能同时触发转换。 |
| `ADC_GetCalibrationStatus` | `HAL_ADCEx_Calibration_Start` 的返回结果或直接读位 | ADC Parameter Settings | ADCx CR2 CAL | 非 1:1：HAL 校准调用内部等待完成。 |
| `ADC_GetConversionValue` | `HAL_ADC_GetValue` | 配置 regular conversion | ADCx DR | 近似 1:1；读取时机仍要由 EOC 或 DMA 保证。 |
| `ADC_GetFlagStatus` | `__HAL_ADC_GET_FLAG` | 配置 EOC/AWD 等中断或轮询 | ADCx SR EOC、AWD、JEOC | 近似 1:1；标志宏和清除时序不同。 |
| `ADC_GetResetCalibrationStatus` | 直接读 ADC CR2 RSTCAL 或使用 HAL 校准流程 | ADC 初始化后校准 | ADCx CR2 RSTCAL | 非 1:1：HAL 不公开独立 reset-calibration 状态函数。 |
| `ADC_Init` | `HAL_ADC_Init` | Scan、Continuous、Alignment、Trigger | ADCx CR1、CR2、SQR1 | 近似 1:1；通道配置由另一 HAL 调用完成。 |
| `ADC_InitTypeDef` | `ADC_HandleTypeDef.Init` | ADC Parameter Settings | ADCx CR1、CR2、SQR1 | 非 1:1：字段拆分和枚举名称不同。 |
| `ADC_RegularChannelConfig` | `HAL_ADC_ConfigChannel` | Rank、Channel、Sampling Time | ADCx SQR1–3、SMPR1–2 | 近似 1:1；HAL 每次配置一个 rank。 |
| `ADC_ResetCalibration` | `HAL_ADCEx_Calibration_Start` 或直接 RSTCAL 位流程 | 初始化后执行校准 | ADCx CR2 RSTCAL | 非 1:1：HAL 合并 reset 与 start calibration。 |
| `ADC_SoftwareStartConvCmd` | `HAL_ADC_Start` | External Trigger 选择 Software Start | ADCx CR2 SWSTART/EXTTRIG | 非 1:1：HAL Start 同时处理 enable 和状态。 |
| `ADC_StartCalibration` | `HAL_ADCEx_Calibration_Start` | 启动 ADC 前完成校准 | ADCx CR2 CAL | 非 1:1：HAL 为阻塞调用并返回状态。 |
| `RCC_ADCCLKConfig` | CubeMX ADC prescaler 或直接 RCC CFGR ADCPRE | Clock Configuration 设置 ADC clock | RCC CFGR ADCPRE | 非 1:1：HAL 通常由生成代码统一配置 RCC。 |

## DMA

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `DMA_ClearFlag` | `__HAL_DMA_CLEAR_FLAG` | DMA request 与 IRQ 设置 | DMA ISR、IFCR | 近似 1:1；通道到 flag 的宏映射不同。 |
| `DMA_Cmd` | `HAL_DMA_Start/Abort` 或 `__HAL_DMA_ENABLE/DISABLE` | 为外设添加 DMA channel | DMA_CCR EN | 非 1:1：HAL Start 还写地址和计数。 |
| `DMA_GetFlagStatus` | `__HAL_DMA_GET_FLAG` | DMA IRQ 或轮询模式 | DMA ISR TCIF、HTIF、TEIF | 近似 1:1；必须使用与 handle 通道匹配的 flag 宏。 |
| `DMA_Init` | `HAL_DMA_Init` | Direction、Mode、Priority、Data Width | DMA_CCR、CPAR、CMAR、CNDTR | 近似 1:1；HAL 使用 DMA handle 并由外设 handle 链接。 |
| `DMA_InitTypeDef` | `DMA_HandleTypeDef.Init` | DMA Settings | DMA_CCR | 非 1:1：HAL 增加 Instance 和运行状态。 |
| `DMA_SetCurrDataCounter` | `__HAL_DMA_SET_COUNTER`，先禁用通道 | Normal/Circular 与 buffer length | DMA_CNDTR | 非 1:1：运行中修改计数可能被硬件拒绝或产生竞态。 |

## USART

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `USART_Cmd` | `__HAL_UART_ENABLE/DISABLE` 或 HAL UART init/deinit | 选择 USART mode、pins、clock | USARTx CR1 UE | 非 1:1：HAL 通常在 Init 中启用外设。 |
| `USART_Init` | `HAL_UART_Init` | Baud、Word Length、Parity、Stop Bits、Mode | USARTx BRR、CR1、CR2、CR3 | 近似 1:1；同步 USART 特性需 HAL_USART 而非 HAL_UART。 |
| `USART_InitTypeDef` | `UART_HandleTypeDef.Init` 或 `USART_HandleTypeDef.Init` | USART Parameter Settings | USARTx BRR、CR1、CR2、CR3 | 非 1:1：需按异步/同步模式选择 HAL handle。 |
| `USART_ReceiveData` | `HAL_UART_Receive`、IT/DMA 接收或直接读 DR | 使能 RX、IRQ 或 DMA | USARTx SR RXNE/ORE、DR | 非 1:1：HAL API 包含超时和状态机；读 SR/DR 清错顺序重要。 |
| `USART_SendData` | `HAL_UART_Transmit`、IT/DMA 发送或直接写 DR | 使能 TX、IRQ 或 DMA | USARTx SR TXE/TC、DR | 非 1:1：阻塞 HAL 发送不是单次寄存器写。 |

## I2C

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `I2C_AcknowledgeConfig` | `HAL_I2C_Master_Receive` 内部 ACK 流程或直接 CR1 ACK | Addressing Mode 与接收长度 | I2Cx CR1 ACK/POS | 非 1:1：HAL 按传输长度管理最后字节 ACK，勿中途机械切换。 |
| `I2C_CheckEvent` | HAL 返回状态加 `HAL_I2C_GetError`，或直接读 SR1/SR2 | I2C IRQ 或轮询 | I2Cx SR1、SR2 | 非 1:1：HAL 不提供 SPL 的组合 event 常量。 |
| `I2C_Cmd` | `__HAL_I2C_ENABLE/DISABLE` 或 HAL init/deinit | 启用 I2C 实例 | I2Cx CR1 PE | 非 1:1：HAL 通常在 Init 中启用。 |
| `I2C_GenerateSTART` | `HAL_I2C_Master_Transmit/Receive` 或 LL START | Master mode 与目标地址 | I2Cx CR1 START、SR1 SB | 非 1:1：HAL 把整个事务合并，不暴露独立 START 步骤。 |
| `I2C_GenerateSTOP` | HAL 事务完成或 LL STOP | Master mode | I2Cx CR1 STOP | 非 1:1：错误路径和多字节接收的 STOP 时序敏感。 |
| `I2C_Init` | `HAL_I2C_Init` | Clock Speed、Duty Cycle、Addressing Mode | I2Cx CR2、CCR、TRISE、OAR1 | 近似 1:1；HAL handle 还保存错误与状态。 |
| `I2C_InitTypeDef` | `I2C_HandleTypeDef.Init` | I2C Parameter Settings | I2Cx CR2、CCR、TRISE、OAR1 | 非 1:1：字段名称和 own-address 处理不同。 |
| `I2C_ReceiveData` | `HAL_I2C_Master_Receive/Mem_Read` 或直接读 DR | 选择 master receive 或 memory read | I2Cx DR、SR1 RXNE/BTF | 非 1:1：HAL 调用管理完整事务和超时。 |
| `I2C_Send7bitAddress` | HAL 调用传入 `address << 1`，或 LL 地址阶段 | 配置 7-bit addressing | I2Cx DR、SR1 ADDR、SR2 TRA | 非 1:1：STM32 HAL 参数使用左移后的地址格式。 |
| `I2C_SendData` | `HAL_I2C_Master_Transmit/Mem_Write` 或直接写 DR | 选择 master transmit 或 memory write | I2Cx DR、SR1 TXE/BTF | 非 1:1：HAL 发送缓冲区而非单字节寄存器动作。 |

## SPI

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `SPI_Cmd` | `__HAL_SPI_ENABLE/DISABLE` 或 HAL init/deinit | Master/Slave、Full Duplex 等模式 | SPIx CR1 SPE | 非 1:1：HAL 传输函数可能自动管理 enable。 |
| `SPI_I2S_ClearFlag` | `__HAL_SPI_CLEAR_*FLAG` 或规定的 SR/DR 读写序列 | 配置错误 IRQ 或轮询 | SPIx SR OVR、MODF、CRCERR | 非 1:1：不同错误标志有不同清除序列。 |
| `SPI_I2S_GetFlagStatus` | `__HAL_SPI_GET_FLAG` | 配置 SPI IRQ 或轮询 | SPIx SR TXE、RXNE、BSY、OVR | 近似 1:1；HAL 宏名称按 SPI flag 定义。 |
| `SPI_I2S_ReceiveData` | `HAL_SPI_Receive/TransmitReceive` 或读 DR | Data Size、Direction、NSS | SPIx DR、SR RXNE | 非 1:1：只接收时主机仍需产生时钟。 |
| `SPI_I2S_SendData` | `HAL_SPI_Transmit/TransmitReceive` 或写 DR | Baud Rate、CPOL、CPHA、Bit Order | SPIx DR、SR TXE/BSY | 非 1:1：写入完成不等于总线 BSY 已清。 |
| `SPI_Init` | `HAL_SPI_Init` | Mode、Direction、Data Size、CPOL/CPHA、NSS | SPIx CR1、CR2 | 近似 1:1；HAL handle 还维护锁与错误状态。 |
| `SPI_InitTypeDef` | `SPI_HandleTypeDef.Init` | SPI Parameter Settings | SPIx CR1、CR2 | 非 1:1：字段名称和值迁移后需逐项核对。 |

## RTC / BKP / PWR

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `BKP_ReadBackupRegister` | `HAL_RTCEx_BKUPRead` | RTC Backup Registers 与 backup domain | BKP DR1–DR10 | 近似 1:1；寄存器索引宏名称不同。 |
| `BKP_WriteBackupRegister` | `HAL_RTCEx_BKUPWrite` | 先允许 backup domain 写访问 | BKP DR1–DR10 | 近似 1:1；必须先设置 DBP 且注意复位域。 |
| `PWR_BackupAccessCmd` | `HAL_PWR_EnableBkUpAccess/DisableBkUpAccess` | RCC RTC 与 PWR clock | PWR CR DBP | 近似 1:1；写保护解除需要 PWR 时钟。 |
| `RCC_GetFlagStatus` | `__HAL_RCC_GET_FLAG` | Reset and Clock Configuration | RCC CSR、BDCR、CR | 非 1:1：RTC、复位和看门狗标志共享该入口，清除方法不同。 |
| `RCC_LSEConfig` | `__HAL_RCC_LSE_CONFIG` 或 `HAL_RCC_OscConfig` | RTC Clock Source 选择 LSE | RCC BDCR LSEON/LSERDY | 非 1:1：启动晶振需要等待 ready 并处理超时。 |
| `RCC_RTCCLKCmd` | `__HAL_RCC_RTC_ENABLE/DISABLE` | 启用 RTC clock | RCC BDCR RTCEN | 近似 1:1；不要误复位整个 backup domain。 |
| `RCC_RTCCLKConfig` | `__HAL_RCC_RTC_CONFIG` 或 `HAL_RCCEx_PeriphCLKConfig` | RTC Clock Source 选择 LSE/LSI/HSE | RCC BDCR RTCSEL | 非 1:1：更换时钟源常需 backup domain reset。 |
| `RTC_GetCounter` | `HAL_RTC_GetTime/GetDate` 或直接读取 F1 RTC CNT | 启用 RTC 并设置 time/date | RTC CNTH、CNTL | 非 1:1：HAL 使用 BCD time/date 结构，不直接暴露秒计数器语义。 |
| `RTC_SetCounter` | `HAL_RTC_SetTime/SetDate` 或直接配置 F1 RTC CNT | 设置初始 time/date | RTC CNTH、CNTL、CRL CNF | 非 1:1：时区、日期和同步必须由应用定义。 |
| `RTC_SetPrescaler` | `HAL_RTC_Init` 的 AsynchPrediv/SynchPrediv 或直接 PRL | 配置 RTC prescaler | RTC PRLH、PRLL | 非 1:1：不同 STM32 RTC 架构的 prescaler 模型不同。 |
| `RTC_WaitForLastTask` | HAL 状态/超时或等待 RTC CRL RTOFF | RTC 初始化与写操作 | RTC CRL RTOFF | 非 1:1：必须有超时，不能无限等待硬件。 |
| `RTC_WaitForSynchro` | `HAL_RTC_WaitForSynchro` | RTC 时钟源和同步 | RTC CRL RSF | 近似 1:1；调用前后的 RSF 清除顺序要核对。 |

## IWDG / WWDG

| SPL symbol | HAL / LL 或直接寄存器概念 | CubeMX 设置 | 寄存器 / 标志 | 非 1:1 警告 |
| --- | --- | --- | --- | --- |
| `IWDG_Enable` | `HAL_IWDG_Init` 后硬件启动 | IWDG prescaler 与 reload | IWDG KR、PR、RLR | 非 1:1：IWDG 启动后通常不能停止。 |
| `IWDG_GetFlagStatus` | 直接读 IWDG SR 或 LL flag | IWDG 参数 | IWDG SR PVU/RVU | 非 1:1：HAL 没有通用 get-flag API。 |
| `IWDG_ReloadCounter` | `HAL_IWDG_Refresh` | 设置合理 watchdog timeout | IWDG KR reload key | 近似 1:1；只能在全部关键任务健康后调用。 |
| `IWDG_SetPrescaler` | `IWDG_HandleTypeDef.Init.Prescaler` 后 `HAL_IWDG_Init` | IWDG Prescaler | IWDG PR | 非 1:1：HAL 统一在 Init 写入，更新期间有状态位。 |
| `IWDG_SetReload` | `IWDG_HandleTypeDef.Init.Reload` 后 `HAL_IWDG_Init` | IWDG Reload | IWDG RLR | 非 1:1：reload 范围与 LSI 偏差决定真实超时。 |
| `IWDG_WriteAccessCmd` | HAL init 内部解锁或直接写 IWDG KR | IWDG 参数 | IWDG KR write-access key | 非 1:1：HAL 不要求应用单独控制写访问。 |
| `WWDG_ClearFlag` | `__HAL_WWDG_CLEAR_FLAG` | WWDG Early Wakeup Interrupt | WWDG SR EWIF | 近似 1:1；写 0 清除语义需使用目标宏。 |
| `WWDG_DeInit` | `HAL_WWDG_DeInit` 或外设复位 | WWDG 配置 | RCC APB1RSTR、WWDG CR/CFR | 非 1:1：运行中的窗口看门狗不一定可安全停止。 |
| `WWDG_Enable` | `HAL_WWDG_Init` 并启动计数 | WWDG Counter、Window、Prescaler | WWDG CR WDGA/T | 非 1:1：HAL Init 同时配置并启动。 |
| `WWDG_EnableIT` | `HAL_WWDG_Init` 配合 EWI 与 IRQ | NVIC Settings 启用 WWDG IRQ | WWDG CFR EWI、SR EWIF | 非 1:1：还要实现 HAL_WWDG_EarlyWakeupCallback。 |
| `WWDG_GetFlagStatus` | `__HAL_WWDG_GET_FLAG` | WWDG EWI | WWDG SR EWIF | 近似 1:1；只有早期唤醒标志可查。 |
| `WWDG_SetCounter` | `HAL_WWDG_Refresh` | Counter 初值 | WWDG CR T | 非 1:1：窗口打开前刷新会立即复位。 |
| `WWDG_SetPrescaler` | `WWDG_HandleTypeDef.Init.Prescaler` 后 `HAL_WWDG_Init` | WWDG Prescaler | WWDG CFR WDGTB | 非 1:1：运行期改 prescaler 不等价于重新初始化。 |
| `WWDG_SetWindowValue` | `WWDG_HandleTypeDef.Init.Window` 后 `HAL_WWDG_Init` | WWDG Window | WWDG CFR W | 非 1:1：window 与 counter 共同决定允许刷新区间。 |
