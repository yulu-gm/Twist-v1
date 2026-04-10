/**
 * @file scenario-hud.test.tsx
 * @description Scenario HUD 组件测试 — 验证双列布局和分歧面板渲染
 */

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { ScenarioHud } from './scenario-hud';

describe('ScenarioHud', () => {
  it('并排展示 visual 与 headless 两个步骤队列', () => {
    const { container, getByText } = render(
      h(ScenarioHud, {
        title: '砍树',
        visualSteps: [{ title: '下达砍树指令', status: 'running' }],
        shadowSteps: [{ title: '下达砍树指令', status: 'passed' }],
        divergence: null,
      }),
    );

    expect(getByText('Visual Runner')).toBeTruthy();
    expect(getByText('Shadow Headless Runner')).toBeTruthy();
    expect(getByText('Scenario: 砍树')).toBeTruthy();
    expect(getByText('无分歧')).toBeTruthy();
    expect((container.firstElementChild as HTMLElement | null)?.style.fontFamily).toContain('Microsoft YaHei UI');
  });

  it('有分歧时展示分歧面板', () => {
    const { getByText } = render(
      h(ScenarioHud, {
        title: '砍树',
        visualSteps: [],
        shadowSteps: [],
        divergence: {
          level: 'error',
          field: 'pawns[p1].jobDefId',
          visualValue: null,
          headlessValue: 'job_cut',
          tick: 10,
        },
      }),
    );

    expect(getByText(/pawns\[p1\]\.jobDefId/)).toBeTruthy();
    expect(getByText(/error/)).toBeTruthy();
  });
});
