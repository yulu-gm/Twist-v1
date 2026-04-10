/**
 * @file tool-mode-bar.tsx
 * @description 底部工具栏组件 — 分组显示所有工具按钮，支持选中高亮和快捷键提示
 * @dependencies build.schemas — toolActions, utilityButtons；build.types — ToolActionDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { toolActions, utilityButtons } from '../build.schemas';
import type { ToolActionDef } from '../build.types';

/** ToolModeBar 组件属性 */
interface ToolModeBarProps {
  /** 当前激活的工具动作 ID（用于高亮） */
  activeToolId: string;
  /** 工具按钮点击回调 */
  onActivate: (action: ToolActionDef) => void;
}

/**
 * 底部工具模式栏 — 水平排列的分组工具按钮
 *
 * 按 group 字段将工具分组显示，组间用分隔线隔开。
 * 末尾追加实用按钮组（暂停/存档/调试），仅显示快捷键提示。
 */
export function ToolModeBar({ activeToolId, onActivate }: ToolModeBarProps) {
  // 按 group 字段分组
  const groups = new Map<number, ToolActionDef[]>();
  for (const action of toolActions) {
    const g = groups.get(action.group) ?? [];
    g.push(action);
    groups.set(action.group, g);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <nav class="tool-mode-bar">
      {sortedGroups.map(([groupIdx, actions], idx) => (
        <>
          {idx > 0 && <div class="tool-mode-bar__sep" />}
          <div class="tool-mode-bar__group" key={groupIdx}>
            {actions.map(action => (
              <button
                key={action.id}
                class={`tool-mode-bar__btn ${activeToolId === action.id ? 'is-active' : ''}`}
                onClick={() => onActivate(action)}
                aria-label={action.label}
              >
                [{action.hotkey}] {action.label}
              </button>
            ))}
          </div>
        </>
      ))}
      {/* 实用按钮组 — 仅显示快捷键提示，实际操作由键盘处理 */}
      <div class="tool-mode-bar__sep" />
      <div class="tool-mode-bar__group">
        {utilityButtons.map(btn => (
          <span class="tool-mode-bar__btn" key={btn.label}>
            [{btn.hotkey}] {btn.label}
          </span>
        ))}
      </div>
    </nav>
  );
}
