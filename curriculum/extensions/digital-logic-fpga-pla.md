# 数字逻辑、FPGA 与 PLA 路线

## 进入条件

已掌握标签（mastered tags）：`foundation.binary`、`gpio.output-mode`、`tim.timebase`、`spi.protocol`、`debug.observation`。这些只提供二进制、时序和接口直觉，与 FPGA/PLA 能力**不等价**。

## 为什么适合继续学习

MCU 软件按指令顺序执行；数字硬件并行工作。课程中的 bit、GPIO 和 timer 能帮助理解组合逻辑与时序逻辑，但不能等同为会写、综合和验证 Verilog。

## 起步项目

先用 Verilog 写带 testbench 的 debounce + event counter：组合逻辑负责 next-state，时序逻辑在 clock edge 更新寄存器。再部署到 FPGA，阅读 pin constraints，确认 FPGA 引脚电压与时钟约束后上板。

## 尚未掌握

尚未掌握 HDL 仿真、综合、timing closure、clock-domain crossing、metastability、FPGA 引脚约束与板级电气。PLA 以乘积项实现逻辑函数；PLA 乘积项优化也不能等同 FPGA LUT、寄存器和布线架构。

## 权威资料

- [IEEE 1800 SystemVerilog standard](https://standards.ieee.org/ieee/1800/7743/)
- [AMD Vivado Design Suite documentation](https://docs.amd.com/r/en-US/ug910-vivado-getting-started)
- 访问日期：2026-07-20
