## 目标

把 `GameScene` 里的网格渲染与网格数据组装拆出去：`src/game/world-grid.ts` 继续作为地图几何的唯一权威，`src/scenes/renderers/*` 和 `src/data/*` 作为消费端读取它的结果。

## 本系统负责的玩家可见结果

- 玩家看到的格线、地表物件和选区高亮保持不变。
- 世界格子尺寸、边界、出生点和占用规则保持不变。
- 玩家不会感知到这次重构带来的行为差异。

## 前置依赖

- `src/game/world-grid.ts` 已经定义格子几何、邻格和边界语义。
- `src/scenes/renderers/grid-renderer.ts`、`src/scenes/renderers/ground-items-renderer.ts`、`src/scenes/renderers/selection-renderer.ts` 已承担对应视觉职责。
- `src/data/grid-cell-info.ts` 与 `src/data/ground-items.ts` 已开始按格键消费网格信息。

## 本系统输入

- 网格尺寸与坐标换算
- 格键与格坐标
- 网格内/网格外判断
- 按格组织的地表与格子信息

## 本系统输出/反馈

- `world-grid` 提供的格几何、邻格、边界和占用结果
- `grid-renderer` 的格线绘制结果
- `ground-items-renderer` 的地表物件绘制结果
- `selection-renderer` 的选区与交互绘制结果
- `grid-cell-info` 和 `ground-items` 的格键化数据读取结果

## 假实现边界

- 允许渲染器继续从 `world-grid` 读取几何，不引入第二套坐标系统。
- 允许 `GameScene` 保留编排入口，但不要再直接写网格绘制或格键数据拼装逻辑。
- 不允许渲染器或数据模块私自修改网格尺寸、边界或占用规则。

## 最先失败的测试

- 测试层级：`domain` + `scene`
- 触发方式：验证网格几何与占用规则不变；验证各渲染器仍从同一套 `world-grid` 结果取数
- 预期失败原因：GameScene 仍持有网格表现细节，或渲染器/data 模块没有统一消费入口

## 最小通过实现

- 保持 `src/game/world-grid.ts` 为唯一权威
- 让三个 renderer 文件分别负责网格、地表物件和选区视觉
- 让 `src/data/grid-cell-info.ts` 与 `src/data/ground-items.ts` 改为只消费格键化网格数据

## 后续反推到底层的接口/规则

- 若后续加入更多地表视觉或交互层，优先新增独立 renderer，而不是继续扩写 `GameScene`。
- 若后续网格几何升级为数据驱动地图，仍应保持 `world-grid` 输出不变，避免扰动渲染器契约。
- 若后续需要更复杂的格键索引，扩展 `data/` 层的消费者，不要改写网格权威规则。
