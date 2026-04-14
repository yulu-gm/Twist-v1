/**
 * @file scenario-hud.tsx
 * @description Scenario HUD — 可视工作台中的测试信息面板，
 *              展示会话状态、操作按钮、时间控制、步进调试，
 *              并排展示 visual/headless 两个 runner 的步骤队列和分歧信息
 * @dependencies preact — UI 渲染；core/types — SimSpeed 枚举
 * @part-of testing/visual-runner — 可视运行层
 */

import { h } from 'preact';
import type { ScenarioStepStatus } from '../scenario-dsl/scenario.types';
import type { DivergenceRecord } from './shadow-runner';
import type { ControllerSessionStatus } from './visual-scenario-controller';
import { SimSpeed } from '../../core/types';

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
  /** 场景 ID */
  scenarioId?: string;
  /** 场景标题 */
  title: string;
  /** 会话状态 */
  sessionStatus: ControllerSessionStatus;
  /** 当前 tick */
  currentTick?: number;
  /** 当前场景时间显示 */
  currentClockDisplay?: string;
  /** 当前速度 */
  currentSpeed: SimSpeed;
  /** 当前速度的用户可读 label */
  currentSpeedLabel: string;
  /** 当前步骤标题 */
  currentStepTitle?: string;
  /** Visual Runner 步骤队列 */
  visualSteps: StepSummary[];
  /** Shadow Headless Runner 步骤队列 */
  shadowSteps: StepSummary[];
  /** 分歧信息（null 表示无分歧） */
  divergence: DivergenceRecord | null;
  /** 回调：开始执行 */
  onStart?: () => void;
  /** 回调：暂停 */
  onPause?: () => void;
  /** 回调：恢复 */
  onResume?: () => void;
  /** 回调：重跑 */
  onRestart?: () => void;
  /** 回调：返回场景选择页 */
  onBackToScenarios?: () => void;
  /** 回调：设置速度 */
  onSetSpeed?: (speed: SimSpeed) => void;
  /** 回调：步进指定 tick 数 */
  onStepTicks?: (count: number) => void;
  /** 回调：运行到下一个 gate */
  onRunToNextGate?: () => void;
}

/** 步骤状态对应的颜色样式 */
const statusColors: Record<ScenarioStepStatus, string> = {
  pending: '#888',
  running: '#3b82f6',
  passed: '#22c55e',
  failed: '#ef4444',
};

/**
 * 主操作按钮区 — 根据 session 状态展示对应的主操作
 */
function ActionBar(props: ScenarioHudProps) {
  const { sessionStatus, onStart, onPause, onResume, onRestart, onBackToScenarios } = props;

  return (
    <section style={{ padding: '12px', borderBottom: '1px solid #333', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {/* ready 状态：显示 Start */}
      {sessionStatus === 'ready' && <button onClick={onStart}>Start</button>}
      {/* running 状态：显示 Pause */}
      {sessionStatus === 'running' && <button onClick={onPause}>Pause</button>}
      {/* paused 状态：显示 Resume */}
      {sessionStatus === 'paused' && <button onClick={onResume}>Resume</button>}
      {/* paused/completed/failed 状态：显示 Restart */}
      {(sessionStatus === 'paused' || sessionStatus === 'completed' || sessionStatus === 'failed') && (
        <button onClick={onRestart}>Restart</button>
      )}
      {/* 任何已进入工作台的状态都可返回选择页 */}
      <button onClick={onBackToScenarios}>Back to Scenarios</button>
    </section>
  );
}

/**
 * 时间控制区 — 速度切换和步进调试
 */
function TimeControls(props: ScenarioHudProps) {
  const { sessionStatus, currentSpeed, onSetSpeed, onStepTicks, onRunToNextGate } = props;
  // 步进只在 paused 下可用
  const canStep = sessionStatus === 'paused';
  // 速度切换在非 ready 状态下可用
  const canChangeSpeed = sessionStatus !== 'ready';

  return (
    <section style={{ padding: '12px', borderBottom: '1px solid #333' }}>
      {/* 速度按钮 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Paused} onClick={() => onSetSpeed?.(SimSpeed.Paused)}>Pause</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Normal} onClick={() => onSetSpeed?.(SimSpeed.Normal)}>1x</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.Fast} onClick={() => onSetSpeed?.(SimSpeed.Fast)}>2x</button>
        <button disabled={!canChangeSpeed} data-active={currentSpeed === SimSpeed.UltraFast} onClick={() => onSetSpeed?.(SimSpeed.UltraFast)}>3x</button>
      </div>
      {/* 步进控件 — 只在 paused 下渲染 */}
      {canStep && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => onStepTicks?.(1)}>+1 tick</button>
          <button onClick={() => onStepTicks?.(10)}>+10 ticks</button>
          <button onClick={onRunToNextGate}>Run to Next Gate</button>
        </div>
      )}
    </section>
  );
}

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
 * Scenario HUD 组件 — 工作台控制面板
 * 包含会话头部、主操作区、时间控制区、步骤队列和分歧面板
 */
export function ScenarioHud(props: ScenarioHudProps) {
  const {
    scenarioId,
    title,
    sessionStatus,
    currentTick,
    currentClockDisplay,
    currentSpeed,
    currentSpeedLabel,
    currentStepTitle,
    visualSteps,
    shadowSteps,
    divergence,
  } = props;

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
      {/* 会话头部 — 展示场景元信息和当前状态 */}
      <header
        style={{
          padding: '12px',
          borderBottom: '1px solid #333',
          backgroundColor: 'rgba(30,30,60,0.9)',
        }}
      >
        <h1 style={{ fontSize: '16px', margin: 0 }}>Scenario: {title}</h1>
        {scenarioId && <p style={{ margin: '4px 0 0', color: '#93c5fd' }}>ID: {scenarioId}</p>}
        <p style={{ margin: '4px 0 0', color: '#aaa' }}>Status: {sessionStatus}</p>
        <p style={{ margin: '4px 0 0', color: '#aaa' }}>Tick: {currentTick ?? 0}</p>
        {currentClockDisplay && (
          <p style={{ margin: '4px 0 0', color: '#aaa' }}>Time: {currentClockDisplay}</p>
        )}
        <p style={{ margin: '4px 0 0', color: '#aaa' }}>Speed: {currentSpeedLabel}</p>
        {currentStepTitle && (
          <p style={{ margin: '4px 0 0', color: '#3b82f6' }}>当前步骤: {currentStepTitle}</p>
        )}
      </header>

      {/* 主操作区 */}
      <ActionBar {...props} />

      {/* 时间控制区 */}
      <TimeControls {...props} />

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
