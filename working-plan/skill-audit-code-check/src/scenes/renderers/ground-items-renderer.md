# 审计报告: src/scenes/renderers/ground-items-renderer.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 设计明确要求地图层展示「标记图标」，本文件对「可拾取」仅用线框颜色区分（`pickupAllowed !== false` 时 `0xc9b87a`，否则 `0x8a8a8a`，约 48、82–83 行），未绘制独立的标记图标资源；若验收以「图标」为准，当前实现属于视觉规格缩水（伐木树木标记不在本文件筛选条件内，应由其它叠加层负责）。
- [依据]: `oh-gen-doc/交互系统.yaml` 中 `交互反馈.视觉反馈.标记显示`（被标记的物资/树木显示对应的标记图标）；`oh-gen-doc/UI系统.yaml` 中 `地图界面.显示内容` 列有「标记图标」；`oh-code-design/UI系统.yaml` 中 `模块.地图叠加反馈层.职责` 含「展示选区框、蓝图虚影、存储区边界、标记图标、进度条」。

- [指控]: `oh-gen-doc/实体系统.yaml` 中物资 `类型` 枚举为「初始物资、木头、包装食品」，而展示文案表 `MATERIAL_DISPLAY`（13–18 行）使用 `wood` / `food` / `stone` / `generic` 等程序枚举键；若策划验收要求类型名称与文档字面一致，需在呈现层或数据映射层显式对齐（不限于本文件，但本文件是玩家可见文案入口之一）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：`collectRenderableResourceItems` 从 `WorldEntitySnapshot` 只读聚合为 `RenderableResourceItem`，`syncGroundResourceItems` 仅操作 Phaser 图形与文本并重用以 `Map` 管理生命周期，符合 `oh-code-design/UI系统.yaml` 目标「以读模型驱动展示，避免 UI 直接承担领域规则」及呈现层职责描述。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0337]: 在地图叠加层按设计补「可拾取」等标记的图标（或 Sprite），与线框/高亮分工清晰，避免仅靠色相表达标记语义。
- [行动点 #0338]: 将 `MATERIAL_DISPLAY`、标签/线框颜色与深度常量（如 depth 33/34）抽为可配置或主题表，便于对齐策划文案与对比度验收。
- [行动点 #0339]: 与策划确认「标记图标」是否仅指可拾取物资，还是包含存储区内展示；本渲染器同时处理 `containerKind` 为 `ground` 与 `zone`（35–36 行），若 zone 内物资不应出现地面线框，需在需求层明确后调整过滤条件。