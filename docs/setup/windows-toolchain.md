# Windows 开发环境

## 这套工具各自做什么？

- STM32CubeMX：用图形界面选择芯片、引脚、时钟和外设，然后生成工程。
- VS Code：编辑、构建、下载和调试代码。
- STM32CubeCLT：提供编译器、CMake、Ninja、烧录器和调试服务。

## 当前电脑已验证的位置

- STM32CubeMX：`F:\stm\mx\STM32CubeMX.exe`
- STM32CubeCLT：`F:\stm\STM32CubeCLT_1.22.0`
- VS Code 扩展：`stmicroelectronics.stm32-vscode-extension-3.9.0`

## 首次检查

在 VS Code 终端依次运行 `arm-none-eabi-gcc --version`、`cmake --version` 和 `ninja --version`。三个命令都显示版本后再进入第 3 周工程；命令找不到时先重启 VS Code，让新环境变量生效。
