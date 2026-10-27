import type { ProofOutcome } from '../../reasoning/proof/proofOutcome';
import { useRef, type Ref } from 'react';
import StudioIcon from '../studio/StudioIcon';
import './reasoning-workspace.css';

interface Props {
  elementRef?: Ref<HTMLElement>;
  acceptedCount: number;
  goal: string | null;
  hypothetical: boolean;
  canSuggest: boolean;
  canGenerate: boolean;
  canCheck: boolean;
  canExportAg2: boolean;
  canExportProject: boolean;
  progress: string | null;
  outcome: ProofOutcome | null;
  hasSelection: boolean;
  onSuggest(): void;
  onGenerate(): void;
  onCheck(): void;
  onExport(project: boolean): void;
  onStop(): void;
  onClear(): void;
  onRead(): void;
}

export default function ReasoningActions(p: Props) {
  const exportRef = useRef<HTMLDetailsElement>(null);
  const download = (project: boolean) => { p.onExport(project); if (exportRef.current) exportRef.current.open = false; };
  return <section ref={p.elementRef} aria-label="Proof workspace" className="ggb-reasoning-actions">
    <div className="ggb-reasoning-heading"><span>PROOF WORKSPACE</span><span className={p.hypothetical ? 'ggb-hypothesis-badge' : ''}>{p.acceptedCount} conditions{p.hypothetical ? ' · Hypotheses' : ''}</span></div>
    <div className="ggb-reasoning-primary">
      <button type="button" className="ggb-suggest-action" disabled={!p.canSuggest} onClick={p.onSuggest}><StudioIcon name="sparkles" size={16} /><span>Suggest conditions</span></button>
      <button type="button" className="ggb-proof-action" disabled={!p.canGenerate} onClick={p.onGenerate}><StudioIcon name="run" size={15} /><span>Generate readable proof</span></button>
    </div>
    <p className="ggb-reasoning-hint">Suggestions are added automatically. Remove any you do not need in Accepted.</p>
    <div className="ggb-reasoning-goal"><span>GOAL</span><p>{p.goal ?? 'Optional · derive new conclusions without a goal'}</p></div>
    <div className="ggb-reasoning-secondary">
      <button type="button" disabled={!p.canCheck} title="Check the selected goal without generating a readable derivation" onClick={p.onCheck}>Check goal</button>
      <details ref={exportRef} className="ggb-reasoning-export" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary><StudioIcon name="download" size={13} />Export</summary><div><button type="button" disabled={!p.canExportAg2} onClick={() => download(false)}>Export AG2</button><button type="button" disabled={!p.canExportProject} onClick={() => download(true)}>Export project</button></div></details>
      {p.progress ? <button type="button" className="ggb-reasoning-stop" onClick={p.onStop}>Stop</button> : p.hasSelection && <button type="button" className="ggb-reasoning-clear" onClick={p.onClear}>Clear selection</button>}
    </div>
    {p.progress && <p role="status" className="ggb-reasoning-progress"><span className="ggb-spinner" />{p.progress}</p>}
    {p.outcome && <div className="ggb-proof-outcome" data-tone={p.outcome.tone}><span role="status" title={p.outcome.detail}><span className="ggb-status-dot" />{p.outcome.label}</span><button type="button" onClick={p.onRead}>{p.outcome.tone === 'error' ? 'View details' : 'Read proof results'}<span aria-hidden="true"> →</span></button></div>}
  </section>;
}
