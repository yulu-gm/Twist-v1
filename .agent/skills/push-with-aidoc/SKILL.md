---
name: push-with-aidoc
description: Use before pushing code to the remote repository so aidoc, system index, and managed commit metadata are updated together.
---

# Push With Aidoc

## Overview

在准备推送远端前，统一检查本次改动涉及哪些系统，更新对应 aidoc，并生成可识别的受控推送标记提交。

## Required Inputs

执行前必须读取：

1. `docs/ai/index/system-index.json`
2. `docs/ai/index/README.md`
3. `.agent/doc-rules.md`
4. `.agent/task-workflow.md`

## Workflow

1. 识别待推送范围：
   - 工作区未提交修改
   - 本地领先远端但尚未推送的提交
2. 使用 `tools/aidoc/analyze-changes.mjs` 映射受影响系统。
3. 对受影响系统执行文档维护：
   - 更新 `docs/ai/systems/<system>/README.md`
   - 更新相关 routed aidoc
   - 需要跨系统说明时更新 `docs/ai/integration/`
   - 若工作流约束变化，更新入口和规则文档
4. 运行：
   - `node tools/aidoc/validate-index.mjs`
   - `npm.cmd run test:docs`
5. 生成独立收尾提交，提交信息必须使用受控格式。
6. 完成后再执行远端 push。

## Managed Commit Format

提交标题：

- `[aidoc-sync] <summary>`

提交正文 trailer：

- `AIDOC-Managed: true`
- `AIDOC-Systems: <comma-separated-system-keys>`
- `AIDOC-Index: docs/ai/index/system-index.json`
- `AIDOC-Updated: <comma-separated-doc-paths>`
- `AIDOC-Source: push-with-aidoc`

只有本 skill 允许生成这种受控收尾提交。若远端最新提交没有该格式，默认视为没有经过完整的 aidoc push 流程。

## Guardrails

- 不要跳过 `docs/ai/index/system-index.json`，凭印象判断受影响系统。
- 不要把业务提交重写成 managed commit；managed commit 必须是独立收尾提交。
- 纯 `docs/human/` 改动可不回填系统 aidoc，但仍要先做影响分析。
- 如果新增系统，先补系统索引和系统入口页，再进入推送。

