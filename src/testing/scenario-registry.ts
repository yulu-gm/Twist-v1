/**
 * @file scenario-registry.ts
 * @description 场景注册表 — 集中管理所有可运行的业务场景。
 *              从基础正向链路到复杂中断恢复，由浅入深便于回归套件从轻到重定位问题。
 * @part-of testing — 测试系统
 */

import { woodcuttingScenario } from './scenarios/woodcutting.scenario';
import { stockpileHaulScenario } from './scenarios/stockpile-haul.scenario';
import { eatingScenario } from './scenarios/eating.scenario';
import { blueprintConstructionScenario } from './scenarios/blueprint-construction.scenario';
import { zoneStockpileLifecycleScenario } from './scenarios/zone-stockpile-lifecycle.scenario';
import { quantityHaulStackChainScenario } from './scenarios/quantity-haul-stack-chain.scenario';
import { interruptedHaulReservationRecoveryScenario } from './scenarios/interrupted-haul-reservation-recovery.scenario';
import { sleepBedOccupancyScenario } from './scenarios/sleep-bed-occupancy.scenario';
import { bedBlueprintSleepScenario } from './scenarios/bed-blueprint-sleep.scenario';
import { blueprintSelfOccupancyPromoteScenario } from './scenarios/blueprint-self-occupancy-promote.scenario';
import { blueprintOversupplyHaulScenario } from './scenarios/blueprint-oversupply-haul.scenario';
import { blueprintMultiPawnOversupplyScenario } from './scenarios/blueprint-multipawn-oversupply.scenario';
import { todSleepRhythmScenario } from './scenarios/tod-sleep-rhythm.scenario';
import { bedBlueprintRoomOccupancyStallScenario } from './scenarios/bed-blueprint-room-occupancy-stall.scenario';
import type { ScenarioDefinition } from './scenario-dsl/scenario.types';

/** 所有已注册的业务场景 */
export const scenarioRegistry: readonly ScenarioDefinition[] = [
  woodcuttingScenario,
  stockpileHaulScenario,
  eatingScenario,
  blueprintConstructionScenario,
  zoneStockpileLifecycleScenario,
  quantityHaulStackChainScenario,
  interruptedHaulReservationRecoveryScenario,
  sleepBedOccupancyScenario,
  bedBlueprintSleepScenario,
  blueprintSelfOccupancyPromoteScenario,
  blueprintOversupplyHaulScenario,
  blueprintMultiPawnOversupplyScenario,
  todSleepRhythmScenario,
  bedBlueprintRoomOccupancyStallScenario,
] as const;
