# 遗留 mock / 双轨实现 / 孤立需求 — 审计基线与报告规范

本目录存放「对照 `oh-gen-doc` 与 `oh-acceptance`、按源码子目录审计」的基线说明与各子报告。本文档**只定义怎么查、报告长什么样、对照哪些文档**，不包含任何具体目录的审计结论。

---

## 本仓初创期理想态（不背负历史 mock / 过渡层）

与 Cursor 规则 [`.cursor/rules/startup-ideal-state.mdc`](../../.cursor/rules/startup-ideal-state.mdc) 对齐：

- 初创阶段实现新功能或重构时，**不要**为兼容历史接口或历史架构而保留过渡层、适配器或双轨 API。
- **不要**因「已有代码这么写」而迁就局部现状；以当前认定的目标设计与领域边界为准。
- **一次性**改到理想状态：该删则删、该并则并、该改名则全量替换；用可重复校验（例如测试）锁住行为，而不是用旧接口兜底。
- 仅当产品明确要求对外稳定契约时，再单独评估兼容策略。

---

## route-demand 口径：需求与文档链路

摘要自 [`.agent/skills/route-demand/SKILL.md`](../../.agent/skills/route-demand/SKILL.md) 与 [`system-registry.md`](../../.agent/skills/route-demand/references/system-registry.md)：

- 多系统或玩法类需求应先经 **route-demand** 拆到九个一级系统（见注册表），再进入下游。
- **固定推进顺序**：`oh-gen-doc`（需求事实源）→ `oh-code-design`（代码设计）→ `oh-acceptance`（验收）→ TDD / 实现；路由阶段**不要**跳过前置文档直接写代码。
- `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 中 **system 与文件名一一对应**；缺文件时应先补齐同名文档再继续。
- 模块定位可配合 aidoc（见 [`.agent/skills/lookup-module-with-aidoc/SKILL.md`](../../.agent/skills/lookup-module-with-aidoc/SKILL.md)），但**不替代** route-demand 对多系统需求的路由。

本审计任务将代码中的 mock、双轨与「未入文档的能力」对照 **`oh-gen-doc` 与 `oh-acceptance`**（必要时在子报告中点名 `oh-code-design`），与上述链路一致：**实现应在文档承诺之内**；文档未记载却长期存在的行为，按下面「孤立需求」操作定义处理。

---

## 三类问题的操作定义

以下三类用于**定性打标**，判断是否成立须结合：`rg`/阅读所得事实、对外引用关系、以及下方对照清单中的 YAML。

### 无用兼容（历史包袱型分支）

- **含义**：仅为兼容已废弃的调用方式、旧场景、旧数据形状或已不存在的「演示路径」而保留的分支、适配器、别名或配置开关。
- **如何判断**：在 `oh-gen-doc` / `oh-acceptance` 中**找不到**对应承诺，或文档已明确新契约但代码仍保留「兼容旧接口」路径；且通过简单检索引用可判断主路径已不再需要该分支（或注释/命名直接标明 legacy、compat、旧 bridge 等）。**注意**：未读文档前勿定论；属于「文档已删、代码未跟」或「代码多出来」均可能归此类。

### 多套并行（双轨 / 重复实现）

- **含义**：同一职责存在两套（或以上）并行入口：例如真实 World 与 mock port、两套命令提交链、两处生成同类数据、或 domain 与 scene 各维护一份同类状态且未单一事实来源。
- **如何判断**：两条链路能达到**相似对外效果**或维护**重叠概念**（同一验收维度下），且缺少统一抽象或明确「仅测试用」边界；命名上常见 mock、adapter、stub、fake、双轨、bridge 或与 `src/player`、`src/scenes` 重复的 domain 逻辑。**注意**：测试替身与生产路径分离且文档登记的 fake/stub 边界不自动算问题，须对照 route-demand 中「显式登记的 stub」表述。

### 孤立需求（未文档化的产品意图）

- **含义**：代码或数据表现出一个**稳定的玩法/UI/规则行为**，但在 `oh-gen-doc` 与 `oh-acceptance` 的对应子系统中**均无条款或验收**支撑；或仅有局部注释/旧策划描述而从未进入 YAML 需求事实源。
- **如何判断**：能描述「玩家可见结果或领域承诺」却无法在相关系统的 YAML 中找到对应条目；或行为只出现在单测、场景 mock、静态表中且与任一 `oh-acceptance` 用例无关。**注意**：属「该进文档」的发现，是否删除代码需产品/策划确认，本阶段只记录与分类。

---

## renhua：子报告正文结构要求

各目录检查报告（各 `*.md` 子文件）**须遵循** [`.cursor/skills/renhua/SKILL.md`](../../.cursor/skills/renhua/SKILL.md) 的**金字塔结构**与语气：

- **通俗中文**，结论先行；区分「文档目标 / 验收承诺」与「代码事实」，二者不一致须写明。
- 推荐小节骨架与任务树一致，至少包含：`## 一句结论`、`## 要解决什么问题`（审计视角）、`## 设计上怎么应对`（应然与现状偏差）、`## 代码里大致怎么走`（入口与协作，短述）、`## 尚不明确或需要产品/策划拍板`；文末可附问题清单（标注类型：无用兼容 / 多套并行 / 孤立需求）。

---

## 后续子报告命名规则（与任务树一致）

| 报告文件 | 对应审计范围（概要） |
| --- | --- |
| `src-game-behavior.md` | `src/game/behavior/` |
| `src-game-building.md` | `src/game/building/` |
| `src-game-entity.md` | `src/game/entity/` |
| `src-game-flows.md` | `src/game/flows/` |
| `src-game-interaction.md` | `src/game/interaction/` |
| `src-game-map.md` | `src/game/map/` |
| `src-game-need.md` | `src/game/need/` |
| `src-game-time.md` | `src/game/time/` |
| `src-game-work.md` | `src/game/work/` |
| `src-game-root.md` | `src/game/` 根目录单层 `.ts` 与 `src/game/util/` |
| `src-scenes.md` | `src/scenes/` |
| `src-player.md` | `src/player/` |
| `src-ui.md` | `src/ui/` |
| `src-data.md` | `src/data/` |
| `src-headless.md` | `src/headless/` |
| `src-runtime-log.md` | `src/runtime-log/` |
| `src-entry.md` | `src/main.ts`、`src/vite-env.d.ts` 等入口 |
| `repo-tests-and-data.md` | 仓库根目录 `tests/`、`data/` |
| `INDEX.md` | 汇总全部子报告链接与风险归类（收尾任务） |

---

## 对照清单：`oh-gen-doc` 与 `oh-acceptance` 全部 YAML

以下按九个一级系统（与 `route-demand` 注册表一致）列出当前仓库内全部结构化需求/验收文件名，供各子报告逐项对照。

| system | oh-gen-doc | oh-acceptance |
| --- | --- | --- |
| UI系统 | `oh-gen-doc/UI系统.yaml` | `oh-acceptance/UI系统.yaml` |
| 交互系统 | `oh-gen-doc/交互系统.yaml` | `oh-acceptance/交互系统.yaml` |
| 地图系统 | `oh-gen-doc/地图系统.yaml` | `oh-acceptance/地图系统.yaml` |
| 实体系统 | `oh-gen-doc/实体系统.yaml` | `oh-acceptance/实体系统.yaml` |
| 工作系统 | `oh-gen-doc/工作系统.yaml` | `oh-acceptance/工作系统.yaml` |
| 建筑系统 | `oh-gen-doc/建筑系统.yaml` | `oh-acceptance/建筑系统.yaml` |
| 时间系统 | `oh-gen-doc/时间系统.yaml` | `oh-acceptance/时间系统.yaml` |
| 行为系统 | `oh-gen-doc/行为系统.yaml` | `oh-acceptance/行为系统.yaml` |
| 需求系统 | `oh-gen-doc/需求系统.yaml` | `oh-acceptance/需求系统.yaml` |

**文件名列表（仅文件名）**

- **oh-gen-doc（9）**：`UI系统.yaml`、`交互系统.yaml`、`地图系统.yaml`、`实体系统.yaml`、`工作系统.yaml`、`建筑系统.yaml`、`时间系统.yaml`、`行为系统.yaml`、`需求系统.yaml`
- **oh-acceptance（9）**：与上表九个子系统同名，共九个 `*.yaml` 文件

---

## 全局检索关键词建议（优先 `rg`）

后续按目录审计时，可在目标路径下组合检索（按需增删同义词）：

`mock`、`legacy`、`compat`、`deprecated`、`temporary`、`TODO`、`FIXME`、`hack`、`双轨`、`adapter`、`假数据`、`占位`、`旧`、`v1`、`stub`、`placeholder`、`fake`、`bridge`、`shim`、`过渡`、`演示`

提示：命中仅作线索；须结合引用链与上文三类操作定义打标，避免把已文档化的测试替身一律判为问题。
