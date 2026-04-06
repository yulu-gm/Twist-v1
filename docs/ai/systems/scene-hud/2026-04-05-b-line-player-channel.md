# scene-hud：B 线玩家通道与验收面板（历史）

> **2026-04 起**：右下角 B 线验收场景数据、面板与网关「按场景切换」已移除；玩家通道仍保留。人工对照玩法请用 `scenarios/*.scenario.ts` + 游戏内「测试场景」下拉与 `runScenarioHeadless`。

## 背景（原状）

在 A 线未接真实世界提交前，B 线曾在 HUD 侧提供 **mock 世界网关** 反馈、领域命令回放入口，以及可切换的人工验收场景说明。

## 实现要点（原状，已实现移除）

- ~~`HudManager`：`setupBAcceptancePanel` / `syncBAcceptancePanel`~~；`syncPlayerChannelHint`、`syncPlayerChannelLastResult` 仍用于玩家通道与命令结果。
- ~~`src/data/player-acceptance-scenarios.ts`~~：已删除。
- `index.html`：玩家通道与测试场景面板；`tests/scene-hud-markup.test.ts` 校验关键 `id` 与 `aria-live`。

## 依赖

- `src/player/*` 由 `GameScene` 编排，不向 HUD 泄漏 Phaser 类型。
