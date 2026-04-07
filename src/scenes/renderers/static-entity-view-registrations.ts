import type { AnyEntityRenderer, EntityViewRegistration } from "./entity-view-sync";
import { rockEntityRenderer, treeEntityRenderer } from "./rock-tree-renderers";
import { groundMapMaterialRenderer } from "./ground-items-renderer";
import { buildingEntityRenderer } from "./buildings-renderer";

export const STATIC_ENTITY_VIEW_REGISTRATIONS: readonly EntityViewRegistration[] = [
  {
    listEntities: (r) => r.listEntitiesByKind("rock"),
    renderer: rockEntityRenderer as unknown as AnyEntityRenderer
  },
  {
    listEntities: (r) => r.listEntitiesByKind("tree"),
    renderer: treeEntityRenderer as unknown as AnyEntityRenderer
  },
  {
    listEntities: (r) => r.listEntitiesByKind("material"),
    renderer: groundMapMaterialRenderer as unknown as AnyEntityRenderer
  },
  {
    listEntities: (r) => r.listEntitiesByKind("building"),
    renderer: buildingEntityRenderer as unknown as AnyEntityRenderer
  }
];
