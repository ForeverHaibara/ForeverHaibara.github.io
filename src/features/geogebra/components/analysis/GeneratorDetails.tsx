import React from 'react';
import type { DirectionModel, LengthModel } from '../../analysis/geometryTypes';
import { formatLineAngle, presentDirectionModel, presentLengthModel } from '../../analysis/presentation/generatorPresentation';

export const GeneratorDetails: React.FC<{ model?: DirectionModel; lengthModel?: LengthModel }> = ({ model, lengthModel }) => {
  const presentation = model ? presentDirectionModel(model) : lengthModel ? presentLengthModel(lengthModel) : null;
  if (!presentation) return null;
  return <div className="space-y-1">
    {model && <>
      <p>∠(u, v): directed line angle in radians, with the π branch shown in each equation.</p>
      <p>Generators: {model.generators.map((line) => formatLineAngle(model.anchor, line)).join(', ') || 'π'}; {model.constraintRank} new constraints.</p>
      <p>Point stars covered to the seed triangle: {model.pointCover.join(', ')}. Joins between covered points may lie outside this model.</p>
    </>}
    {lengthModel && <>
      <p>Reference length: dist({lengthModel.anchor.join(', ')}).</p>
      <p>Generators: {lengthModel.generators.map((segment) => `dist(${segment.join(', ')})`).join(', ') || 'small rational constants'}; {lengthModel.constraintRank} new constraints.</p>
    </>}
    {presentation.equations.slice(0, 12).map((equation) => <p key={equation}>{equation}</p>)}
    {presentation.equations.length > 12 && <p>{presentation.equations.length - 12} additional grouped equations omitted.</p>}
    {presentation.equations.length === 0 && <p>No additional equations beyond the reference and basis.</p>}
    {/* <p>Reference/basis identities omitted; equivalent members grouped. Bounded numerical fit, not a proof.</p> */}
  </div>;
};
