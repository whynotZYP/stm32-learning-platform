# STM32 系统学习平台

这是一个面向零基础学习者的 24 周 STM32F103 学习仓库。网页负责引导、记录、评分和补修，而 STM32CubeMX 与 VS Code 负责真实工程和调试。

## 本地查看

1. 安装 Node.js 22 或更高兼容版本。
2. 在仓库目录运行 `npm ci`。
3. 运行 `npm run dev`，打开终端给出的本地地址。

## 每次提交前

运行 `npm run validate:content`、`npm test`、`npm run typecheck` 和 `npm run build`。四项都通过才表示网页和课程结构没有已知错误；这不等于真实硬件已经验证。

详细环境说明见 `docs/setup/windows-toolchain.md`。
