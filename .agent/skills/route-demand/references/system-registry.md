# 系统注册表（9 个一级系统权威表）

本表中的 `system` 列必须与 `oh-gen-doc/`、`oh-code-design/`、`oh-acceptance/` 中的文件名一一对应。

| system | oh-gen-doc | oh-code-design | oh-acceptance | 主要代码目录 | 默认验证层级 | 上游依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| UI系统 | oh-gen-doc/UI系统.yaml | oh-code-design/UI系统.yaml | oh-acceptance/UI系统.yaml | src/ui/, src/scenes/, src/data/ | component / acceptance | 交互系统, 时间系统, 行为系统, 地图系统, 实体系统 |
| 交互系统 | oh-gen-doc/交互系统.yaml | oh-code-design/交互系统.yaml | oh-acceptance/交互系统.yaml | src/game/interaction/, src/player/, src/scenes/ | domain / integration | UI系统, 地图系统, 建筑系统 |
| 地图系统 | oh-gen-doc/地图系统.yaml | oh-code-design/地图系统.yaml | oh-acceptance/地图系统.yaml | src/game/map/, src/scenes/renderers/ | domain / integration | 实体系统, 建筑系统, 交互系统 |
| 实体系统 | oh-gen-doc/实体系统.yaml | oh-code-design/实体系统.yaml | oh-acceptance/实体系统.yaml | src/game/entity/, src/game/world-core.ts | domain | 地图系统, 建筑系统, 工作系统, 需求系统 |
| 工作系统 | oh-gen-doc/工作系统.yaml | oh-code-design/工作系统.yaml | oh-acceptance/工作系统.yaml | src/game/work/, src/game/flows/ | domain / integration | 实体系统, 建筑系统, 行为系统 |
| 建筑系统 | oh-gen-doc/建筑系统.yaml | oh-code-design/建筑系统.yaml | oh-acceptance/建筑系统.yaml | src/game/building/, src/game/flows/build-flow.ts | domain / integration | 地图系统, 实体系统, 工作系统, 交互系统 |
| 时间系统 | oh-gen-doc/时间系统.yaml | oh-code-design/时间系统.yaml | oh-acceptance/时间系统.yaml | src/game/time/, src/scenes/renderers/ | domain | 行为系统, 需求系统, UI系统 |
| 行为系统 | oh-gen-doc/行为系统.yaml | oh-code-design/行为系统.yaml | oh-acceptance/行为系统.yaml | src/game/behavior/, src/game/game-orchestrator.ts, src/game/flows/ | domain / integration | 需求系统, 工作系统, 时间系统, 实体系统 |
| 需求系统 | oh-gen-doc/需求系统.yaml | oh-code-design/需求系统.yaml | oh-acceptance/需求系统.yaml | src/game/need/, src/game/pawn-state.ts | domain | 时间系统, 行为系统, 实体系统 |

## 注册表使用规则

- 主 agent 必须从本表读取结构化文档路径，不要凭记忆猜。
- 路由时优先确认 `oh-gen-doc` 是否已承接需求，再按 `oh-gen-doc -> oh-code-design -> oh-acceptance` 的固定顺序推进。
- 如果本次需求涉及新系统，先补齐三层同名文档，再让 `route-demand` 使用它。
- 若系统存在，但本次需求不产生新承诺，可以只在主控路由单中标记为依赖系统。
- `docs/ai/index/system-index.json` 仍可作为历史实现索引参考，但不再是 `route-demand` 的权威注册表。
