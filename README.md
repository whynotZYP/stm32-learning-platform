# STM32 系统学习平台

这是一个面向零基础学习者的 24 周 STM32F103 学习仓库。网页负责引导、记录、评分和补修，而 STM32CubeMX 与 VS Code 负责真实工程和调试。

## 本地查看

1. 安装 Node.js 22 或更高兼容版本。
2. 在仓库目录运行 `npm ci`。
3. 运行 `npm run dev`，打开终端给出的本地地址。

## 每次提交前

运行 `npm run validate:content`、`npm test`、`npm run typecheck` 和 `npm run build`。四项都通过才表示网页和课程结构没有已知错误；这不等于真实硬件已经验证。

详细环境说明见 [Windows 工具链说明](docs/setup/windows-toolchain.md)。

## 从哪里开始

- [第一次使用](docs/learner/getting-started.md)
- [每周学习循环](docs/learner/weekly-routine.md)
- [用 VS Code 保存学习笔记](docs/learner/github-notes.md)
- [网页进度备份与恢复](docs/learner/backup-restore.md)
- [网页连接开发板](docs/learner/device-connection.md)
- [故障排查与停止条件](docs/learner/troubleshooting.md)
- [平台设计与成功标准](docs/superpowers/specs/2026-07-19-stm32-learning-platform-design.md)
- [实板验证步骤与状态](docs/verification/hardware-smoke-test.md)
