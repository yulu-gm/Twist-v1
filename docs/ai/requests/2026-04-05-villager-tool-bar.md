# 路由后主控需求单

## 主题

`2026-04-05-villager-tool-bar`

## 原始需求

在画面底部居中增加工具菜单栏，若干格子对应小人指令（如开采、拆除、割草、伐木等）；快捷键 **Q W E R T Y U I O** 切换当前选中工具。数据阶段全部使用 mock。

## route-demand 路由结果

- **玩家目标**：为后续「向小人下达指令」预留入口；当前仅需能看清可选指令并切换「当前工具」。
- **输入动作**：键盘 Q–O；点击工具格。
- **画面反馈**：底部居中工具条；当前选中格有高亮；标题/tooltip 可读到指令名与简要说明。
- **状态承诺**：场景存活期间存在唯一「当前选中工具索引」；场景 `restart` 后选中回到默认第一项；快捷键与槽位一一对应、顺序固定为 QWERTYUIO；工具元数据来自 mock，不改变 `src/game/` 模拟状态。

## 本次目标系统

| system | 负责的玩家可见结果 | 标准文档 | aidoc 路径 | 默认 failing test |
| --- | --- | --- | --- | --- |
| scene-hud | 底部工具栏布局、选中态、快捷键与点击切换 | `docs/ai/system-standards/scene-hud.md` | `docs/ai/systems/scene-hud/2026-04-05-villager-tool-bar.md` | component |

## 依赖系统

- **selection-ui**：本次仅为「指令工具」选中，与格子/小人选中无耦合；不单独产出新 aidoc。日后若统一「选中模型」，再在集成层对接。
- **task-planning**：将来消费「当前工具」时再接入；当前不修改。

## SubAgent 分派计划

- **scene-hud** → 阅读 `docs/ai/system-standards/scene-hud.md`，写回 `docs/ai/systems/scene-hud/2026-04-05-villager-tool-bar.md`。

## 汇总注意事项

- UI-first：工具列表与键位全部为 mock / 固定配置（`villager-tool-bar-config.ts`），必须在 aidoc 中登记 fake 边界。
- 集成文档与索引需在实现合并后同步 `docs/ai/index/system-index.json` 与 `docs/ai/systems/scene-hud/README.md`。
