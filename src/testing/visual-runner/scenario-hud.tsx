/**
 * @file scenario-hud.tsx
 * @description Scenario HUD — 可视模式中的测试信息面板，并排展示 visual/headless
 *              两个 runner 的步骤队列和分歧信息
 * @dependencies preact — UI 渲染
 * @part-of testing/visual-runner — 可视运行层
 */

import { h } from 'preact';
import type { ScenarioStepStatus } from '../scenario-dsl/scenario.types';
import type { DivergenceRecord } from './shadow-runner';

const scenarioFontFamily =
  '"Cascadia Mono", "Consolas", "Microsoft YaHei UI", "PingFang SC", "Noto Sans Mono CJK SC", monospace';

/** 步骤摘要 — 用于 HUD 展示 */
export interface StepSummary {
  /** 步骤标题 */
  title: string;
  /** 步骤执行状态 */
  status: ScenarioStepStatus;
}

/** HUD 组件属性 */
export interface ScenarioHudProps {
  /** 场景标题 */
  title: string;
  /** 当前 tick */
  currentTick?: number;
  /** 当前步骤标题 */
  currentStepTitle?: string;
  /** Visual Runner 步骤队列 */
  visualSteps: StepSummary[];
  /** Shadow Headless Runner 步骤队列 */
  shadowSteps: StepSummary[];
  /** 分歧信息（null 表示无分歧） */
  divergence: DivergenceRecord | null;
}

/** 步骤状态对应的颜色样式 */
const statusColors: Record<ScenarioStepStatus, string> = {
  pending: '#888',
  running: '#3b82f6',
  passed: '#22c55e',
  failed: '#ef4444',
};

/**
 * 步骤列表渲染
 */
function StepList({ steps, label }: { steps: StepSummary[]; label: string }) {
  return (
    <section style={{ flex: 1, padding: '8px' }}>
      <h2 style={{ fontSize: '14px', marginBottom: '8px', color: '#ddd' }}>{label}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {steps.map((step, i) => (
          <li
            key={i}
            style={{
              padding: '4px 8px',
              marginBottom: '4px',
              borderLeft: `3px solid ${statusColors[step.status]}`,
              color: statusColors[step.status],
              fontSize: '12px',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            [{step.status}] {step.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Scenario HUD 组件 — 并排展示双 runner 队列和分歧面板
 */
export function ScenarioHud(props: ScenarioHudProps) {
  const { title, currentTick, currentStepTitle, visualSteps, shadowSteps, divergence } = props;

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.85)',
        color: '#eee',
        fontFamily: scenarioFontFamily,
        fontSize: '12px',
        overflow: 'auto',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 标题栏 */}
      <header
        style={{
          padding: '12px',
          borderBottom: '1px solid #333',
          backgroundColor: 'rgba(30,30,60,0.9)',
        }}
      >
        <h1 style={{ fontSize: '16px', margin: 0 }}>Scenario: {title}</h1>
        {currentTick != null && (
          <p style={{ margin: '4px 0 0', color: '#aaa' }}>Tick: {currentTick}</p>
        )}
        {currentStepTitle && (
          <p style={{ margin: '4px 0 0', color: '#3b82f6' }}>当前步骤: {currentStepTitle}</p>
        )}
      </header>

      {/* 双列步骤队列 */}
      <div style={{ display: 'flex', flex: 1 }}>
        <StepList steps={visualSteps} label="Visual Runner" />
        <StepList steps={shadowSteps} label="Shadow Headless Runner" />
      </div>

      {/* 分歧面板 */}
      <section
        style={{
          padding: '12px',
          borderTop: '1px solid #333',
          backgroundColor: divergence ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)',
        }}
      >
        <h2 style={{ fontSize: '14px', marginBottom: '8px' }}>分歧</h2>
        {divergence ? (
          <div>
            <p style={{ color: divergence.level === 'error' ? '#ef4444' : '#f59e0b' }}>
              [{divergence.level}] {divergence.field}
            </p>
            <p>Visual: {String(divergence.visualValue)}</p>
            <p>Headless: {String(divergence.headlessValue)}</p>
            <p style={{ color: '#888' }}>Tick: {divergence.tick}</p>
          </div>
        ) : (
          <p style={{ color: '#22c55e' }}>无分歧</p>
        )}
      </section>
    </aside>
  );
}
