---
name: push-with-aidoc
description: Use before pushing code to the remote repository so aidoc, system index, and managed commit metadata are updated together.
---

# Push With Aidoc

在推送远端前，检查本次改动涉及哪些系统，更新对应 aidoc，生成受控收尾提交。

## Workflow

1. **识别待推送范围**：工作区未提交修改 + 本地领先远端但未推送的提交。
2. **映射受影响系统**：读取 `docs/ai/index/system-index.json`，运行 `tools/aidoc/analyze-changes.mjs`。
3. **更新文档**：
   - `docs/ai/systems/<system>/README.md`
   - 相关 routed aidoc
   - 跨系统说明时更新 `docs/ai/integration/`
   - 工作流约束变化时更新入口和规则文档
4. **校验**：运行 `node tools/aidoc/validate-index.mjs` 和 `npm.cmd run test:docs`。
5. **生成收尾提交**（格式见下方），然后执行 push。

## 收尾提交格式

标题：`[aidoc-sync] <summary>`

正文 trailer：

```
AIDOC-Managed: true
AIDOC-Systems: <comma-separated-system-keys>
AIDOC-Index: docs/ai/index/system-index.json
AIDOC-Updated: <comma-separated-doc-paths>
AIDOC-Source: push-with-aidoc
```

只有本 skill 允许生成此格式。managed commit 必须是独立收尾提交，不可把业务提交重写成 managed commit。

## 文档路径约定

- 系统 aidoc → `docs/ai/systems/<system>/`
- 集成文档 → `docs/ai/integration/`
- 系统索引 → `docs/ai/index/system-index.json`
- 纯 `docs/human/` 改动可不回填系统 aidoc，但仍需影响分析。
- 新增系统时先补系统索引和入口页，再推送。

## Guardrails

- 不要跳过 `system-index.json`，凭印象判断受影响系统。
- 不要把业务提交重写成 managed commit。
- 如果新增系统，先补索引再推送。
