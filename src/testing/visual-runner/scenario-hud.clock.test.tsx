import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render, cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';
import { SimSpeed } from '../../core/types';
import { ScenarioHud } from './scenario-hud';

afterEach(() => cleanup());

describe('ScenarioHud clock info', () => {
  it('renders the current scenario time when provided', () => {
    const { getByText } = render(
      h(ScenarioHud, {
        title: '砍树',
        sessionStatus: 'running',
        currentTick: 42,
        currentClockDisplay: 'Year 1, Spring, Day 1, 21:00',
        currentSpeed: SimSpeed.Normal,
        currentSpeedLabel: '1x',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
      }),
    );

    expect(getByText('Time: Year 1, Spring, Day 1, 21:00')).toBeTruthy();
  });
});
