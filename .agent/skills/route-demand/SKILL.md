---
name: route-demand
description: Use when Twist_V1 receives a new gameplay, interaction, rules, or multi-system requirement that must be split into subsystem aidocs before design, testing, or implementation.
---

# Route Demand

## Overview

把新增玩法、改交互、扩系统、补规则这类需求先路由成可管理的子系统任务，再进入设计、TDD 和实现。

这个 Skill 只负责拆分和分派，不直接替代各系统完成设计或实现。

## Trigger

以下情况必须先走本 Skill：

- 新增玩法
- 新增 UI 交互或画面反馈
- 修改会影响两个及以上系统的需求
- 任何需要新 aidoc、需要拆成多个子系统、或需要主 agent 调用多个 SubAgent 的任务

以下情况默认不触发：

- 单文件文案修正
- 纯样式微调且不新增交互
- 已存在系统内部的小型无争议 bugfix，且不改变玩家可见行为

## Required References

在执行前必须依次读取：

1. `references/demand-router.md`
2. `references/system-registry.md`
3. `references/subagent-contract.md`
4. `references/skill-tdd.md`

## Workflow

1. 读取原始需求，提炼玩家目标、输入动作、画面反馈、状态承诺。
2. 根据 `demand-router.md` 生成系统拆分清单，区分目标系统与依赖系统。
3. 根据 `system-registry.md` 为每个目标系统解析：
   - 规范路径
   - aidoc 路径
   - 默认 failing test 层级
4. 为每个目标系统创建一个 SubAgent，并严格使用 `subagent-contract.md` 规定的任务格式。
5. 等所有系统 aidoc 返回后，主 agent 再汇总：
   - 主控需求单
   - 集成文档
   - TDD 顺序
   - fake-to-real 反推顺序

## Required Outputs

每次成功路由后，至少应产出：

- `docs/ai/requests/<yyyy-mm-dd>-<topic>.md`
- `docs/ai/integration/<yyyy-mm-dd>-<topic>.md`
- `docs/ai/systems/<system>/<yyyy-mm-dd>-<topic>.md`

## Guardrails

- 不要跳过系统拆分，直接写单篇混合规格。
- 不要让任何 SubAgent 跨系统补写他系统的内容。
- 不要在全部 aidoc 返回前提前拍板跨系统接口。
- UI-first 需求允许 fake/stub，但必须在 aidoc 中显式登记。
- 真实领域规则应由后续 domain TDD 接管，不要在路由阶段偷偷实现。
