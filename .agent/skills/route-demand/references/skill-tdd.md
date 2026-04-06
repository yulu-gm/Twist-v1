# route-demand 与验证层级

- 路由阶段只定文档更新顺序、系统边界与 fake/stub，**不**代替 TDD 写实现。
- 默认层级见 `system-registry.md` 的「默认验证层级」列；多系统需求在主控路由单写清首个 failing test、必跑回归组合和 fake-to-real 顺序。
- 任何实现任务都必须在 `oh-gen-doc -> oh-code-design -> oh-acceptance` 完成同步后，再进入对应层级的测试。

## 推荐验证层级

| 系统 | 推荐首测层级 | 常见验证目标 |
| --- | --- | --- |
| UI系统 | component / acceptance | 菜单模型、状态展示模型、地图叠加反馈、模式提示 |
| 交互系统 | domain / integration | 输入会话、模式注册、命令生成、交互反馈协调 |
| 地图系统 | domain / integration | 格坐标、覆盖格、占用冲突、区域合法性 |
| 实体系统 | domain | 实体原型、生命周期、关系一致性、只读投影 |
| 工作系统 | domain / integration | 工作生成、领取、结算、复合工作链 |
| 建筑系统 | domain / integration | 蓝图放置、建筑规格、施工完成结果 |
| 时间系统 | domain | 世界时钟、昼夜切换、时间事件 |
| 行为系统 | domain / integration | 行动评分、状态机、打断规则、行为执行链 |
| 需求系统 | domain | 阈值规则、需求演化、恢复结算、需求建议 |

## 路由到测试的准则

- 玩家只看得到反馈，但底层规则未定时：
  - 仍先补 `oh-gen-doc` 与 `oh-code-design`，把 fake/stub 边界显式登记清楚，再补 `oh-acceptance`。
  - 在三层文档同步完成后，首测可从 `component` 或 `acceptance` 起。
- 规则本身发生变化时：
  - 先补 `oh-gen-doc` 与 `oh-code-design`，首测应从 `domain` 起。
- 涉及两个及以上一级系统交接时：
  - 各系统先有自己的首测，再补一层 `integration` 回归。
- 单个需求同时影响 UI 与领域：
  - 不要只测 UI；至少要有一个能证明领域承诺的 `domain` 或 `integration` 测试。
