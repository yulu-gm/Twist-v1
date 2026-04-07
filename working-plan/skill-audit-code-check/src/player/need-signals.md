# 审计报告: src/player/need-signals.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。本文件仅一行 `export * from "../game/need/need-signals"`，不包含任何业务逻辑；策划与架构中对「可读需求状态、阈值阶段、可打断信号」等要求，应由需求系统相关实现承担（见 `oh-code-design/需求系统.yaml` 中「需求计算层」「需求投影层」及「关键数据 · 需求规则配置 / 需求行动建议」），而非由本再导出文件单独实现。
- 说明：若将来删除本再导出，消费方直接引用 `game/need`，不会在本路径上产生「少实现一段逻辑」的缺口。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]：`src/player/need-signals.ts` 作为对 `../game/need/need-signals` 的二次入口，与 `src/game/need/index.ts` 已有导出形成**并行导入面**；当前 `src/ui/hud-manager.ts` 通过 `../player/need-signals` 取 `needSignalsFromNeeds`，属于非必要的间接层。
- [影响]：新代码可能继续从 `player` 引用领域只读类型与函数，与目录名「player」所暗示的「玩家输入/编排」语义混杂，增加后续梳理依赖与删除死代码的成本。
- 补充（转发目标，供关联审计）：`src/game/need/need-signals.ts` 中 `NeedSignalSnapshot` 字段注释仍写「mock：阈值 75/80」，与 `oh-code-design/需求系统.yaml`「阈值规则集 · 定义正常、警戒、紧急等需求区间」所期望的**可配置规则**存在张力；该问题不在本文件行内，但与本再导出所暴露的 API 同源。

## 3. 架构违规 (Architecture Violations)

- [指控]：UI 通过 `player/need-signals` 获取需求只读信号，使「需求投影」能力在物理路径上挂在 `src/player/` 下，弱化「需求系统 → UI」的清晰边界。
- [依据]：`oh-code-design/需求系统.yaml`「分层 · 需求投影层」写明职责为「为 UI 和调试工具输出可读状态，例如饥饿、疲劳、恢复中」；同文件「接口边界 · 输出」写明「提供给 UI 系统的需求展示字段」「提供给工作系统的可打断信号」。`oh-code-design/UI系统.yaml`「分层 · 界面状态层」写明「订阅领域系统只读数据并转成界面态」，「目标」中强调「以读模型驱动展示，避免 UI 直接承担领域规则」。需求只读映射应被视为**需求系统对外读模型**的一部分，由 UI **直接**从 `game/need`（或统一 facade）订阅更符合上述分层叙述；经 `player` 再导出易被误读为「玩家子系统」职责，与文档中的子系统划分不一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0272]：将 `src/ui/hud-manager.ts`（及其他引用方）的导入改为 `../game/need/need-signals` 或 `../game/need` 的规范出口，然后删除 `src/player/need-signals.ts`，消除双入口。（执行时遵守仓库既有迁移策略与测试。）
- [行动点 #0273]：若短期内必须保留路径兼容，在团队约定或 lint 中标注「禁止新增从 `player/need-signals` 的引用」，并逐步收敛到 `game/need`。
- [行动点 #0274]（关联 `game/need/need-signals.ts`，非本文件）：将饥饿/疲劳阈值与「是否允许打断」与 `oh-code-design/需求系统.yaml`「阈值规则集」「需求行动建议」对齐，去掉注释中的 mock 语义或改为数据驱动配置，避免 UI/行为层与真实规则长期分叉。

## 5. 修复核对（bundle #31 / AP-0272·0273·0274）

- **已核对**：`src/player/need-signals.ts` 已删除；`rg` 无 `player/need-signals` 引用。
- **AP-0272**：`src/ui/hud-manager.ts` 从 `../game/need` 导入 `needSignalsFromNeeds`，调用时展开 `pawn.needs` 并传入 `satiety`/`energy`，与规范出口一致。
- **AP-0273**：不再保留 `player` 再导出；新增引用路径无从 `player/need-signals` 进入的必要。
- **AP-0274**：`src/game/need/need-signals.ts` 使用 `threshold-rules.ts` 中 `PAWN_NEED_URGENCY_RULES` 派生的 `HUNGER_INTERRUPT_THRESHOLD`、`PAWN_NEEDS_*_WARN`、`REST_INTERRUPT_THRESHOLD` 等，与 sim-loop 走向工单中断判定同源；可选 `satiety`/`energy` 经 `pawnNeedsFromScalars` 与 legacy `PawnNeeds` 对齐；已去除原「mock 阈值」类注释与 HUD「B-M2 桩」文案。
- **验证**：仓库根执行 `npx tsc --noEmit` 退出码 0。