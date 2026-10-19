import React, { useState } from 'react';
import type { GeometryRelation } from '../analysis/geometryTypes';
import { formatEquation, formatRelation } from '../analysis/presentation/formatRelation';

export const ConditionalDetails: React.FC<{ relation: GeometryRelation }> = ({ relation }) => {
  const [visible, setVisible] = useState(16);
  const { support, family } = relation;
  return <>
    {support && <p>Information: {support.effective.join(', ')}{support.frame.length > 0 ? `; reference only: ${support.frame.join(', ')}` : ''}{support.assumptions?.length ? `; background: ${support.assumptions.join(', ')}` : ''}.
      {support.guards.length > 0 && <> Nonzero length guards: {support.guards.map((segment) => segment.join('·')).join(', ')}.</>}</p>}
    {!family && relation.witnesses[0].conditions?.map((condition, i) => <p key={`condition:${i}`}>{condition.background ? 'Background' : 'Remaining condition'}: {formatEquation(condition.equation)}.
      {condition.locus && <> {condition.locus.point} lies on the perpendicular bisector of {condition.locus.segment.join('·')}.</>}</p>)}
    {family && <div className="space-y-1">
      <p>Verified bindings only; no arbitrary point or untested combination is implied.</p>
      {family.commonConditions.map((condition, i) => <p key={`common:${i}`}>Common condition: {formatEquation(condition.equation)}</p>)}
      {family.instances.slice(0, visible).map((instance) => <div key={instance.sourceId}>
        <p>{instance.binding}: {formatRelation({ ...relation, family: undefined }, instance.witness)}</p>
        {instance.witness.conditions?.filter((condition) => !condition.background).map((condition, i) => <p key={i}>↳ {formatEquation(condition.equation)}</p>)}
      </div>)}
      {family.instances.length > visible && <button type="button" className="text-sky-700 hover:underline" onClick={() => setVisible(visible + 16)}>Show more ({family.instances.length - visible} remaining)</button>}
    </div>}
    {relation.witnesses[0].angleAliases?.map((alias, i) => <p key={`ray:${i}`}>Same-ray endpoints for ∠({alias.angle.join('·')}): {alias.endpoints.map((names) => `{${names.join(', ')}}`).join(' / ')}.</p>)}
  </>;
};
