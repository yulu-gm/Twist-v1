# scene-hud：B 线玩家通道与验收面板

## 背景

在 A 线未接真实世界提交前，B 线在 HUD 侧提供 **mock 世界网关** 反馈、领域命令回放入口，以及可切换的人工验收场景说明。

## 实现要点

- `HudManager`：`syncPlayerChannelHint`、`syncPlayerChannelLastResult`、`setupBAcceptancePanel` / `syncBAcceptancePanel`；小人详情中通过 `need-signals` 展示需求紧急度与打断许可桩。
- `src/data/player-acceptance-scenarios.ts`：验收场景与 `MockWorldPort` 配置的数据化描述。
- `index.html`：玩家通道与右下角验收面板结构。`tests/scene-hud-markup.test.ts` 校验关键 `id` 与 `aria-live`。

## 依赖

- `src/player/*` 由 `GameScene` 编排，不向 HUD 泄漏 Phaser 类型。
