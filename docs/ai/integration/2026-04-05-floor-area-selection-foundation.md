# 集成说明：地板框选底座

## 主题

`2026-04-05-floor-area-selection-foundation`

## 玩家路径

1. 玩家在 `GameScene` 中按下鼠标左键。
2. `world-grid` 把世界坐标映射到格子；若按下位置不在网格内，则本次操作不启动框选，普通点击会清空当前选区。
3. `selection-ui` 根据当前修饰键解析本次操作模式：普通替换、`Shift` 并集、`Ctrl` 切换增删。
4. 玩家拖拽时，`world-grid` 负责把锚点格与当前格展开为包含边界的矩形格集合；`selection-ui` 基于此生成草稿选区和预览结果。
5. `GameScene` 按预览结果绘制地板高亮；`Ctrl` 时对“将添加”和“将剔除”的格子使用不同颜色。
6. 玩家松开鼠标后，`selection-ui` 提交最终选区；`scene-hud` 会把这批 cell key 交给当前小人工具的 mock 派工逻辑，或在待机工具下批量清理任务标记。
7. 本轮选区与任务标记只保存在当前场景生命周期内。

## 参与系统

- `selection-ui`：选区状态机、修饰键语义、草稿/提交结果。
- `world-grid`：世界坐标命中格子、矩形格集合展开。
- `GameScene`：输入监听、图层绘制、与现有石头/交互点/小人渲染共存。
- `scene-hud`：消费已提交选区，把当前小人工具批量映射为格上任务标记。

## 当前 UI-first fake

- 选区和基于选区生成的 mock 任务标记都只存在于 `GameScene` 内存中，不进入存档、数据表或区域类型模型。
- 选区高亮全部使用 Phaser 几何图形，无正式素材和 HUD 控件。
- 点击目标始终以网格为主，不让交互点或 pawn 抢占本轮输入。

## TDD 顺序

1. `world-grid` domain：世界坐标命中格子、矩形格集合展开。
2. `selection-ui` domain/acceptance 风格：替换、并集、切换增删、网格外点击清空规则。
3. 场景接线后跑全量测试与 TypeScript 构建，确认新图层与输入监听不破坏既有逻辑。

## fake-to-real 反推顺序

1. 在当前 mock 派工之上，继续让 `scene-hud` 消费同一组选区 cell key，而不是额外维护第二份拖拽结果。
2. 将场景内存态抽到独立的区域定义模型，区分选区、mock 标记与已落地的区域类型。
3. 若引入区域可达性、禁设区规则或存档持久化，继续沿用 `selection-ui` + `world-grid` 的输入/网格契约。

## 必跑回归组合

- `selection-ui` + `world-grid`
- `selection-ui` + `GameScene`
- `world-grid` + `pawn-state`（确认格子语义仍可共存）
