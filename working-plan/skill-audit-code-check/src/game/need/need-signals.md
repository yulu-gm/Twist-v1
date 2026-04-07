# 审计报告: src/game/need/need-signals.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `needSignalsFromNeeds` 仅根据 `needs.hunger` 与 `needs.rest` 生成紧急度与 `summaryLine`，完全未消费 `PawnNeeds` 中的 `recreation`；而 `need-utils.ts` 的 `advanceNeeds` / `applyNeedDelta` 会同步演化 `recreation`，UI/行为层若只读本快照则看不到娱乐类压力。
- [依据]: `oh-code-design/需求系统.yaml` 中「为行为系统提供可排序、可解释的需求压力输入」「扩展点：可新增更多需求类型」；实体侧 `PawnNeeds`（见 `pawn-state.ts`）已包含 `recreation`，与「统一压力输入」方向不一致。策划文档 `oh-gen-doc/需求系统.yaml` 当前条目仅列饱食度与精力值，若 `recreation` 为原型占位，应在需求投影层显式约定「暂不输出」以免与类型不同步。

- [指控]: 警戒/紧急区间与「是否允许打断工作」均以文件内魔法数实现（`HUNGER_*`、`REST_*`），未对接设计中的规则配置载体。
- [依据]: `oh-code-design/需求系统.yaml`「阈值规则集」职责为定义正常/警戒/紧急区间；「需求规则配置」关键字段含警戒阈值、紧急阈值；「需求行动建议」含是否允许打断当前工作。当前实现将规则与投影混在同一薄文件中，缺少可替换的规则数据源（与同一 YAML「风险：需求阈值若只靠固定数值，后续很难表达角色差异」相呼应，属于实现上提前固化该风险）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 13–16 行字段注释标明「mock：阈值 75」「mock：阈值 80」，与实现中 `allowInterruptWorkForRest` / `allowInterruptWorkForHunger` 直接使用 `REST_CRITICAL`（75）、`HUNGER_CRITICAL`（80）一致，属于将临时阈值当正式契约暴露给类型与调用方。
- [影响]: 调用方（如 `hud-manager`）可能误以为已是策划锁定规则；实际仍为占位，后续替换阈值时易产生静默行为变化或不敢删注释导致的「永久 mock」技术债。

- [指控]: `pawn-state` 中 `needs` 已标注过渡与 `@deprecated`（优先 `satiety` / `energy`），本模块仍仅从 `PawnNeeds` 取数，未与实体侧主字段对齐。
- [影响]: 若运行时以 `satiety`/`energy` 为真源而 `needs` 双写不同步，本函数输出的紧急度可能与展示用实体条不一致（跨文件问题，但本文件是消费者之一）。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：本文件为纯函数映射，不修改小人状态，不直接触碰工作/地图系统；依赖 `PawnNeeds` 类型符合「需求投影层 / 可读信号」的只读消费方向，未出现 UI 或行为层反向写核心数据的越权模式。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0141]: 要么在 `NeedSignalSnapshot` 中增加 `recreationUrgency`（及摘要片段、可选打断建议）并与 `PawnNeeds.recreation` 共用同一套区间规则，要么在类型与文档中明确「当前投影仅覆盖饥饿/疲劳」，避免三字段模型与两字段快照长期分叉。
- [行动点 #0142]: 将警戒/紧急/打断阈值迁入「需求规则配置」或共享模块（与 `oh-code-design` 阈值规则集对齐），删除或改写「mock」注释，使 `need-signals` 仅做「规则 → 快照」的投影。
- [行动点 #0143]: 评估在投影入口统一从 `satiety`/`energy`（或经单一适配器）推导饥饿/疲劳紧迫度，减少对已标记弃用字段的依赖，降低双写不一致风险。