# 审计报告: src/scenes/game-scene-keyboard-bindings.ts

## 1. 漏做需求 (Missing Requirements)

- [说明]: `oh-code-design/交互系统.yaml` 扩展点列有「可扩展键盘快捷切换模式」（约第 98 行）。本类通过 `VILLAGER_TOOL_KEY_CODES` 与 `commandIdForHotkeyIndex` 将 Q–P 映射为 `CommandMenuCommandId`，与 `COMMAND_MENU_HOTKEY_COMMAND_IDS` 长度校验配套，**已覆盖**该扩展方向下的基础热键切换。
- [指控]: 同文件扩展点另列「批量取消、重做、预览成本等高级交互能力」（约第 97 行）。本模块**未**提供任何与撤销/重做/批量取消相关的键位注册；若策划将上述能力从「扩展」提升为版本必选，则当前键盘层无对应入口（需在交互意图层或模式层另行设计后再接键位）。
- [指控]: `待确认问题` 中「取消当前模式的操作方式与反馈是否需要单独设计」（约第 104 行）。本类仅暴露 `setupEsc(scene, onEsc)`，具体语义由 `GameScene` 注入（当前为 `floorInteraction.cancelGesture()`）。若最终设计约定 Esc 必须统一处理「关闭菜单、退出笔刷、取消选区」等**全部**模式退出链，单靠本类无法自证完备性，需对照 `GameScene` / `GameSceneFloorInteraction` 做端到端核对。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（无 Mock、`TODO` 或明显死分支；`teardown*` 与 `AbortController` 成对清理 Phaser Key 与 HUD 监听，未见为旧系统保留的冗余兼容层。）

## 3. 架构违规 (Architecture Violations)

- [指控]: `oh-code-design/交互系统.yaml`「输入采集层」职责当前枚举为鼠标按下、拖拽、释放、点击及连续输入会话（约第 14–17 行），**未**将键盘事件纳入同一层的显式职责描述；而本类在 Scene 侧直接用 `scene.input.keyboard.addKey` 注册空格、反引号、数字键与 Q–P，键盘采集与「输入采集层」文档表述存在**职责边界不清晰**的张力（实现依赖扩展点「可扩展键盘快捷切换模式」作间接依据）。
- [指控]: 时间相关的暂停/调速同时经 `HudManager.setupTimeControls`（DOM 点击）与本类内 Phaser 键盘（`SPACE` / `BACKTICK` / `ONE`–`THREE`）触发，双通道指向同一组回调。`oh-code-design/时间系统.yaml` 允许输入来自「UI 或控制逻辑」（约第 84–85 行），故**不**构成违背时间系统宪法；但从 `交互系统` 所强调的输入统一抽象角度看，长期存在「同一语义、两处绑定」的维护与可测试性成本，属**风格性架构债**而非硬性违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0317]: 在 `oh-code-design/交互系统.yaml` 的「输入采集层」中补充键盘/快捷键采集的职责条目（或与扩展点合并成单一「输入源」小节），使 Scene 键盘绑定与文档一致，避免仅靠扩展点一句带过。
- [行动点 #0318]: 将时间控制与命令菜单的键位表抽成可测试的纯数据（例如与 `command-menu` / `villager-tools` 同级的声明式表），本类只负责「注册 + teardown」，减少 `setupTimeControls` 内联数组与业务回调混杂。
- [行动点 #0319]: 若产品确认 Esc 的全局语义，在 `GameScene`（或单一输入门面）集中编排 `onEsc`，本类保持「只绑定键、不解释语义」，并在验收文档中写明 Esc 覆盖的模式列表。