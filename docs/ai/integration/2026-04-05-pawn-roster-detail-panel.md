# 集成说明：人物略缩条与详情面板

## 涉及系统

- `scene-hud`：DOM 容器、略缩条与详情布局、模拟档案数据文件。
- `pawn-state`（只读）：详情区域展示 `needs`、目标/行动、`debugLabel`；与场上小人圆圈颜色、名称保持一致。
- `selection-ui`：与网格高亮等并存；本面板为独立的选中状态（略缩标签页），不自动同步格子选择。

## 玩家可见耦合

- 略缩条名字与颜色与 `GameScene` 内小人表现同源；详情区域需求数值随着模拟时间变化。

## 变更时注意

- 新增模拟表现文件时，更新 `docs/ai/index/system-index.json` 中的 `scene-hud.sourceFiles`。
- 如果详情改为纯模拟、不再读取 `PawnState`，需要同步本说明与对应的 aidoc。
