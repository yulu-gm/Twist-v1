# 集成说明：人物略缩条与详情面板

## 涉及系统

- `scene-hud`：DOM 容器、略缩条与详情布局、mock 档案数据文件。
- `pawn-state`（只读）：详情区展示 `needs`、目标/行动、`debugLabel`；与场上小人圆圈颜色、名称一致。
- `selection-ui`：与网格高亮等并存；本面板为独立选中态（略缩 `tab`），不自动同步格子选择。

## 玩家可见耦合

- 略缩条名字与颜色与 `GameScene` 内小人表现同源；详情区需求数值随模拟时间变化。

## 变更时注意

- 新增 mock 表现文件时更新 `docs/ai/index/system-index.json` 中 `scene-hud.sourceFiles`。
- 若详情改为纯 mock、不再读 `PawnState`，需同步本说明与对应 aidoc。
