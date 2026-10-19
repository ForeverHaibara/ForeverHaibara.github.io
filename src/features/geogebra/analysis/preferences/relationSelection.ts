import { ALL_RELATION_KINDS } from '../relations/catalog';
import type { GeometryRelationKind } from '../relations/catalog';

export type SelectionAction = 'all' | 'none' | 'invert';
/** A scoped operation preserves preferences outside its scope (including
 * display choices of currently disabled compute types). Catalog order is stable. */
export const changeRelationSelection = (selected: readonly GeometryRelationKind[], scope: readonly GeometryRelationKind[], action: SelectionAction): GeometryRelationKind[] => {
  const current = new Set(selected); const eligible = new Set(scope);
  return ALL_RELATION_KINDS.filter((kind) => eligible.has(kind)
    ? action === 'all' || action === 'invert' && !current.has(kind)
    : current.has(kind));
};
