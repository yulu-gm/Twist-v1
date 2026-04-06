# 子系统人工智能文档目录

本目录存放这批 legacy implementation system pages，按 `docs/ai/index/system-index.json` 的 legacy `key` 分目录组织。

这些页面是实现侧查找入口，不是 `route-demand` 的权威注册表。`route-demand` 仍然以 9 个一级 routedSystems 为准：

- `UI系统`
- `交互系统`
- `地图系统`
- `实体系统`
- `工作系统`
- `建筑系统`
- `时间系统`
- `行为系统`
- `需求系统`

这批 legacy system 与一级 routedSystems 的关系是桥接关系：

- 每个 legacy page 说明自己对应哪些 `routedSystems`。
- `lookupAliases` 只负责帮助 Agent 找到同一页，不代表新增系统。
- `sharedEntryFiles` 记录多个系统会共用的入口文件，方便跨页回看。
- 当实现或边界变化时，优先回填 `docs/ai/index/system-index.json`，而不是在这里另起一套权威注册表。

推荐结构：

- `docs/ai/systems/world-grid/`
- `docs/ai/systems/time-of-day/`
- `docs/ai/systems/world-core/`
- `docs/ai/systems/selection-ui/`
- `docs/ai/systems/scene-hud/`
- `docs/ai/systems/pawn-state/`
- `docs/ai/systems/task-planning/`

每篇 legacy system 页面都应该同时说明：

- 它桥接到哪些 `routedSystems`。
- 它有哪些 `lookupAliases`。
- 它与哪些 `sharedEntryFiles` 共享入口。
- 哪些路径、测试和场景接入已经是当前真实路径。

每篇人工智能文档建议基于 [system-aidoc-template.md](/D:/Twist_V1/docs/ai/templates/system-aidoc-template.md) 填写。
