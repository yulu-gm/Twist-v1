# scene-hud 系统入口

## 系统职责摘要

`scene-hud` 负责 HUD、状态卡、按钮和场景内信息展示，目前标准文档已登记，实现仍待后续 routed aidoc 落地。

## 标准文档

- `docs/ai/system-standards/scene-hud.md`

## 当前关键实现文件

- `src/scenes/villager-tool-bar-config.ts`（mock 数据、键码常量、`validateMockVillagerToolBarConfig`）
- `src/scenes/mock-villager-tools.ts`（对上述模块的导出入口，兼容旧路径）
- `src/scenes/mock-ground-items.ts`（格子 mock 掉落物堆叠数据与按格查询）
- `src/scenes/mock-grid-cell-info.ts`（格子悬停文案；可拼接掉落物行）

## 当前关键测试文件

- `tests/component/villager-tool-bar-model.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`

## 最新/历史 aidoc

- `docs/ai/systems/scene-hud/2026-04-05-mock-ground-items.md`
- `docs/ai/systems/scene-hud/2026-04-05-villager-tool-bar.md`

## 何时必须回填

- 新增 HUD、状态卡、按钮或场景信息展示时，必须先补 routed aidoc。
- 若实现文件、测试文件或场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 若信息展示改变玩家路径或跨系统反馈，必须补充 `docs/ai/integration/`。

