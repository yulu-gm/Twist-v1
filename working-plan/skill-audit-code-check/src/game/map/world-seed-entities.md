# 审计报告: src/game/map/world-seed-entities.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 未发现明显问题。`seedInitialTreesAndResources` 在障碍播种之后追加树木与地面食物资源，与 `oh-code-design/地图系统.yaml` 中「初始地图快照」所列「初始小人位置 / 初始物资分布 / 初始树木分布」的意图一致（本函数承担后两项的具象化）；树木经 `createGameplayTreeDraft` 生成，与 `oh-gen-doc/实体系统.yaml` 中树木「正常」未标记伐木、`oh-code-design/实体系统.yaml` 中树木实体含位置与伐木相关字段的方向一致。地面资源使用 `materialKind: "food"`、`containerKind: "ground"`、`pickupAllowed: false`，与 `oh-gen-doc/地图系统.yaml`「地图初始化 → 初始内容 → 物资分布」中「散落状态，未被标记可拾取」及 `oh-code-design/实体系统.yaml` 物资实体「可拾取标记」字段语义一致。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 未发现明显问题。无 `mock`/`temp`/`TODO` 残留；数量区间虽为魔法数字，但属于实现常量而非对废弃系统的兼容分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 未发现明显问题。本文件位于地图子系统，通过 `spawnWorldEntity` 写入世界，与同目录 `world-seed.ts` 对障碍实体的播种方式一致，未绕过领域创建入口；树木使用 `../entity/gameplay-tree-spawn` 的统一草案工厂，符合该工厂头注释中「场景载入、主世界播种…均应通过此工厂，避免分叉」的约束。资源草案内联于本文件，与树木工厂化不对称，但未违反 `oh-code-design` 中已引用的明确分层禁令条文，属实现风格差异。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0129]: 若需与树木侧完全对称，可抽取 `createGameplayGroundFoodDraft(cell)`（或等价）集中资源种子字段，降低与 `oh-code-design/实体系统.yaml`「实体原型定义」演进时的漂移风险。
- [行动点 #0130]: 将 8–12 / 3–5 等区间提升为世界生成配置或常量模块，便于对齐策划后续在 `oh-gen-doc` 中细化的数量规则，而无需散落于业务函数内。
- [行动点 #0131]: `spawnWorldEntity` 在非 `created` 时本函数静默跳过（见第 67–69、80–82 行）；在当前「先洗牌再逐格占用」流程下冲突概率低，但若未来在其它播种步骤中先占可行走格，可能导致实际生成数量少于预期且无反馈；可在调试或集成测试中断言 outcome，或为种子流程增加可观测日志（非设计文档硬性条款，属工程质量加固）。