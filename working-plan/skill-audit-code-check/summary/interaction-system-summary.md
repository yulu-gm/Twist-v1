# 交互系统代码审计汇总报告 (Interaction System Audit Summary)

## 现状总结 (Current Status Summary)

通过对 `src/player/` 和 `src/game/interaction/` 目录下交互系统相关模块的审计，结合 `oh-code-design/交互系统.yaml` 的理想架构设计，发现当前实现存在以下核心问题：

### 1. 需求覆盖与一致性缺口
- **输入形态缺失**：架构设计和策划需求明确了“单点放置”（如家具放置），但代码中（如 `tool-input-policy.ts`）仅支持 `rect-selection` 和 `brush-stroke`，缺失了 `single-cell` 形态。
- **模式注册不全**：`mode-registry.ts` 缺少策划文档中明确列出的“物资拾取/拾取标记”模式。
- **领域动词与菜单配置分裂**：伐木模式在注册表中动词为 `assign_tool_task:chop`，而菜单配置中为 `lumber`，存在双轨命名和硬编码映射（如 `build-domain-command.ts`），容易导致行为漂移。
- **校验职责缺失**：设计文档要求“交互意图层”在提交前执行基础校验与过滤，但目前如 `build-domain-command.ts` 和 `session-manager.ts` 均未实现校验，非法命令会静默回落到默认项或直接提交。选区解析也未过滤不可用格（`floor-selection.ts`）。

### 2. 架构分层与依赖违规
- **物理目录与子系统不对齐**：交互系统的核心模块（如 `brush-stroke.ts`, `apply-domain-command.ts`）被放置在 `src/player/` 目录下，然后由 `src/game/interaction/` 重新导出，导致 `game` 核心子系统反向依赖 `player` 表现层，违背了单向依赖的分层原则。
- **职责聚合过重**：`apply-domain-command.ts` 集中处理了存储区、蓝图、工单等多个子系统的领域应用逻辑，偏离了各子系统（地图、建筑、工作）独立处理的架构设计。

### 3. 无用兼容与技术债
- **Mock 命名残留**：生产代码中广泛使用 `MockWorldSubmitResult` 等带有 Mock 语义的类型，容易引起认知混淆。
- **未接入的策略孤岛**：`tool-input-policy.ts` 存在但未被实际调用，成为平行且易误导的规则孤岛。
- **未实现的反馈状态**：`session-manager.ts` 定义了 `previewing` 状态但无任何逻辑消费；`interaction-mode-presenter.ts` 导出了未被使用的 `usesBrushStroke` 字段。

---

## 修改建议 (Modification Suggestions)

为了使交互系统代码向 `oh-code-design/交互系统.yaml` 靠拢，建议采取以下重构与修复行动：

### 1. 补齐输入形态与交互模式
- **支持单格输入**：在输入策略和模式注册中全面支持 `single-cell`（单格点击）输入形态，以满足家具放置等需求。
- **完善模式注册表**：在 `mode-registry.ts` 中补充“物资拾取标记”模式，并对齐所有模式的 `modeId` 和领域动词（如统一使用 `lumber` 替代 `chop` 的硬编码，消除双轨命名）。

### 2. 重构目录结构与依赖关系
- **纠正依赖方向**：将 `apply-domain-command.ts`, `brush-stroke.ts` 等交互核心逻辑从 `src/player/` 迁移至 `src/game/interaction/`，消除 `game` 对 `player` 的反向依赖。
- **解耦领域应用**：拆分 `apply-domain-command.ts` 中过于集中的领域应用逻辑，将其下放到对应的地图、建筑、工作子系统的专属处理器中。

### 3. 强化交互意图层的校验职责
- **增加提交前校验**：在生成和提交领域命令前（如 `build-domain-command.ts` 和 `session-manager.ts`），增加对命令合法性、目标格可用性的显式校验，拒绝非法输入，而不是静默回落或全盘接受。
- **完善选区过滤**：选区解析（`floor-selection.ts`）应支持过滤不可用格，或将该职责明确交由地图系统的选区解析器完成。

### 4. 清理遗留代码与 Mock 语义
- **消除 Mock 命名**：全局重命名 `MockWorldSubmitResult` 等类型为中性的 `WorldSubmitResult` 或 `DomainCommandApplyResult`。
- **清理孤岛代码**：移除或真正接入 `tool-input-policy.ts`；清理未使用的状态（如 `previewing`）和字段（如 `usesBrushStroke`），保持代码与实际业务链路的一致性。