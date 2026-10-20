import type { Ag2Export } from '../backends/ag2/exportProblem';
import type { ProofEquation, ProofNode, ReadableProof } from './types';

export const proofRuleLabel = (rule: string): string => ({
  'accepted-condition': 'Given condition', 'predicate-equation': 'Express the given condition as an equation',
  'equal-lengths': 'Equal lengths', 'collinear-directions': 'Directions on one line',
  'collinear-from-directions': 'Equal directions imply collinearity', 'join-collinear-sets': 'Join lines with two common points',
  'segment-addition': 'Segment addition', 'positive-length-ratio': 'Convert a positive length ratio',
  'sss-similarity': 'SSS similarity', 'aa-similarity': 'AA similarity', 'sas-similarity': 'SAS similarity',
  'similarity-side-ratios': 'Corresponding sides of similar triangles', 'similarity-angles': 'Corresponding directed angles of similar triangles',
  'inscribed-angle': 'Angles subtending the same chord', 'converse-inscribed-angle': 'Converse of the inscribed-angle theorem',
  'incidence-subset': 'Take a subset of the incidence relation', 'circle-radii': 'Radii of one circle',
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

export const formatProofEquation = (equation: ProofEquation, exported: Ag2Export): string => {
  const symbol = (value: string) => {
    const text = value.replace(/^len\((.*)\)$/, '|$1|').replace(/^log\(\|(.*)\|\)$/, 'log |$1|').replace(/^log\((.*)\)$/, 'log $1').replace(/^pi$/, 'π');
    return proofNames(text, exported);
  };
  return `${expression(equation.terms.map((term) => ({ text: symbol(term.variable), coefficient: term.coefficient })))} = 0${equation.domain === 'angle' ? ' (mod π)' : ''}`;
};

export const formatProofPredicate = (predicate: string, exported: Ag2Export): string => {
  const [kind, ...tokens] = predicate.split(' ');
  const points = tokens.filter((token) => /^p\d+$/.test(token)); const constants = tokens.slice(points.length);
  const name = (point: string) => proofNames(point, exported);
  const pair = (i: number) => `${name(points[i])}, ${name(points[i + 1])}`;
  if (kind === 'coll' || kind === 'cyclic') return `${points.map(name).join(', ')} ${kind === 'coll' ? 'are collinear' : 'are concyclic'}`;
  if (kind === 'para' || kind === 'perp') return `(${pair(0)}) ${kind === 'para' ? '∥' : '⊥'} (${pair(2)})`;
  if (kind === 'cong') return `|${pair(0)}| = |${pair(2)}|`;
  if (kind === 'overlap') return `${name(points[0])} = ${name(points[1])}`;
  if (kind === 'angeq' || kind === 'distseq' || kind === 'distmeq') {
    const parts = Array.from({ length: points.length / 2 }, (_, i) => ({ coefficient: constants[i],
      text: kind === 'angeq' ? `dir(${pair(2 * i)})` : kind === 'distmeq' ? `log |${pair(2 * i)}|` : `|${pair(2 * i)}|` }));
    const tail = constants[points.length / 2];
    if (kind === 'angeq' && tail !== '0') parts.push({ coefficient: tail, text: '°' });
    if (kind === 'distmeq' && tail !== '1') parts.push({ coefficient: '1', text: `log ${tail}` });
    return `${expression(parts)} = 0${kind === 'angeq' ? ' (mod π)' : ''}`;
  }
  return proofNames(predicate, exported);
};

export const formatProofNode = (node: ProofNode, exported: Ag2Export): string => {
  if (node.predicate) return formatProofPredicate(node.predicate, exported);
  if (node.triangles) return node.triangles.map((triangle) => `△(${triangle.map((name) => proofNames(name, exported)).join(', ')})`).join(' ∼ ');
  if (node.ratio && node.equation?.domain === 'length-product') {
    const positive = node.equation.terms.find((term) => term.variable.startsWith('log(|') && term.coefficient === '1');
    const negative = node.equation.terms.find((term) => term.variable.startsWith('log(|') && term.coefficient === '-1');
    if (positive && negative) return `${proofNames(positive.variable.slice(4, -1), exported)} = ${node.ratio} × ${proofNames(negative.variable.slice(4, -1), exported)}`;
  }
  if (node.equation) return formatProofEquation(node.equation, exported);
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
  const indexes = new Map(proof.nodes.map((node, i) => [node.id, i + 1]));
  const lines = ['# Conditional geometry derivation', '', `Mode: ${proof.mode === 'hypothetical' ? 'Symbolic hypotheses' : 'DDAR with recorded provenance'}.`,
    `Explanation: ${proof.explanation}. Algebra replay: ${proof.algebraReplay.valid ? 'passed' : 'failed'} (${proof.algebraReplay.checked} steps).`,
    `Coordinate branch guards: ${proof.guardIds.length}. Unreconstructed steps: ${proof.gapIds.length}.`,
    'Geometric rules and coordinate guards are explicit trust inputs; this is not a full independent geometry certificate.', ''];
  if (proof.contradictionIds.length) lines.push('Incompatible assumptions were found. No arbitrary conclusions are inferred from this contradiction.', '');
  if (proof.witnessFailures.length) lines.push('## Coordinate disagreements', '', ...proof.witnessFailures.map((failure) => `- ${formatProofPredicate(failure.predicate, exported)}`), '');
  lines.push('## Steps', '');
  for (const node of proof.nodes) {
    const parents = node.premises.map((parent) => `${parent.coefficient === '1' ? '' : `${parent.coefficient} × `}[${indexes.get(parent.id)}]`).join(', ');
    lines.push(`${indexes.get(node.id)}. ${formatProofNode(node, exported)}. ${proofRuleLabel(node.rule)}${parents ? `; from ${parents}` : ''}.${node.kind === 'gap' ? ' **Unreconstructed step.**' : node.kind === 'guard' ? ' **Coordinate branch condition.**' : ''}`);
  }
  lines.push('', '## Conclusions', '');
  for (const conclusion of proof.conclusions) {
    const node = proof.nodes.find((item) => item.id === conclusion.nodeId);
    lines.push(`- ${conclusion.predicate ? formatProofPredicate(conclusion.predicate, exported) : node ? formatProofNode(node, exported) : 'Unrecorded conclusion'}: ${conclusion.status}${node ? ` [${indexes.get(node.id)}]` : ''}.`);
  }
  return lines.join('\n');
};
