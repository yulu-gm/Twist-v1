# 集成备注：环世界第一天（story-1，2026-04-05）

## 摘要

将 `oh-story/story-1.md` 译为可实现的跨系统流水线：世界布置（出生、白天、散落物）→ 闲逛 → 存储区划定 → 物资标记与搬运 → 伐木读条与产物 → 再搬运入存储区。主控条目见 `docs/ai/requests/2026-04-05-story-1-day-one.md`（R-01～R-10）。

## 端到端数据流（逻辑顺序）

```mermaid
flowchart LR
  subgraph init [开局]
    WG1[world-grid 出生与地图]
    HUD1[scene-hud 白天展示可选 mock]
    ITEM[散落物资 域或 mock]
  end
  subgraph idle [无工]
    TP1[task-planning 闲逛]
    PS1[pawn-state 移动表现]
  end
  subgraph stock [仓储]
    HUD2[scene-hud 存储区新建入口]
    SEL1[selection-ui 框选格]
    WG2[world-grid 存储区占格]
  end
  subgraph haul [搬运]
    SEL2[selection-ui 标记可拾取]
    TP2[task-planning 搬运工单]
    PS2[pawn-state 携带与工步]
  end
  subgraph chop [伐木]
    HUD3[scene-hud 伐木工具]
    SEL3[selection-ui 选树区域]
    TP3[task-planning 伐木工单与读条完成]
    ITEM2[木头生成 域或 mock]
  end
  WG1 --> TP1
  HUD1 --> TP1
  ITEM --> TP2
  TP1 --> PS1
  HUD2 --> SEL1
  SEL1 --> WG2
  WG2 --> TP2
  SEL2 --> TP2
  TP2 --> PS2
  HUD3 --> SEL3
  SEL3 --> TP3
  TP3 --> ITEM2
  ITEM2 --> TP2
```

## 系统交界说明

- **world-grid 与 selection-ui**：框选结果必须落在统一 `GridCoord` 约定上；存储区、待伐木树与可走格子冲突规则要在 domain 侧可以测试，不在场景内隐式猜测。
- **scene-hud 与 selection-ui**：工具模式（存储区新建、伐木、标记可拾取）切换时，选中集合与预览高亮应当一致重置或者继承规则写清楚。
- **task-planning 与 pawn-state**：工单派发、读条、完成回调应当通过明确状态迁移；避免场景直接修改「任务完成」而不经过规划层。
- **物资、树、木头**：如果现在仍然为 `mock-ground-items` 类数据，集成层应当登记「权威状态在场景」的临时边界，与 `requests` 文档中的 fake 或者 stub 一致。

## 待主 agent / 各系统 aidoc 拍板的事项

- 多个存储区并存时，搬运或者伐木产物的**默认落点**（最近、选中、主基地等）。
- 一棵树多名工人、一物多名工人同时搬运时的**确定性**或者**显式随机**策略。
- 「白天」是否绑定未来世界时钟，或者长期仅仅作为表现层。

## 与索引的后续动作（非本轮强制）

如果各个系统 aidoc 落地并且改变行为契约，应当更新 `docs/ai/index/system-index.json` 中相关 `integrationFiles` 或者 `latestAidocs` 引用（遵循 `push-with-aidoc` 工作流）。
