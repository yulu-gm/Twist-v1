# 集成文档

## 主题

`2026-04-05-villager-tool-bar`

## 玩家路径

1. 玩家进入 `GameScene`，画面底部居中呈现小人指令工具栏（模拟数据填充）。
2. 玩家按下 **Q–O** 之一，或者点击对应按钮，触发 **scene-hud** 更新当前选中槽位（高亮、`aria-pressed`）。
3. 玩家在地图网格内 **左键点击格子**，如果当前工具非待机，则该格子出现 **模拟任务标记**（半格子圆线框加上格子中心任务名）；待机工具点击格子则清除该格子标记（详细内容参见 `2026-04-05-mock-task-markers-on-grid.md`）。
4. 模拟层小人行为不变；无跨系统状态回写。

## 参与系统

- **scene-hud**：DOM 工具栏、`GameScene` 内快捷键绑定、选中索引生命周期与清理（`SHUTDOWN` / `AbortController`）；格子上任务标记的指针与绘制（模拟）。
- **task-planning**（将来）：读取“当前工具”生成可执行动作；本次不接入。

## 当前 UI-first 假实现

- 工具名称、提示、标识符列表：`src/scenes/villager-tool-bar-config.ts` 固定数组（`mock-villager-tools.ts` 重新导出）。
- 键位与槽位顺序：与 `MOCK_VILLAGER_TOOL_KEY_CODES` 硬编码对齐；参见 scene-hud aidoc“假实现边界”。

## 测试驱动开发顺序

1. **组件**：`validateMockVillagerToolBarConfig` 与槽位数量/热键串（`tests/component/villager-tool-bar-model.test.ts`）。
2. **手工/视觉**：`npm run dev` 验证底部居中、点击与快捷键切换。
3. **将来领域**（接入任务时）：根据真实“指令类型”再抽取数据与规划测试，不归档于本集成切片。

## 假实现到真实实现反推顺序

1. 将模拟列表迁移为 `data/` 配置或者模拟层只读表；保留 `validateMockVillagerToolBarConfig` 的继任校验（或者 JSON 模式）。
2. `task-planning` / `pawn-state` 消费当前工具标识符，补充领域测试与集成回归。

## 必跑回归组合

- `scene-hud`（组件：`villager-tool-bar-model`、`mock-task-marker-commands`）
- `scene-hud` 加上 `GameScene` 启动路径（手工）
