/**
 * @file tool-mode-bar.tsx
 * @description 底部工具栏组件 — 分组显示所有工具按钮，支持选中高亮和快捷键提示
 * @dependencies build.schemas — toolActions, utilityButtons；build.types — ToolActionDef
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { toolActions, utilityButtons } from '../build.schemas';
import type { ToolActionDef } from '../build.types';

/** ToolModeBar 组件属性 */
interface ToolModeBarProps {
  /** 当前激活的工具动作 ID（用于高亮） */
  activeToolId: string;
  /** 当前工具类型（用于判断区域菜单主按钮高亮） */
  activeTool: string;
  /** 工具按钮点击回调 */
  onActivate: (action: ToolActionDef) => void;
}

/**
 * 底部工具模式栏 — 水平排列的分组工具按钮
 *
 * 按 group 字段将工具分组显示，组间用分隔线隔开。
 * 区域工具组以下拉菜单方式展示子类型（存储区/种植区/动物区）。
 * 末尾追加实用按钮组（暂停/存档/调试），仅显示快捷键提示。
 */
export function ToolModeBar({ activeToolId, activeTool, onActivate }: ToolModeBarProps) {
  /** 区域下拉菜单是否展开 */
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);
  /** 区域菜单容器引用（用于点击外部关闭） */
  const zoneWrapRef = useRef<HTMLDivElement>(null);

  // 按 group 字段分组
  const groups = new Map<number, ToolActionDef[]>();
  for (const action of toolActions) {
    const g = groups.get(action.group) ?? [];
    g.push(action);
    groups.set(action.group, g);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);

  /** 切换区域下拉菜单开关 */
  const toggleZoneMenu = useCallback(() => {
    setZoneMenuOpen(prev => !prev);
  }, []);

  /** 区域子项点击 — 激活工具并关闭菜单 */
  const handleZoneOption = useCallback((action: ToolActionDef) => {
    onActivate(action);
    setZoneMenuOpen(false);
  }, [onActivate]);

  /** 非区域工具点击 — 激活工具并关闭区域菜单 */
  const handleNonZoneTool = useCallback((action: ToolActionDef) => {
    onActivate(action);
    setZoneMenuOpen(false);
  }, [onActivate]);

  // 点击区域菜单外部时关闭菜单
  useEffect(() => {
    if (!zoneMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (zoneWrapRef.current && !zoneWrapRef.current.contains(e.target as Node)) {
        setZoneMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [zoneMenuOpen]);

  // 切换到非区域工具时自动关闭菜单
  useEffect(() => {
    if (activeTool !== 'zone') {
      setZoneMenuOpen(false);
    }
  }, [activeTool]);

  return (
    <nav class="tool-mode-bar">
      {sortedGroups.map(([groupIdx, actions], idx) => {
        // 判断是否为区域工具组（含 isZoneToggle 的组）
        const isZoneGroup = actions.some(a => a.isZoneToggle);

        return (
          <>
            {idx > 0 && <div class="tool-mode-bar__sep" />}
            {isZoneGroup ? (
              /* 区域工具组 — 下拉菜单布局 */
              <div class="tool-mode-bar__group zone-tool-group" key={groupIdx} ref={zoneWrapRef}>
                <div class="zone-menu-wrap">
                  {/* 区域子类型下拉菜单 */}
                  <div class={`zone-menu${zoneMenuOpen ? ' open' : ''}`}>
                    {actions.filter(a => a.zoneType && !a.isZoneToggle).map(action => (
                      <button
                        key={action.id}
                        class={`tool-mode-bar__btn tool-mode-bar__btn--secondary zone-option${activeToolId === action.id ? ' active' : ''}`}
                        onClick={() => handleZoneOption(action)}
                        aria-label={action.label}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                  {/* 区域主按钮 — 点击展开/收起菜单 */}
                  {actions.filter(a => a.isZoneToggle).map(action => (
                    <button
                      key={action.id}
                      class={`tool-mode-bar__btn zone-main-btn${activeTool === 'zone' ? ' active' : ''}${zoneMenuOpen ? ' open' : ''}`}
                      onClick={toggleZoneMenu}
                      aria-expanded={zoneMenuOpen}
                      aria-label={action.label}
                    >
                      {action.hotkey ? `[${action.hotkey}] ` : ''}{action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* 普通工具组 */
              <div class="tool-mode-bar__group" key={groupIdx}>
                {actions.map(action => {
                  const btnClass = [
                    'tool-mode-bar__btn',
                    activeToolId === action.id ? 'is-active' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button
                      key={action.id}
                      class={btnClass}
                      onClick={() => handleNonZoneTool(action)}
                      aria-label={action.label}
                    >
                      {action.hotkey ? `[${action.hotkey}] ` : ''}{action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })}
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
