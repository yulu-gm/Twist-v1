# 审计报告: src/game/building/blueprint-manager.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `createBlueprint` 始终在新建蓝图上写入 `relatedWorkItemIds: []`，本文件内既不创建建造工单，也不提供与工作单 ID 同步的 API；若调用方只创建蓝图、登记工单却未把工单写回实体，则无法满足「工作与目标实体双向关联」在实体侧的落库。
- [依据]: 见 `oh-code-design/工作系统.yaml` 模块「工作生成器」职责中的「建立工作与目标实体的双向关联」，以及关键流程「建造链路」中「工作生成器创建建造工作」步骤。对照同仓库 `src/game/building/blueprint-placement.ts` 在 `safePlaceBlueprint` 内创建 `construct-blueprint` 工单并调用 `attachWorkItemToEntityMutable`；而 `src/game/flows/build-flow.ts` 在 `createBlueprint` 后执行 `addWork` / `generateConstructWork`，并未将生成的 `workId` 写回蓝图实体，暴露出仅靠本管理器出口时关联易断链。

- [指控]: `cancelBlueprint` 仅 `registry.remove(blueprintId)`，未涉及关联工单的关闭或从工单侧解除目标实体；若产品规则要求「撤销蓝图即作废对应建造任务」，本函数单独使用不足以保证该规则。
- [依据]: 见 `oh-gen-doc/建筑系统.yaml` 建造流程「蓝图阶段」特性「蓝图会生成对应的建造工作任务」——取消蓝图与工单的因果一致性问题在 gen-doc 中未展开为显式步骤，但端到端上存在缺口风险，需与策划对「取消」语义对齐后由编排层或本层扩展补齐。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：本文件无 `mock`、`temp`、敷衍式 `TODO` 或明显死分支。

- [补充说明]: 仓库内存在与 `EntityRegistry` + 本管理器并行的 `WorldCore` + `safePlaceBlueprint`（`src/game/building/blueprint-placement.ts`）放置路径；玩家域命令走 `src/player/apply-domain-command.ts` 的 `safePlaceBlueprint`，部分自动化流程走 `createBlueprint`。这不属于本文件内的「无用代码」，但会放大双轨维护与字段/工单行为不一致的长期成本。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。`oh-code-design/建筑系统.yaml` 模块「蓝图管理器」职责为「创建、更新、取消蓝图」「维护蓝图进度与状态」，本文件通过 `EntityRegistry` 的 `create` / `replace` / `remove` 操作蓝图实体，分层上未出现 UI 直接改核数据等越权模式。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0055]: 在编排层（如 `build-flow`）于 `addWork` 之后对蓝图实体执行 `registry.replace`，把建造工单 ID 并入 `relatedWorkItemIds`，或扩展 `createBlueprint` / 新增包装函数接受初始工单 ID 列表，与 `oh-code-design/工作系统.yaml` 中工作生成器「双向关联」表述对齐。
- [行动点 #0056]: 明确全项目「唯一蓝图创建入口」策略，或在文档中约定两条路径（`WorldCore` vs `EntityRegistry`）各自必须满足的工单与实体字段不变式，避免长期双轨漂移。
- [行动点 #0057]: 若产品确认「取消蓝图」需联动工单，在 `cancelBlueprint` 之上增加编排（注入回调或在上层统一撤销工单）而非在不知情情况下孤立删除实体。