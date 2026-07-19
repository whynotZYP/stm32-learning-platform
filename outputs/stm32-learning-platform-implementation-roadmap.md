# STM32 学习平台实施路线

完整平台按依赖关系拆成五份可独立验证的计划，共 34 个任务。必须按顺序执行：前一份的测试结果是后一份的输入。

1. [仓库骨架、内容契约与验证器](../docs/superpowers/plans/2026-07-19-stm32-platform-foundation.md)
2. [学习网页、进度、评分、补修、笔记与备份](../docs/superpowers/plans/2026-07-19-stm32-learning-core.md)
3. [24 周课程、46 份源课程映射与 21 个 STM32 实验工程](../docs/superpowers/plans/2026-07-19-stm32-curriculum-firmware.md)
4. [Web Serial 开发板检测台、模拟器与检测固件](../docs/superpowers/plans/2026-07-19-stm32-device-console.md)
5. [离线使用、GitHub Pages、完整性审计与实机验收](../docs/superpowers/plans/2026-07-19-stm32-release-verification.md)

[查看跨计划设计覆盖矩阵](../docs/superpowers/plans/2026-07-19-stm32-learning-platform-roadmap.md)

## 执行原则

- 每个功能先写失败测试，再做最小实现，再验证和提交。
- 模拟器通过不能冒充真实开发板通过。
- 内容分段验证，最终再执行 24 周/46 源课程全量验证。
- 每个固件工程独立使用 STM32CubeMX、CMake、Ninja 和 STM32CubeCLT 构建。
- 最终报告把软件验证、GitHub Pages 部署和真实硬件验证分开记录。

## 执行方式

- Subagent-Driven：按任务派发独立 subagent，并在任务之间复核；速度较快，需要你明确允许使用 subagent。
- Inline Execution：在当前任务中按批次执行，每批完成后检查；不创建 subagent。
