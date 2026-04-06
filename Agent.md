# Twist_V1 Agent 入口

本仓库是通过 Agent 协作开发的游戏项目。

对本文档的任何修改都需呀同步到CLAUDE.md

**初创阶段原则（精神，全局强制）：**

- 新功能与重构**不**背负历史接口与历史架构，**不**迁就旧实现；认准目标形态就**一次性**改到位，用可重复校验保证正确性。

**进行任何修改前，按顺序阅读：**

1. `.agent/system-prompt.md` — 行为约束与质量标准
2. `.agent/repo-rules.md` — 目录结构规则与变更管理
3. `.agent/coding-standards.md` — 语言、风格与架构指导
4. `.agent/doc-rules.md` — 文档写作与存放规则
5. `.agent/task-workflow.md` — 功能开发与缺陷修复工作流

**新增玩法、改交互、扩系统、补规则时，先走 `route-demand`：**

- 入口：`.agent/skills/route-demand/SKILL.md`
- 先确定受影响的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance` 子系统
- 再按 `oh-gen-doc -> oh-code-design -> oh-acceptance -> TDD/实现` 顺序推进
- 路由结果统一写入 `working-plan/route-demand/<yyyy-mm-dd>-<topic>.md`

**模块定位、模块阅读、归属判断、找入口文件时，优先走 `lookup-module-with-aidoc`：**

- 入口：`.agent/skills/lookup-module-with-aidoc/SKILL.md`
- 先用 `docs/ai/index/system-index.json`、系统 README 和 routed system 映射查实现入口、关键测试、场景入口与 `oh-*` 文档
- 只有 aidoc 索引不足时，才继续扩散到源码
- 必须扩散到源码查询时，优先使用 `rg`进行文本和文件检索
- 这个流程只负责模块检索，不替代 `route-demand`

**准备推送远端前，必须走 `.agent/skills/push-with-aidoc/SKILL.md`，先校验受影响系统的 aidoc 与索引，再推送**

产品方向、架构目标与近期规格见 `docs/ai/project-overview.md`。
结构化需求与设计优先从 `oh-gen-doc/`、`oh-code-design/`、`oh-acceptance/` 进入。
`docs/ai/index/README.md` 和 `docs/ai/index/system-index.json` 仅作为 legacy 实现索引参考，不再是 `route-demand` 的权威注册表。

## 技术栈速查

- **运行时**：Phaser 3 + TypeScript
- **构建**：Vite
- **测试**：Vitest
- **启动**：`npm run dev` | **测试**：`npm run test` | **构建**：`npm run build`

## 目录职责速查

| 目录          | 用途                                     |
| ------------- | ---------------------------------------- |
| `src/game/`   | 模拟层：世界状态、实体、目标、工作、行动 |
| `src/scenes/` | 表现层：Phaser 场景编排与 UI             |
| `data/`       | 静态游戏数据与 JSON 配置                 |
| `tests/`      | 自动化测试（优先覆盖确定性逻辑）         |
| `tools/`      | 校验脚本与开发工具                       |
| `docs/ai/`    | 系统规格、架构说明（Agent 消费）         |
| `docs/human/` | 上手指南、协作说明（人类消费）           |
