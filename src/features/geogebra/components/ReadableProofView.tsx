import React, { useState } from 'react';
import type { Ag2Export } from '../reasoning/backends/ag2/exportProblem';
import type { ReadableProof } from '../reasoning/proof/types';
import { focusProof, formatProofNode, formatProofPredicate, proofRuleLabel, proofToMarkdown } from '../reasoning/proof/formatProof';
import { blobToDownload } from '../persistence/ggbFileCodec';

interface Props { proof: ReadableProof; exported: Ag2Export; elapsedMs: number; }

const ReadableProofView: React.FC<Props> = ({ proof: fullProof, exported, elapsedMs }) => {
  const preferred = fullProof.conclusions.find((item) => item.status === 'recorded' && /^(para|perp|cyclic|cong) /.test(item.predicate ?? ''))
    ?? fullProof.conclusions.find((item) => item.status === 'recorded') ?? fullProof.conclusions.find((item) => item.nodeId);
  const [chosen, setChosen] = useState<string | null>(preferred?.nodeId ?? null);
  const proof = fullProof.contradictionIds.length ? fullProof : focusProof(fullProof, chosen);
  const indexes = new Map(proof.nodes.map((node, i) => [node.id, i + 1]));
  const download = () => blobToDownload(new Blob([proofToMarkdown(proof, exported)], { type: 'text/markdown;charset=utf-8' }), 'geometry-proof.md');
  return <section aria-label="Readable derivation" className="space-y-2 rounded-lg border border-sky-200 bg-sky-50/30 p-2">
    <div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-700">Readable derivation</p><button type="button" className="rounded px-2 py-1 text-sky-700 hover:bg-sky-100" onClick={download}>Export proof Markdown</button></div>
    <p className="text-[10px] leading-4 text-slate-600">{proof.mode === 'hypothetical' ? 'Symbolic hypothesis exploration' : 'DDAR with recorded provenance'} · {elapsedMs.toFixed(0)} ms · {proof.nodes.length} steps</p>
    <p className="text-[10px] leading-4 text-slate-500">{proof.algebraReplay.checked} algebra steps replayed ({proof.algebraReplay.valid ? 'passed' : 'failed'}) · {proof.guardIds.length} coordinate branch conditions · {proof.gapIds.length} unreconstructed steps. Geometric rules and branch conditions remain trust inputs to this first checker.</p>
    {proof.mode === 'hypothetical' && <p className="text-amber-800">Assumptions are used symbolically. Coordinate disagreements are allowed; geometric existence and consistency are not guaranteed.</p>}
    {proof.contradictionIds.length > 0 && <p role="alert" className="font-semibold text-rose-700">Incompatible assumptions were found. No arbitrary conclusions are inferred from the contradiction.</p>}
    {proof.explanation === 'partial' && <p className="text-amber-800">This derivation has explicit gaps or reached the recording budget.</p>}
    {proof.witnessFailures.length > 0 && <details className="text-[10px] text-amber-800"><summary className="cursor-pointer">Coordinate disagreements ({proof.witnessFailures.length})</summary>{proof.witnessFailures.map((failure, i) => <p key={i} className="mt-1 break-words">{formatProofPredicate(failure.predicate, exported)}</p>)}</details>}
    {fullProof.conclusions.length > 1 && <details className="text-[10px] text-slate-600"><summary className="cursor-pointer">Other consequences and checks ({fullProof.conclusions.length})</summary>{fullProof.conclusions.map((item, i) => <p key={i} className="mt-1 break-words">{item.predicate ? formatProofPredicate(item.predicate, exported) : item.nodeId ? formatProofNode(fullProof.nodes.find((node) => node.id === item.nodeId)!, exported) : 'Unrecorded conclusion'} · {item.status}{item.nodeId && <button type="button" className="ml-1 rounded px-1 py-0.5 text-sky-700 hover:bg-sky-100" onClick={() => setChosen(item.nodeId)}>Read these steps</button>}</p>)}</details>}
    <div className="space-y-1">{proof.conclusions.map((conclusion, i) => {
      const node = proof.nodes.find((item) => item.id === conclusion.nodeId);
      return <p key={i} className={`break-words ${conclusion.status === 'recorded' || conclusion.status === 'assumed' ? 'text-slate-700' : 'text-amber-800'}`}>{conclusion.predicate ? formatProofPredicate(conclusion.predicate, exported) : node ? formatProofNode(node, exported) : 'Unrecorded conclusion'} · {conclusion.status === 'assumed' ? 'already given' : conclusion.status === 'recorded' ? 'derivation recorded' : conclusion.status === 'unexplained' ? 'DDAR knows this; explanation incomplete' : 'not derived'}{node ? ` [${indexes.get(node.id)}]` : ''}</p>;
    })}</div>
    <ol className="max-h-[32rem] space-y-2 overflow-auto border-t border-sky-100 pt-2">{proof.nodes.map((node) => <li key={node.id} className={`rounded bg-white p-2 ${node.kind === 'gap' || node.kind === 'guard' ? 'border border-amber-200' : ''}`}>
      <p className="break-words leading-5 text-slate-700">[{indexes.get(node.id)}] {formatProofNode(node, exported)}</p>
      <p className={`mt-1 text-[10px] leading-4 ${node.kind === 'gap' ? 'text-rose-700' : node.kind === 'guard' ? 'text-amber-800' : 'text-slate-500'}`}>{proofRuleLabel(node.rule)}{node.premises.length ? ` · from ${node.premises.map((parent) => `${parent.coefficient === '1' ? '' : `${parent.coefficient} × `}[${indexes.get(parent.id)}]`).join(', ')}` : ''}</p>
    </li>)}</ol>
    {proof.algebraReplay.errors.map((error) => <p key={error} className="text-rose-700">{error}</p>)}
  </section>;
};

export default ReadableProofView;
