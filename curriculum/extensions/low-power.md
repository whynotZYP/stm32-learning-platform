# 低功耗系统路线

## 进入条件

已掌握标签（mastered tags）：`rtc.time`、`pwr.low-power`、`exti.event-flow`、`wdg.recovery`、`flash.persistence`。能解释 Sleep/Stop/Standby、唤醒标志和 Stop 后时钟恢复。

## 为什么适合继续学习

第 22 周建立了显式请求和证据边界，可继续从“能进入模式”走向能量预算、唤醒延迟、外设关断顺序与长期可靠性。

## 起步项目

让记录器每分钟 RTC 唤醒，采样一次后 Stop；分别记录运行时间、睡眠时间、平均电流和失败唤醒。所有电流结论必须来自真实仪表。

## 尚未掌握

尚未掌握板级漏电、外设反向供电、动态电压频率、tickless RTOS、电池模型和温度影响。代码进入 Stop 不能等同系统已经低功耗。

## 权威资料

- [ST AN2821: STM32F101/103 low-power modes](https://www.st.com/resource/en/application_note/cd00221665-lowpower-modes-and-power-consumption-on-stm32f101xx-and-stm32f103xx-stmicroelectronics.pdf)
- 访问日期：2026-07-20
