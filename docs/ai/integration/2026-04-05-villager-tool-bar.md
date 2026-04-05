# 集成文档

## 主题

`2026-04-05-villager-tool-bar`

## 玩家路径

1. 玩家进入 `GameScene`，画面底部居中呈现小人指令工具栏（mock 数据填充）。
2. 玩家按下 **Q–O** 之一，或点击对应按钮 → **scene-hud** 更新当前选中槽位（高亮、`aria-pressed`）。
3. 模拟层小人行为不变；无跨系统状态回写。

## 参与系统

- **scene-hud**：DOM 工具栏、`GameScene` 内快捷键绑定、选中索引生命周期与清理（`SHUTDOWN` / `AbortController`）。
- **task-planning**（将来）：读取「当前工具」生成可执行动作；本次不接入。

## 当前 UI-first fake

- 工具名称、hint、id 列表：`src/scenes/villager-tool-bar-config.ts` 固定数组（`mock-villager-tools.ts` re-export）。
- 键位与槽位顺序：与 `MOCK_VILLAGER_TOOL_KEY_CODES` 硬编码对齐；见 scene-hud aidoc「假实现边界」。

## TDD 顺序

1. **component**：`validateMockVillagerToolBarConfig` 与槽位数量/热键串（`tests/component/villager-tool-bar-model.test.ts`）。
2. **手工/视觉**：`npm run dev` 验证底部居中、点击与快捷键切换。
3. **将来 domain**（接入任务时）：根据真实「指令类型」再抽数据与规划测试，不归档于本集成切片。

## fake-to-real 反推顺序

1. 将 mock 列表迁移为 `data/` 配置或模拟层只读表；保留 `validateMockVillagerToolBarConfig` 的继任校验（或 JSON schema）。
2. `task-planning` / `pawn-state` 消费当前工具 id → 补 domain 测试与集成回归。

## 必跑回归组合

- `scene-hud`（component：`villager-tool-bar-model`）
- `scene-hud` + `GameScene` 启动路径（手工）
