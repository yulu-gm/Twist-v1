/**
 * @file scenario-registry.ts
 * @description 鍦烘櫙娉ㄥ唽琛?鈥?闆嗕腑绠＄悊鎵€鏈夊彲杩愯鐨勪笟鍔″満鏅€?
 *              浠庡熀纭€姝ｅ悜閾捐矾鍒板鏉備腑鏂仮澶嶏紝鐢辨祬鍏ユ繁渚夸簬鍥炲綊濂椾欢浠庤交鍒伴噸瀹氫綅闂銆?
 * @part-of testing 鈥?娴嬭瘯绯荤粺
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
import type { ScenarioDefinition } from './scenario-dsl/scenario.types';

/** 鎵€鏈夊凡娉ㄥ唽鐨勪笟鍔″満鏅?*/
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
] as const;

