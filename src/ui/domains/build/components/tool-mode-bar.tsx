/**
 * @file tool-mode-bar.tsx
 * @description 搴曢儴宸ュ叿鏍忕粍浠?鈥?鍒嗙粍鏄剧ず鎵€鏈夊伐鍏锋寜閽紝鏀寔閫変腑楂樹寒鍜屽揩鎹烽敭鎻愮ず
 * @dependencies build.schemas 鈥?toolActions, utilityButtons锛沚uild.types 鈥?ToolActionDef
 * @part-of ui/domains/build 鈥?寤洪€?UI 棰嗗煙
 */

import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { toolActions, utilityButtons } from '../build.schemas';
import type { ToolActionDef } from '../build.types';

interface ToolModeBarProps {
  activeToolId: string;
  activeTool: string;
  onActivate: (action: ToolActionDef) => void;
}

const BUILD_CATEGORY_LABELS: Record<'structure' | 'furniture', string> = {
  structure: 'Structure',
  furniture: 'Furniture',
};

export function ToolModeBar({ activeToolId, activeTool, onActivate }: ToolModeBarProps) {
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);
  const [activeBuildCategory, setActiveBuildCategory] = useState<'structure' | 'furniture'>('structure');
  const zoneWrapRef = useRef<HTMLDivElement>(null);
  const buildWrapRef = useRef<HTMLDivElement>(null);

  const groups = new Map<number, ToolActionDef[]>();
  for (const action of toolActions) {
    const g = groups.get(action.group) ?? [];
    g.push(action);
    groups.set(action.group, g);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);

  const activeBuildAction = toolActions.find(action => action.id === activeToolId);
  const buildActions = toolActions.filter(action => action.buildCategory && !action.isBuildToggle);
  const buildCategories = (['structure', 'furniture'] as const).filter(category =>
    buildActions.some(action => action.buildCategory === category),
  );

  const toggleZoneMenu = useCallback(() => {
    setZoneMenuOpen(prev => !prev);
    setBuildMenuOpen(false);
  }, []);

  const toggleBuildMenu = useCallback(() => {
    setBuildMenuOpen(prev => !prev);
    setZoneMenuOpen(false);
  }, []);

  const handleZoneOption = useCallback((action: ToolActionDef) => {
    onActivate(action);
    setZoneMenuOpen(false);
  }, [onActivate]);

  const handleBuildOption = useCallback((action: ToolActionDef) => {
    onActivate(action);
    setBuildMenuOpen(false);
  }, [onActivate]);

  const handleNonMenuTool = useCallback((action: ToolActionDef) => {
    onActivate(action);
    setZoneMenuOpen(false);
    setBuildMenuOpen(false);
  }, [onActivate]);

  useEffect(() => {
    const activeCategory = activeBuildAction?.buildCategory;
    if (activeCategory) {
      setActiveBuildCategory(activeCategory);
    }
  }, [activeBuildAction?.buildCategory]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (zoneMenuOpen && zoneWrapRef.current && !zoneWrapRef.current.contains(target)) {
        setZoneMenuOpen(false);
      }
      if (buildMenuOpen && buildWrapRef.current && !buildWrapRef.current.contains(target)) {
        setBuildMenuOpen(false);
      }
    };

    if (zoneMenuOpen || buildMenuOpen) {
      document.addEventListener('pointerdown', onPointerDown, true);
      return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }

    return undefined;
  }, [zoneMenuOpen, buildMenuOpen]);

  useEffect(() => {
    if (activeTool !== 'zone') {
      setZoneMenuOpen(false);
    }
    if (activeTool !== 'build') {
      setBuildMenuOpen(false);
    }
  }, [activeTool]);

  return (
    <nav class="tool-mode-bar">
      {sortedGroups.map(([groupIdx, actions], idx) => {
        const isZoneGroup = actions.some(a => a.isZoneToggle);
        const isBuildGroup = actions.some(a => a.isBuildToggle);

        return (
          <>
            {idx > 0 && <div class="tool-mode-bar__sep" />}
            {isBuildGroup ? (
              <div class="tool-mode-bar__group build-tool-group" key={groupIdx} ref={buildWrapRef}>
                <div class="build-menu-wrap">
                  <div class={`build-menu${buildMenuOpen ? ' open' : ''}`}>
                    <div class="build-menu__categories">
                      {buildCategories.map(category => (
                        <button
                          key={category}
                          class={`tool-mode-bar__btn tool-mode-bar__btn--secondary build-category-btn${activeBuildCategory === category ? ' active' : ''}`}
                          onClick={() => setActiveBuildCategory(category)}
                          aria-label={BUILD_CATEGORY_LABELS[category]}
                        >
                          {BUILD_CATEGORY_LABELS[category]}
                        </button>
                      ))}
                    </div>
                    <div class="build-menu__options">
                      {buildActions
                        .filter(action => action.buildCategory === activeBuildCategory)
                        .map(action => (
                          <button
                            key={action.id}
                            class={`tool-mode-bar__btn tool-mode-bar__btn--secondary build-option${activeToolId === action.id ? ' active' : ''}`}
                            onClick={() => handleBuildOption(action)}
                            aria-label={action.label}
                          >
                            {action.label}
                          </button>
                        ))}
                    </div>
                  </div>
                  {actions.filter(a => a.isBuildToggle).map(action => (
                    <button
                      key={action.id}
                      class={`tool-mode-bar__btn build-main-btn${activeTool === 'build' ? ' active' : ''}${buildMenuOpen ? ' open' : ''}`}
                      onClick={toggleBuildMenu}
                      aria-expanded={buildMenuOpen}
                      aria-label={action.label}
                    >
                      {action.hotkey ? `[${action.hotkey}] ` : ''}{action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : isZoneGroup ? (
              <div class="tool-mode-bar__group zone-tool-group" key={groupIdx} ref={zoneWrapRef}>
                <div class="zone-menu-wrap">
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
                      onClick={() => handleNonMenuTool(action)}
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
