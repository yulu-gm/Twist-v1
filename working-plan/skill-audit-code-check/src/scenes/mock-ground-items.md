# 审计报告: src/scenes/mock-ground-items.ts

## 1. 漏做需求 (Missing Requirements)

- [结论]: 本文件仅为 `@deprecated` 的 re-export，不含任何业务逻辑；策划侧「散落物资 / 初始分布」的实质能力不在此文件实现。
- [依据与差距说明]: `oh-code-design/地图系统.yaml` 在「核心数据 → 初始地图快照」中要求 **初始物资分布**；`oh-code-design/实体系统.yaml` 在「核心数据 → 物资实体」中要求 **位置、可拾取标记、容器关系** 等字段。当前散落物的运行时展示已部分由 `WorldEntitySnapshot` 与 `ground-items-renderer` 等路径承接（见 `src/scenes/renderers/ground-items-renderer.ts`、`src/data/grid-cell-info.ts` 对 `ground-items` 的直接引用）。**就本文件而言**不存在「文档点名要求在本路径实现却未写」的漏项；若论端到端缺口，应记在 `src/data/ground-items.ts` 的静态 Mock 与真实实体/快照未完全合一上，而非本条转发层。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 1–3 行将 `../data/ground-items` 的类型与符号以 **`MockGroundItemStack` / `mockGroundItemAt`** 等 Mock 语义别名再导出，并保留 `MOCK_SCATTERED_GROUND_ITEMS` 原名转发，属于技能所述「Mock 命名残留 + 兼容层」的典型形态。
- [影响]: 全仓 `*.ts`/`*.tsx` 中 **已无** 对 `mock-ground-items`、`mockGroundItemAt`、`MockGroundItemStack` 的 import（除本文件自身），该层对编译产物近乎 **僵尸出口**；但 `docs/ai` 若干文档仍把数据权威写在 `src/scenes/mock-ground-items.ts`，与现状（数据在 `src/data/ground-items.ts`、渲染走 World 快照）**不一致**，易误导后续 Agent 继续从 `scenes/` 找「地面物资 API」。
- [说明]: 与 `oh-gen-doc/地图系统.yaml`、`oh-gen-doc/实体系统.yaml` 中「散落物资 / 初始物资」叙述相比，问题不是「少写了一行兼容」，而是 **多余一层历史路径 + 文档滞后**。

## 3. 架构违规 (Architecture Violations)

- [指控]: 地面掉落物数据与查询的**事实来源**已在 `src/data/ground-items.ts`；在 `scenes/` 下再以 `mock-*` 名义做 barrel 转发，与 `oh-code-design/地图系统.yaml` 所强调的 **空间模型 / 索引 / 投影** 分层意图不符——场景层应消费 **投影或只读查询**，而非长期承载「数据模块的二次入口」。
- [依据]: 同文件头注释已指向正确位置（「使用 `src/data/ground-items.ts`」），说明维护者亦认同 **权威出口应在 data（或未来实体查询投影）**；保留 `scenes/mock-ground-items.ts` 仅满足历史 import 路径，属于分层边界上的 **技术性欠债** 而非正向设计。
- [结论]: 无「运行时越权改核心状态」类硬违规；违规性质为 **模块归属与 API 表意混乱**（轻量但应清理）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0324]: 在允许改 `src/` 的迭代中 **删除** `src/scenes/mock-ground-items.ts`，并再次全仓检索 `mock-ground-items` / `mockGroundItemAt` / `MockGroundItemStack` 确认零引用（含测试与构建脚本）。
- [行动点 #0325]: 将 `docs/ai` 中仍指向 `src/scenes/mock-ground-items.ts` 的说明（如 `docs/ai/integration/2026-04-05-mock-ground-items.md`、`docs/ai/systems/scene-hud/2026-04-05-mock-ground-items.md` 及 `docs/ai/index/system-index.json` 中的路径条目）**改为** `src/data/ground-items.ts` 与当前 `GameScene` / `ground-items-renderer` / `grid-cell-info` 的真实调用关系，避免文档与代码双轨。
- [行动点 #0326]: 中长期按 `oh-code-design/实体系统.yaml` 与 `oh-code-design/地图系统.yaml`，把「格上散落物资」收敛为 **实体目录 + 空间索引上的只读投影**，逐步缩小 `MOCK_SCATTERED_GROUND_ITEMS` 的使用面，避免 Mock 数据与模拟层长期并行。