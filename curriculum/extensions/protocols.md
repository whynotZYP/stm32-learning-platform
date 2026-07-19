# 通信协议路线

## 进入条件

已掌握标签（mastered tags）：`usart.physical-frame`、`usart.packet`、`i2c.protocol`、`spi.protocol`、`debug.observation`。能把电气帧、分包、校验和状态机分层。

## 为什么适合继续学习

课程已有串口包和两种板级总线，可继续研究 framing、retransmission、idempotency、versioning 与流量控制，并把错误注入做成可重复测试。

## 起步项目

给数据记录器增加版本化串口命令：查询 health、读取指定日志、确认 ACK/NACK；用 length、CRC、timeout 和 sequence number 处理半包、重复包与损坏包。

## 尚未掌握

尚未掌握 TCP/IP、CAN 仲裁、Modbus 互操作、安全认证、拥塞控制和协议形式化验证。自定义串口包不能声称兼容工业协议。

## 权威资料

- [IETF RFC 9293: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293.html)
- 访问日期：2026-07-20
