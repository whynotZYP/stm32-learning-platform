# 开发板检测协议 v1

网页通过 CH340 与 STM32F103 检测固件通信。串口固定为 `115200 8N1`、UTF-8、每条 JSON 后跟换行符。每条不含换行符的内容最多 512 bytes；`id` 和 `test` 最多 64 个字符。浏览器同一时间只发送一个检测请求，开发板忙时必须明确拒绝第二个请求。

## 接线与边界

- USART1：PA9 TX 接 CH340 RX，PA10 RX 接 CH340 TX，并连接 GND。
- 只能使用 3.3 V TTL；开发板与 CH340 只选择一个供电来源。
- W25Q64 往返测试只能写入固件声明的固定测试扇区，必须先备份并在结束前恢复、复核。
- 片内 FLASH 往返测试只能写入链接脚本保留页，必须备份、恢复并复核。
- 模拟器消息会携带 `simulated: true`。模拟结果只能形成待确认记录，不能算作实机通过或课程掌握。

## 请求与响应

运行请求：

```json
{"v":1,"id":"req-42","type":"run","test":"spi.flash-id","params":{}}
```

进度消息：

```json
{"v":1,"id":"req-42","type":"progress","test":"spi.flash-id","step":"读取 JEDEC ID","percent":50}
```

成功或失败结果：

```json
{"v":1,"id":"req-42","type":"result","test":"spi.flash-id","status":"pass","details":{"jedecId":"EF4017"}}
```

结构化错误：

```json
{"v":1,"id":"req-42","type":"error","test":"spi.flash-id","code":"HARDWARE","message":"SPI 读取失败"}
```

每个最终 `result` 或 `error` 的 `id` 必须与请求一致。`details` 和 `params` 只允许有限长度的字符串、有限数值或布尔值；不接受嵌套对象。

## 错误码

| 错误码 | 含义 |
| --- | --- |
| `INVALID_REQUEST` | JSON 或字段不符合协议 |
| `UNSUPPORTED_VERSION` | `v` 不是 1 |
| `UNKNOWN_TEST` | 检测 ID 不在固件注册表 |
| `BUSY` | 已有一个检测正在运行 |
| `PRECONDITION` | 接线、器件或安全前提未满足 |
| `TIMEOUT` | 有界等待超时 |
| `HARDWARE` | 外设或恢复操作失败 |

浏览器解码器还会在本地日志中区分 `LINE_TOO_LONG`、`INVALID_JSON` 和 `INVALID_MESSAGE`。超长行会一直丢弃到下一个换行符，随后恢复解析，绝不执行残缺请求。

## v1 检测目录

```text
system.hello
system.chip-id
gpio.loopback
exti.event-count
tim.pwm-capture
adc.range-dma
dma.memory-copy
usart.packet
i2c.mpu6050-id
spi.flash-id
spi.flash-roundtrip
rtc.bkp
wdg.reset-cause
flash.reserved-page
pwr.sleep-wake
```

LED 亮度、蜂鸣器声音、舵机或电机动作、真实电流以及真正断电后的保持效果都不能由协议自动证明，必须由学习者单独观察并确认。
