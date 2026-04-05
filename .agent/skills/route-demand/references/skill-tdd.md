# route-demand 与测试层级

- 路由阶段只定边界与 fake/stub，**不**代替 domain TDD 写实现。
- 默认层级见 `system-registry.md` 的「默认 failing test」列；多系统需求在集成文档写 **TDD 顺序** 与 **必跑回归组合**。
- 确定性逻辑用 Vitest `tests/domain`（或项目约定的同级目录）；UI-first 可 acceptance/component，须在 aidoc 标注。
