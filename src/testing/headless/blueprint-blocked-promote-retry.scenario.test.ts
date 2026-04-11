import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintBlockedPromoteRetryScenario } from '@testing/scenarios/blueprint-blocked-promote-retry.scenario';

describe('blueprintBlockedPromoteRetryScenario', () => {
  it('recovers promptly after a temporary footprint blocker leaves a fully delivered blueprint', async () => {
    const result = await runHeadlessScenario(blueprintBlockedPromoteRetryScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    if (result.status !== 'passed') {
      console.log('FINAL SNAPSHOT', JSON.stringify(result.finalSnapshot, null, 2));
    }

    expect(result.status).toBe('passed');
    expect(result.finalSnapshot.buildings.some(b => b.defId === 'bed_wood')).toBe(true);
  });
});
