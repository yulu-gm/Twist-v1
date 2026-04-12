/**
 * @file pawn-inspector.adapter.ts
 * @description Pawn（殖民者）对象的 Inspector adapter — 从 PawnObjectNode 构建专属视图模型
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorSection } from '../inspector.types';

/** Pawn Inspector adapter — 殖民者专属 Inspector */
export const pawnInspectorAdapter: ObjectInspectorAdapter = {
  id: 'pawn',

  supports(object: ObjectNode): boolean {
    return object.kind === 'pawn';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const pawn = object as import('../../../kernel/ui-types').PawnObjectNode;

    const sections: InspectorSection[] = [
      {
        id: 'overview',
        title: 'Overview',
        rows: [
          { label: 'Job', value: pawn.currentJobLabel },
          { label: 'HP', value: `${pawn.health.hp}/${pawn.health.maxHp}` },
          { label: 'Position', value: `(${pawn.cell.x}, ${pawn.cell.y})` },
        ],
      },
      {
        id: 'needs',
        title: 'Needs',
        rows: [
          { label: 'Food', value: String(pawn.needs.food) },
          { label: 'Rest', value: String(pawn.needs.rest) },
          { label: 'Joy', value: String(pawn.needs.joy) },
          { label: 'Mood', value: String(pawn.needs.mood) },
        ],
      },
    ];

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: pawn.label,
      subtitle: 'Pawn',
      stack: context.stack,
      sections,
      actions: [],
    };
  },
};
