# 审计报告: src/game/need/threshold-rules.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 本文件仅导出 `HUNGER_INTERRUPT_THRESHOLD` 供模拟环释放走向类工单使用，未提供与 `needs.rest`（疲劳紧迫）对称的「走向工单中断」阈值常量；行为策划侧将饱食与精力需求置于同一优先级框架（见 `oh-gen-doc/行为系统.yaml` 中「饱食度或精力值低于阈值（需求优先级高于普通工作）」），而 `oh-code-design/需求系统.yaml` 在接口边界中列出「提供给工作系统的可打断信号」，当前阈值集合在「饥饿单轴」上更完整、在「疲劳/休息」轴上未在同一模块收口。
- [依据]: `oh-code-design/需求系统.yaml` — 接口边界 · 输出 · 「提供给工作系统的可打断信号」；`oh-gen-doc/行为系统.yaml` — 需求驱动行为与「饱食度或精力值低于阈值」条件。

- [指控]: `oh-code-design/需求系统.yaml` 将「需求规则配置」抽象为含警戒阈值、紧急阈值等字段的配置载体，并在风险中明确「需求阈值若只靠固定数值，后续很难表达角色差异」；本文件全部阈值为模块内字面常量，未体现可注入配置或按实体/角色覆盖，与设计中的可演进配置形态存在差距（能力未落地，而非单文件语法缺失）。
- [依据]: `oh-code-design/需求系统.yaml` — 核心数据「需求规则配置」；同文件「风险」段落。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（本文件无 `mock`/`temp`/`TODO` 占位分支；常量与函数均为当前决策链直接消费。）

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。（本文件为纯常量与纯函数，未越权写入实体/世界状态，未直接依赖 UI；职责上贴近 `oh-code-design/需求系统.yaml` 中「阈值规则集」——定义区间并将数值映射为阶段与建议行动。）

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0147]: 若行为/工单层补齐「疲劳紧迫释放走向工单」，在 `threshold-rules.ts` 或统一的「需求规则配置」中增加与 `HUNGER_INTERRUPT_THRESHOLD` 对称的 rest 轴常量，并与 `sim-loop` 等调用方对齐量纲（`needs.rest` 越高越紧迫）。
- [行动点 #0148]: 将警戒/紧急数值与工单中断阈值纳入同一份策划可调的规则配置（回应 `oh-code-design/需求系统.yaml` 中「需求规则配置」与风险项），并推动 `need-signals.ts` 等展示层放弃独立的 magic number，统一引用阈值规则集，避免 UI 信号与模拟打断刻度长期分叉。