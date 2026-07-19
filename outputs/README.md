# STM32 学习平台交付说明

## 交付文件

- `stm32-learning-platform.zip`：已经构建好的离线网页，可上传到 GitHub Pages 或其他静态网页托管服务。
- `device-test-v1.hex`：推荐用 STM32CubeProgrammer + ST-LINK 烧录的检测固件。
- `device-test-v1.bin`：需要指定地址时使用，STM32F103C8T6 的起始地址为 `0x08000000`。
- `device-test-v1.elf`：供 VS Code/GDB 调试使用。
- `stm32-learning-platform-verification.md`：逐项自动验收报告。
- `stm32-hardware-evidence.json`：真实开发板验证记录模板；当前诚实保留为待验证。

## 当前状态

课程、网页、离线使用、开发板通信模拟、21 个课程固件和检测固件已经通过自动验证。真实开发板检测由用户明确延期，因此实板项目继续标记为“待验证”，但不阻止本阶段以 GitHub 上传和网页发布为完成标准。

## 校验信息

- 构建源 commit：`7944b45`
- 网页 ZIP SHA-256：`d4fed74eca9709c6ebda9f5108cf773b940a3a542debd96d6a52cfa2862b5a59`
- ZIP 解压后共 8 个文件，已逐文件和本次通过浏览器测试的 `dist` 内容核对一致。

烧录和接线前请先阅读仓库中的 `docs/learner/device-connection.md` 与 `docs/verification/hardware-smoke-test.md`。模拟器结果只用于预演，不能替代真实开发板证据。
