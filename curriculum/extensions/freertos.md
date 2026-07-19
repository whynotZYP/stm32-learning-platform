# FreeRTOS 路线

## 进入条件

已掌握标签（mastered tags）：`nvic.priority`、`tim.timebase`、`c.memory`、`wdg.recovery`、`system.integration`。能先用非阻塞状态机完成第 23 周项目，再学习任务调度，而不是用 RTOS 隐藏阻塞。

## 为什么适合继续学习

综合项目已有明确模块边界和 health 进展条件，适合比较裸机状态机与 task/queue/event 的成本。重点是并发正确性，不是“线程越多越高级”。

## 起步项目

把 Sensors、Storage、Display 分为三个 task，用 queue 传不可变 snapshot；Health task 只在三个阶段都有新 sequence 时喂 watchdog。保留同一记录格式和 host 测试作为回归基线。

## 尚未掌握

尚未掌握优先级反转、mutex inheritance、ISR-safe API、stack watermark、tickless idle、死锁分析和实时最坏响应时间；完成起步项目不等于掌握 RTOS。

## 权威资料

- [FreeRTOS official documentation](https://www.freertos.org/Documentation/RTOS_book.html)
- 访问日期：2026-07-20
