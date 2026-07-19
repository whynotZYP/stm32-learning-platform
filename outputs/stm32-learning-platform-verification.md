# STM32 学习平台验证报告

生成时间：2026-07-19T22:55:40.625Z

软件发布状态：可以发布
完整目标状态：全部完成

## 交付包指纹

- Git commit: 7944b45
- SHA-256: d4fed74eca9709c6ebda9f5108cf773b940a3a542debd96d6a52cfa2862b5a59

| 要求 | 状态 | 说明 |
| --- | --- | --- |
| SKILLS | 通过 | 已记录 Superpowers 与 AnySearch 的使用 |
| TOOLCHAIN | 通过 | Windows、CubeMX、CMake 与 ARM 工具链说明及构建可复现 |
| COURSE_MAP | 通过 | 24 周课程地图和知识标签完整 |
| COURSE_CONTENT | 通过 | 46 份来源课程、SPL-HAL 映射和检测合同通过验证 |
| HARDWARE_SAFETY | 通过 | 硬件接线、安全边界和停止条件明确 |
| WEB_GUIDANCE | 通过 | 网页提供学习路线、课程、报告和开发板引导 |
| LOCAL_PROGRESS | 通过 | 本地进度可保存并恢复 |
| SCORING | 通过 | 测验评分和证据状态有自动测试 |
| PHASE_GATES | 通过 | 阶段门槛和掌握度规则明确 |
| REMEDIATION | 通过 | 知识缺口可生成补修队列 |
| EXTENSIONS | 通过 | 跨课程延伸方向完整 |
| NOTES | 通过 | 周笔记可编辑、保存和导出 |
| BACKUP | 通过 | 进度备份导入导出经过验证 |
| DEVICE_PROTOCOL | 通过 | 开发板 v1 协议严格、有界且只运行安全注册项 |
| DEVICE_SIMULATOR | 通过 | 六种模拟场景在桌面和手机浏览器通过 |
| FIRMWARE_BUILD | 通过 | 21 个课程固件和检测固件均通过 ARM 构建 |
| WEB_BUILD | 通过 | 生产网页构建、类型检查和变更格式检查成功 |
| BROWSER_E2E | 通过 | 完整浏览器端到端流程通过 |
| OFFLINE | 通过 | 首次联网后核心学习流程可离线使用 |
| GITHUB_REPOSITORY | 通过 | 完整项目已上传 GitHub main 分支并核对 commit |
| GITHUB_PAGES | 通过 | GitHub Pages 已部署并现场验证（当前完成标准不要求） |
| LEARNER_DOCS | 通过 | 非程序员使用和恢复文档完整 |
| REAL_HARDWARE | 待验证 | 实板检查 flash-and-boot 待完成；实板检查 serial-handshake 待完成；实板检查 chip-id 待完成；实板检查 disconnect-reconnect 待完成；实板检查 gpio-loopback 待完成；实板检查 pwm-capture-loopback 待完成；实板检查 mpu6050-id 待完成；实板检查 w25q64-id 待完成；实板检查 w25q64-roundtrip-restore 待完成；实板检查 rtc-bkp 待完成；实板检查 watchdog-reset-cause 待完成；实板检查 internal-flash-roundtrip-restore 待完成；实板检查 manual-led 待完成；实板检查 manual-buzzer 待完成；实板检查 manual-servo-motor 待完成；实板检查 pwr-wake 待完成；实板检查 pwr-current 待完成 |

## 直接证据

- SKILLS: docs/verification/skills-used.md
- TOOLCHAIN: docs/setup/windows-toolchain.md；work/release-logs/npm-ci.log；work/release-logs/lesson-firmware.log；work/release-logs/device-firmware.log
- COURSE_MAP: curriculum/course-map.json；curriculum/knowledge-tags.json
- COURSE_CONTENT: curriculum/source-api-inventory.json；docs/references/spl-to-hal-map.md；work/release-logs/validate-content.log
- HARDWARE_SAFETY: docs/learner/device-connection.md；docs/verification/hardware-smoke-test.md
- WEB_GUIDANCE: web/src/app/router.tsx；web/src/pages/DeviceConsolePage.tsx
- LOCAL_PROGRESS: web/src/infrastructure/indexedDbProgressRepository.ts
- SCORING: web/src/domain/assessment/gradeAssessment.test.ts
- PHASE_GATES: assessments/rubrics/common-rubric.md；web/src/domain/scoring/mastery.test.ts；web/src/domain/scoring/phaseGate.test.ts
- REMEDIATION: curriculum/remediation；web/src/domain/remediation/buildRemediationQueue.test.ts
- EXTENSIONS: curriculum/extensions
- NOTES: notes/templates/weekly-note.md；web/src/pages/NotesSettingsPage.test.tsx
- BACKUP: docs/learner/backup-restore.md；web/src/domain/backup/backup.test.ts
- DEVICE_PROTOCOL: docs/device/protocol-v1.md；firmware/device-test-v1/App/device_protocol.c；work/release-logs/unit-tests.log
- DEVICE_SIMULATOR: web/e2e/device-console.spec.ts；work/release-logs/device-e2e.log
- FIRMWARE_BUILD: work/release-logs/lesson-firmware.log；work/release-logs/device-firmware.log
- WEB_BUILD: work/release-logs/typecheck.log；work/release-logs/web-build.log；work/release-logs/git-diff-check.log
- BROWSER_E2E: work/release-logs/browser-e2e.log
- OFFLINE: web/e2e/offline.spec.ts；work/release-logs/offline-e2e.log
- GITHUB_REPOSITORY: .github/workflows/pages.yml；https://github.com/whynotZYP/stm32-learning-platform；main@0a11af542366c7af4be835e8305f4cd7a2bfbe17
- GITHUB_PAGES: .github/workflows/pages.yml；https://whynotzyp.github.io/stm32-learning-platform/；https://github.com/whynotZYP/stm32-learning-platform/actions/runs/29706901273
- LEARNER_DOCS: docs/learner；work/release-logs/learner-docs.log
