---
name: obey-rule
description: >-
  Enforces (unless user say don't use) Twist-v1 workspace governance before any substantive work. Applies
  whenever the user operates in this repository: coding, refactoring, docs,
  tests, planning, git, or answering questions that affect project conventions.
  Starts by reading TWIST.md and following the ordered rules and workflows it
  links to.
---

# obey-rule（Twist-v1 工作区入口）

## 何时生效

在本仓库路径下**开始任何实质性工作之前**（写代码、改文档、跑测试、拆任务、推送等），必须先执行下方步骤。

## 必做步骤

1. **阅读仓库根目录的 `TWIST.md`**（完整读一遍；若已在本轮对话中读过且内容未变，可跳过重复阅读）。
2. **严格按 `TWIST.md` 所列顺序与链接**加载并遵守：
   - `.agent/system-prompt.md`、`.agent/repo-rules.md`、`.agent/coding-standards.md`、`.agent/doc-rules.md`、`.agent/task-workflow.md`
3. **若任务类型命中 `TWIST.md` 中的专项流程**（如 `route-demand`、`push-with-aidoc`），在执行对应工作前先打开并遵循其 `SKILL.md`。

完成以上步骤后，再按用户请求继续执行。
