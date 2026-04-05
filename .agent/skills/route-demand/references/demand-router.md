# 需求路由（demand-router）

把口语需求压成可执行分包流程时的检查清单（与 `SKILL.md` 的 Workflow 一致）。

1. **提炼**：玩家目标 → 输入动作 → 画面反馈 → 状态承诺 → 边界与 fake/stub。
2. **拆分**：按独立可见结果 / 测试层级 / 假实现边界划分子系统。
3. **查表**：打开 `system-registry.md`，确认标准文档路径、aidoc 目录与默认 failing test。
4. **分派**：每系统单独收敛规格，约定见 `subagent-contract.md`。
5. **汇总**：主控需求单、集成文档、TDD 顺序与 fake-to-real；测试策略见 `skill-tdd.md`。
