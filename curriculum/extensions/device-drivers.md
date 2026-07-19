# 设备驱动路线

## 进入条件

已掌握标签（mastered tags）：`mcu.memory-map`、`c.memory`、`i2c.protocol`、`spi.protocol`、`i2c.mpu6050`、`spi.w25q64`。能区分纯逻辑、bus adapter 与具体器件驱动。

## 为什么适合继续学习

capstone 已有稳定 SensorsBus/StorageBus 边界和最小 MPU6050/W25Q64 HAL 适配，可进一步练习 probe、状态机、超时、并发访问和错误恢复。

## 起步项目

把 W25Q64 驱动扩展为读取 JEDEC ID、跨页写拆分、显式 sector erase、磨损统计和错误码；用 fake SPI bus 覆盖 busy timeout 与 readback mismatch。

## 尚未掌握

尚未掌握 DMA 驱动并发、cache coherency、Linux driver model、电源管理回调、热插拔和正式硬件兼容矩阵。一个器件能读写不等于通用驱动能力。

## 权威资料

- [Arm CMSIS-Driver specification](https://arm-software.github.io/CMSIS_6/latest/Driver/index.html)
- 访问日期：2026-07-20
