/**
 * @file tool-mode-bar.tsx
 * @description 底部命令栏组件 — 渲染当前层级的统一方块列表，包含返回项、分支与叶子
 * @dependencies build.types — CommandMenuViewModel, ToolActionDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import type { CommandMenuViewModel, ToolActionDef } from '../build.types';

interface ToolModeBarProps {
  /** 当前层级菜单视图模型（来自 selectCommandMenuViewModel） */
  menu: CommandMenuViewModel;
  /** 叶子条目被触发时回调（点击或快捷键） */
  onActivate: (action: ToolActionDef) => void;
  /** 分支条目被触发时回调，传入 branchId 以便压栈 */
  onEnterBranch: (branchId: string) => void;
  /** 返回条目被触发时回调，由调用方决定如何退栈 */
  onBack: () => void;
}

/**
 * 底部命令栏 — 当前层级的方块列表
 *
 * 不维护任何本地展开/收起 state；所有状态由 PresentationState 持有，
 * 通过 selectCommandMenuViewModel 投影成视图模型再渲染。
 */
export function ToolModeBar({ menu, onActivate, onEnterBranch, onBack }: ToolModeBarProps) {
  return (
    <nav class="tool-command-bar" aria-label="命令栏">
      {menu.entries.map((entry) => {
        const className = ['tool-command-bar__entry', entry.active ? 'is-active' : '']
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={entry.id}
            type="button"
            class={className}
            aria-label={entry.label}
            onClick={() => {
              if (entry.kind === 'back') {
                onBack();
                return;
              }
              if (entry.kind === 'branch' && entry.branchId) {
                onEnterBranch(entry.branchId);
                return;
              }
              if (entry.kind === 'leaf' && entry.action) {
                onActivate(entry.action);
              }
            }}
          >
            <span class="tool-command-bar__hint">{entry.shortcut}</span>
            <span class="tool-command-bar__label">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
