# 网页连接开发板

Web Serial 是 Chrome/Edge 提供的串口连接能力。网页只能在你点击按钮后申请权限；刷新、断线或睡眠唤醒后可能需要重新授权。

## 烧录检测固件

运行 `npm run build:device-firmware`，然后用 STM32CubeProgrammer 和 ST-LINK 烧录 `firmware/device-test-v1/build/Debug/device-test-v1.hex`。构建通过只表示代码能变成固件，不代表硬件检测已经通过。

## 串口接线

- PA9（STM32 TX）接 CH340 RX。
- PA10（STM32 RX）接 CH340 TX。
- 两边 GND 相连。
- CH340 必须使用 3.3 V TTL；开发板与转接板只选一个供电来源。

断电完成接线，确认无短路后再上电。详细消息格式见 [开发板检测协议](../device/protocol-v1.md)。

## 网页操作

1. 用最新版 Chrome 或 Edge 打开“开发板检测”。
2. 逐项勾选四个“连接前安全确认”，点“连接开发板”，在浏览器窗口选择 CH340 串口。
3. 先运行“检测固件握手”，必须看到 `device-test-v1`；再运行芯片 ID 和需要的外设项目。
4. GPIO 回环、PWM 捕获、MPU6050 和 W25Q64 必须按卡片说明断电接线。收到 `PRECONDITION` 表示前提未满足，不是通过。
5. 半自动项目还要勾选并保存亲眼观察的现象。

“使用模拟器”用于体验通过、失败、超时和断线界面，即使显示通过也只会留下待确认记录。浏览器不支持串口时，可使用“人工观察记录”；没有设备数值的项目仍保持待实机验证。
