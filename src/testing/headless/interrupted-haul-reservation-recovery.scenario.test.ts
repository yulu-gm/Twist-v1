/**
 * @file interrupted-haul-reservation-recovery.scenario.test.ts
 * @description 中断搬运后的预约恢复场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { interruptedHaulReservationRecoveryScenario } from '@testing/scenarios/interrupted-haul-reservation-recovery.scenario';

describe('interruptedHaulReservationRecoveryScenario', () => {
  it('releases reservations after interruption and allows another pawn to finish the delivery chain', async () => {
    const result = await runHeadlessScenario(interruptedHaulReservationRecoveryScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
  });
});
