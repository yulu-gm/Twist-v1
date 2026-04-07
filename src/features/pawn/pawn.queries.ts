import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Pawn } from './pawn.types';

export function getAllPawns(map: GameMap): Pawn[] {
  return map.objects.allOfKind(ObjectKind.Pawn) as unknown as Pawn[];
}

export function getPawnById(map: GameMap, id: string): Pawn | undefined {
  const obj = map.objects.get(id);
  if (obj && obj.kind === ObjectKind.Pawn) return obj as unknown as Pawn;
  return undefined;
}

export function getIdlePawns(map: GameMap): Pawn[] {
  return getAllPawns(map).filter(p => p.ai.currentJob === null);
}
