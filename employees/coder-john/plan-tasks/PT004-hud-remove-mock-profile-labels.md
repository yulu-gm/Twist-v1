# PT004-HUD 小人详情移除「（mock）」文案计划

## 1. 计划目标

依据 `employees/coder-john/docs/mock-refactor-plan.md` **§5（UI 展示层）**：小人档案已接入 `EntityRegistry` 的 `PawnDisplayProfile`（与 `oh-code-design/实体系统.yaml` 小人展示字段一致），应移除详情面板中仍标注「mock」的标签文案，避免与当前数据来源矛盾，并完成该小节所列 UI 清理项中与**文案**直接相关的部分。

本计划话题单一：**只调整 HUD 小人详情相关展示文案与由其决定的模板字符串**，不改动实体结构、不实现新档案字段、不接新数据源。

## 2. 工作内容

1. **定位修改范围**  
   - 文件：`src/ui/hud-manager.ts` 内渲染小人详情（含 `pawn-detail-label`、`pawn-detail-section` 等）的 HTML 片段。  
   - 将「简介（mock）」「备注（mock）」「标签（mock）」改为与真实数据语义一致的中性标签（例如「简介」「备注」「标签」），不与策划最终用语冲突即可。

2. **一致性检查**  
   - 全文检索 `hud-manager` 或相关 UI 中小人详情路径是否仍有「（mock）」或仅用于提示假数据的固定前缀；有则一并按同样原则处理。  
   - 不修改 `PawnDisplayProfile` 字段名 `mockTags`（属类型/数据模型，本计划不纳入）；若仅标签栏标题去掉 mock，列表内容仍来自 `profile.mockTags`。

3. **禁止范围**  
   - 不修改 `src/data/grid-cell-info.ts` 等地形 mock、不修改任务标记/工作系统、不调整 `entity-system.ts` 种子档案正文中的叙述性「mock：」字符串（与 §5 无关）。

## 3. 验收标准

- 玩家打开小人详情时，板块标题不再出现「（mock）」字样；数据仍来自现有 `syncPawnDetail` / `PawnDisplayProfile` 路径。  
- `npm run build` 编译通过。  
- 与 PT001～PT003 无重叠：不涉及工作目录、实体生命周期、实体目录结构。
