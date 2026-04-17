---
name: project-overview
description: Twist-v1 项目概况 — 异星边疆补给殖民地 colony sim，熟人自立+工坊化成长，TS+Vite+Phaser+Preact
type: project
---

Twist-v1 是一款 **colony sim**，初创阶段，无线上环境。当前最新方向定位（2026-04-16 内容总设）：

**世界观与第一版主题：** `《赫斯珀拉-IV：边疆补给殖民地》`
- 异星边疆 `白砾边区`，玩家从原聚落 `灰堤聚落` 脱离，带 2-3 名熟人开拓新据点
- 第一版核心图景：把一个开拓点经营成有稳定生活、有基础产业链、有成员层次、有对外声望的 **边疆补给殖民地**
- 三阶段成长线：`生存定居期` → `立足成长期` → `承接订单期`（由 `浅湾聚落` 紧急供货事件触发）
- 代表性外供产品：`边疆综合补给品`（简易工具、替换件、容器、包装物、基础耗材）
- 四条产业链：食物与保藏、纤维与生活材料、回收与基础加工、工具与补给品制造
- 三类外部势力：零散聚落、流动网络（游商）、强势集体（`远井开发合同体`、`谷岬定居联盟`）

**上位方向（2026-04-15）：** 不是"更轻的 RimWorld"，而是把复杂度从物理级细节转移到 **社会组织与经营系统**。乐趣来自熟人网络扩张、分工经营和组织成长，而非微观物理涌现。

**技术栈：** TypeScript + Vite + Phaser 3（渲染） + Preact（UI）+ Vitest（测试）

**核心架构：** 确定性模拟 / 渲染-UI 分离
- Simulation 层：World、GameMap、Pawn、Item、Building 等实体，通过 8 阶段固定 tick 顺序更新
- 渲染层：Phaser 读取 simulation 状态渲染
- UI 层：Preact 通过 snapshot-reader 读取 EngineSnapshot，不直接触碰 World/GameMap

**8 阶段 tick 顺序：** COMMAND_PROCESSING → WORK_GENERATION → AI_DECISION → RESERVATION → EXECUTION → WORLD_UPDATE → CLEANUP → EVENT_DISPATCH

**Why:** 早期被描述为"RimWorld-like"，但 2026-04-15/16 的方向文档与内容总设把项目收敛为 **熟人网络 + 边疆补给经营** 主题，所有子系统 spec 都应服从这一定位。

**How to apply:**
- 设计/讨论新功能时，必须对齐边疆补给殖民地主题，不要按通用 RimWorld 思路展开
- 引用最新内容总设：`docs/superpowers/specs/2026-04-16-first-version-game-content-bible.md`
- 引用上位方向文档：`docs/superpowers/specs/2026-04-15-overall-game-direction-design.md`
- 引用工程总设：`docs/superpowers/specs/2026-04-16-overall-game-design-engineering.md`
- 所有 gameplay 逻辑写在 simulation 层，UI 只读取 snapshot；新增 feature 按 tick phase 注册 system
