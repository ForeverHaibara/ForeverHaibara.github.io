import React from 'react';
import type { GeometryRelation } from '../../analysis/geometryTypes';
import type { ObjectLink } from '../../interaction/useObjectLink';
import { formatQuantityGroup, formatRelation } from '../../analysis/presentation/formatRelation';
import { GeneratorDetails } from './GeneratorDetails';
import { ConditionalDetails } from './ConditionalDetails';

export const RelationDetails: React.FC<{ relation: GeometryRelation; relations: readonly GeometryRelation[]; objectLink: ObjectLink }> = ({ relation, relations, objectLink }) => <div className="space-y-2 text-[10px] text-slate-500">
  <div className="flex flex-wrap gap-1">{relation.pointNames.map((name) => <button key={name} className="ggb-object-chip" aria-pressed={objectLink.selectedNames.includes(name)} onClick={() => objectLink.select(name)} onPointerEnter={() => objectLink.hover(name)} onPointerLeave={() => objectLink.hover(null)} onFocus={() => objectLink.focus(name)} onBlur={() => objectLink.focus(null)}>{name}</button>)}</div>
  <p>{relation.explanation}</p>
  <ConditionalDetails relation={relation} />
  {relation.witnesses[0].equation?.terms.filter((term) => (term.equivalents?.length ?? 0) > 1).map((term, i) => <p key={i}>Equal quantities ({term.equivalents!.length}): {formatQuantityGroup(term.equivalents!, 24)}</p>)}
  {relation.derivedFrom && relation.derivedFrom.length > 0 && <p>Generated from: {relation.derivedFrom.slice(0, 3).map((id) => {
    const parent = relations.find((item) => item.id === id || item.family?.instances.some((instance) => instance.sourceId === id));
    return parent ? formatRelation(parent) : id.startsWith('incidence:') ? `shared line carrier (${id.slice('incidence:'.length).split('|').join(', ')})` : 'an observation outside the retained results';
  }).join('; ')}{relation.derivedFrom.length > 3 ? ' …' : ''}</p>}
  <p>Construction span: {relation.metric.constructionSpan?.toFixed(2) ?? 'disconnected'}; readable dependencies: {(relation.metric.dependencyCoverage * 100).toFixed(0)}%</p>
  {relation.witnesses[0].triangleSymmetryOrder && relation.witnesses[0].triangleSymmetryOrder > 1 && <p>One representative correspondence; numerical triangle symmetry order {relation.witnesses[0].triangleSymmetryOrder}.</p>}
  <GeneratorDetails model={relation.model} lengthModel={relation.lengthModel} />
</div>;
