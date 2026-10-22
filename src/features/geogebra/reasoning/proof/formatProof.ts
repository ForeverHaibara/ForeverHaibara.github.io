import type { Ag2Export } from '../backends/ag2/exportProblem';
import type { ProofEquation, ProofNode, ReadableProof } from './types';
import { formatProductEquation, formatProductSum, formatVectorProduct, type VectorNotation } from '../../geometry/vectorProducts';

export const proofRuleLabel = (rule: string): string => ({
  'accepted-condition': 'Given condition', 'predicate-equation': 'Express the given condition as an equation',
  'vector-product-expansion': 'Expand the signed vector product', 'affine-vector-contraction': 'Contract the affine relation with a vector',
  'geometric-vector-product': 'Express parallel or perpendicular directions as a product', 'collinear-vector-product': 'Collinearity gives zero cross product',
  'squared-equal-lengths': 'Express equal lengths using squared norms', 'length-ratio-squared': 'Square the proved positive length ratio',
  'direction-vector-product': 'Transfer the proved direction relation to a vector product',
  'equal-squared-lengths': 'Equal squared norms imply equal lengths', 'zero-product-direction': 'A zero product determines the direction relation',
  'length-angle-product-transfer': 'Transfer equal length products and corresponding angles',
  'similarity-from-bilinear-products': 'The two signed product equations imply reversing similarity',
  'witness-product-angle-lift': 'Ray orientation of the product from the coordinate witness', 'witness-nonzero-vectors': 'Nonzero directions from the coordinate witness',
  'equal-lengths': 'Equal lengths', 'collinear-directions': 'Directions on one line',
  'collinear-from-directions': 'Equal directions imply collinearity', 'join-collinear-sets': 'Join lines with two common points',
  'segment-addition': 'Segment addition', 'positive-length-ratio': 'Convert a positive length ratio',
  'sss-similarity': 'SSS similarity', 'aa-similarity': 'AA similarity', 'sas-similarity': 'SAS similarity',
  'similarity-side-ratios': 'Corresponding sides of similar triangles', 'similarity-angles': 'Corresponding directed angles of similar triangles',
  'inscribed-angle': 'Angles subtending the same chord', 'converse-inscribed-angle': 'Converse of the inscribed-angle theorem',
  'incidence-subset': 'Take a subset of the incidence relation', 'circle-radii': 'Radii of one circle',
  'equal-radii-circle': 'Equal radii define a circle', 'circle-center-from-radii': 'Three equal radii determine the circle center',
  'circle-through-three-points': 'Three noncollinear points determine a circle', 'join-cyclic-sets': 'Join circles with three common noncollinear points',
  'circle-center-from-chord-angle': 'Identify the center from an equal-radius chord and its inscribed angle',
  'radius-chord-angle': 'Radius, chord and inscribed-angle relation',
  'rational-linear-combination': 'Exact rational elimination', 'integer-angle-combination': 'Integer combination modulo π',
  'witness-line-order': 'Point order from the coordinate witness', 'witness-triangle-orientations': 'Triangle orientation from the coordinate witness',
  'witness-noncollinear': 'Noncollinearity from the coordinate witness', 'incompatible-equations': 'Incompatible assumed equations',
  'ordinary-angle-branch': 'Ordinary-angle ray and lift branch from the coordinate witness',
  'failed-coordinate-guard': 'Gap: the required coordinate branch condition failed',
  'unreconstructed-similarity': 'Gap: similarity justification is not reconstructed',
  'unreconstructed-collinearity': 'Gap: collinearity justification is not reconstructed',
  'unreconstructed-circle': 'Gap: circle justification is not reconstructed',
  'unreconstructed-circle-center': 'Gap: circle center justification is not reconstructed',
  'unreconstructed-ddar-conclusion': 'Gap: DDAR knows this conclusion, but its derivation is not reconstructed',
} as Record<string, string>)[rule] ?? rule;

export const proofNames = (value: string, exported: Ag2Export): string => {
  const names = new Map(exported.names.map((entry) => [entry.symbol, entry.name]));
  return value.replace(/\bp\d+\b/g, (symbol) => names.get(symbol) ?? symbol);
};
const expression = (parts: Array<{ text: string; coefficient: string }>): string => parts.filter((part) => part.coefficient !== '0')
  .map(({ text, coefficient }, index) => {
    const negative = coefficient.startsWith('-'); const absolute = negative ? coefficient.slice(1) : coefficient;
    if (text === '°') return `${index ? negative ? ' − ' : ' + ' : negative ? '−' : ''}${absolute.includes('/') ? `(${absolute})` : absolute}°`;
    return `${index ? negative ? ' − ' : ' + ' : negative ? '−' : ''}${absolute === '1' ? '' : `${absolute} × `}${text}`;
  }).join('') || '0';

/** Keep the exact log equation in JSON; show small integer powers as products. */
const lengthProduct = (parts: Array<{ text: string; coefficient: string }>): string | null => {
  if (parts.some((part) => !/^-?\d+$/.test(part.coefficient) || Math.abs(Number(part.coefficient)) > 32)) return null;
  const side = (sign: number) => parts.filter((part) => Number(part.coefficient) * sign > 0).map((part) => {
    const power = Math.abs(Number(part.coefficient));
    return `${part.text}${power === 1 ? '' : power === 2 ? '²' : `^${power}`}`;
  }).join(' · ') || '1';
  return `${side(1)} = ${side(-1)}`;
};

export const formatProofEquation = (equation: ProofEquation, exported: Ag2Export, notation: VectorNotation = 'text'): string => {
  if ((equation.domain === 'dot' || equation.domain === 'cross') && equation.terms.every((term) => /^(dot|cross)\(([^,]+),([^,]+)\)$/.test(term.variable))) {
    const parts = equation.terms.map((term) => {
      const atom = term.variable.match(/^(dot|cross)\(([^,]+),([^,]+)\)$/)!;
      return { coefficient: term.coefficient,
        product: formatVectorProduct(atom[1] as 'dot' | 'cross', [null, atom[2]], [null, atom[3]], (point) => proofNames(point, exported), notation) };
    });
    return `${formatProductSum(parts, notation)} = 0`;
  }
  if (equation.domain === 'length-product' && equation.terms.every((term) => /^log\(.*\)$/.test(term.variable))) {
    const product = lengthProduct(equation.terms.map((term) => ({ text: proofNames(term.variable.slice(4, -1), exported), coefficient: term.coefficient })));
    if (product) return product;
  }
  const symbol = (value: string) => {
    const text = value.replace(/^len\((.*)\)$/, '|$1|').replace(/^log\(\|(.*)\|\)$/, 'log |$1|').replace(/^log\((.*)\)$/, 'log $1').replace(/^pi$/, 'π');
    return proofNames(text, exported);
  };
  return `${expression(equation.terms.map((term) => ({ text: symbol(term.variable), coefficient: term.coefficient })))} = 0${equation.domain === 'angle' ? ' (mod π)' : ''}`;
};

export const formatProofPredicate = (predicate: string, exported: Ag2Export, notation: VectorNotation = 'text'): string => {
  const vector = [...exported.vectorContext?.assumptions ?? [], ...exported.vectorContext?.goals ?? []].find((entry) => entry.key === predicate);
  if (vector) return formatProductEquation(vector.equation, (point) => proofNames(point, exported), notation);
  const [kind, ...tokens] = predicate.split(' ');
  const points = tokens.filter((token) => /^p\d+$/.test(token)); const constants = tokens.slice(points.length);
  const name = (point: string) => proofNames(point, exported);
  const pair = (i: number) => `${name(points[i])}, ${name(points[i + 1])}`;
  if (kind === 'midpoint') return `${name(points[0])} is the midpoint of (${name(points[1])}, ${name(points[2])})`;
  if (kind === 'coll' || kind === 'cyclic') return `${points.map(name).join(', ')} ${kind === 'coll' ? 'are collinear' : 'are concyclic'}`;
  if (kind === 'para' || kind === 'perp') return `(${pair(0)}) ${kind === 'para' ? '∥' : '⊥'} (${pair(2)})`;
  if (kind === 'cong') return `|${pair(0)}| = |${pair(2)}|`;
  if (kind === 'overlap') return `${name(points[0])} = ${name(points[1])}`;
  if (kind === 'angeq' || kind === 'distseq' || kind === 'distmeq') {
    if (kind === 'distmeq') {
      const [numerator, denominator = '1'] = constants[points.length / 2].split('/');
      const product = lengthProduct([...Array.from({ length: points.length / 2 }, (_, i) => ({ coefficient: constants[i], text: `|${pair(2 * i)}|` })),
        ...(numerator === '1' ? [] : [{ text: numerator, coefficient: '1' }]), ...(denominator === '1' ? [] : [{ text: denominator, coefficient: '-1' }])]);
      if (product) return product;
    }
    const parts = Array.from({ length: points.length / 2 }, (_, i) => ({ coefficient: constants[i],
      text: kind === 'angeq' ? `dir(${pair(2 * i)})` : kind === 'distmeq' ? `log |${pair(2 * i)}|` : `|${pair(2 * i)}|` }));
    const tail = constants[points.length / 2];
    if (kind === 'angeq' && tail !== '0') parts.push({ coefficient: tail, text: '°' });
    if (kind === 'distmeq' && tail !== '1') parts.push({ coefficient: '1', text: `log ${tail}` });
    return `${expression(parts)} = 0${kind === 'angeq' ? ' (mod π)' : ''}`;
  }
  return proofNames(predicate, exported);
};

export const formatProofNode = (node: ProofNode, exported: Ag2Export, notation: VectorNotation = 'text'): string => {
  if (node.predicate) return formatProofPredicate(node.predicate, exported, notation);
  if (node.triangles) return node.triangles.map((triangle) => `△(${triangle.map((name) => proofNames(name, exported)).join(', ')})`).join(' ∼ ');
  if (node.ratio && node.equation?.domain === 'length-product') {
    const positive = node.equation.terms.find((term) => term.variable.startsWith('log(|') && term.coefficient === '1');
    const negative = node.equation.terms.find((term) => term.variable.startsWith('log(|') && term.coefficient === '-1');
    if (positive && negative) return `${proofNames(positive.variable.slice(4, -1), exported)} = ${node.ratio} × ${proofNames(negative.variable.slice(4, -1), exported)}`;
  }
  if (node.equation) return formatProofEquation(node.equation, exported, notation);
  if (node.rule === 'ordinary-angle-branch') return `∠(${node.points?.map((name) => proofNames(name, exported)).join(', ')}) · sign ${node.sign}, lift ${node.lift}`;
  if (node.points) return `${node.points.map((name) => proofNames(name, exported)).join(node.rule === 'witness-line-order' ? ' → ' : ', ')}${node.orientation ? ` · ${node.orientation > 0 ? 'matching' : 'opposite'} orientation` : ''}`;
  return proofRuleLabel(node.rule);
};

/** Keep just the chosen conclusion and its actual dependencies for reading. */
export const focusProof = (proof: ReadableProof, nodeId: string | null): ReadableProof => {
  if (!nodeId) return proof;
  const byId = new Map(proof.nodes.map((node) => [node.id, node]));
  const needed = new Set<string>(); const pending = [nodeId];
  while (pending.length) {
    const id = pending.pop()!; if (needed.has(id)) continue;
    needed.add(id); byId.get(id)?.premises.forEach((parent) => pending.push(parent.id));
  }
  const nodes = proof.nodes.filter((node) => needed.has(node.id));
  const gapIds = proof.gapIds.filter((id) => needed.has(id));
  return { ...proof, nodes, conclusions: proof.conclusions.filter((item) => item.nodeId === nodeId),
    assumptionIds: proof.assumptionIds.filter((id) => needed.has(id)), guardIds: proof.guardIds.filter((id) => needed.has(id)), gapIds,
    contradictionIds: proof.contradictionIds.filter((id) => needed.has(id)), explanation: gapIds.length || proof.limited ? 'partial' : 'recorded',
    algebraReplay: { ...proof.algebraReplay, checked: nodes.filter((node) => node.kind === 'algebra' || node.kind === 'contradiction').length } };
};

export const proofToMarkdown = (proof: ReadableProof, exported: Ag2Export): string => {
  const statement = (format: (notation: VectorNotation) => string): string => {
    const text = format('text'); const latex = format('latex');
    return text === latex ? text : `$${latex}$`;
  };
  const indexes = new Map(proof.nodes.map((node, i) => [node.id, i + 1]));
  const lines = ['# Conditional geometry derivation', '', `Mode: ${proof.mode === 'hypothetical' ? 'Symbolic hypotheses' : proof.vectorDiagnostics ? 'DDAR + vector algebra with recorded provenance' : 'DDAR with recorded provenance'}.`,
    `Explanation: ${proof.explanation}. Algebra replay: ${proof.algebraReplay.valid ? 'passed' : 'failed'} (${proof.algebraReplay.checked} steps).`,
    `Coordinate branch guards: ${proof.guardIds.length}. Unreconstructed steps: ${proof.gapIds.length}.`,
    'Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.', ''];
  if (proof.contradictionIds.length) lines.push('Incompatible assumptions were found. No arbitrary conclusions are inferred from this contradiction.', '');
  if (proof.witnessFailures.length) lines.push('## Coordinate disagreements', '', ...proof.witnessFailures.map((failure) => `- ${statement((notation) => formatProofPredicate(failure.predicate, exported, notation))}`), '');
  lines.push('## Steps', '');
  for (const node of proof.nodes) {
    const parents = node.premises.map((parent) => `${parent.coefficient === '1' ? '' : `${parent.coefficient} × `}[${indexes.get(parent.id)}]`).join(', ');
    lines.push(`${indexes.get(node.id)}. ${statement((notation) => formatProofNode(node, exported, notation))}. ${proofRuleLabel(node.rule)}${parents ? `; from ${parents}` : ''}.${node.kind === 'gap' ? ' **Unreconstructed step.**' : node.kind === 'guard' ? ' **Coordinate branch condition.**' : ''}`);
  }
  lines.push('', '## Conclusions', '');
  for (const conclusion of proof.conclusions) {
    const node = proof.nodes.find((item) => item.id === conclusion.nodeId);
    lines.push(`- ${statement((notation) => conclusion.predicate ? formatProofPredicate(conclusion.predicate, exported, notation) : node ? formatProofNode(node, exported, notation) : 'Unrecorded conclusion')}: ${conclusion.status}${node ? ` [${indexes.get(node.id)}]` : ''}.`);
  }
  return lines.join('\n');
};
