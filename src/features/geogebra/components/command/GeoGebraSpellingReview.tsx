import React from 'react';
import type { SpellingCorrection } from '../../commands/spellingSuggestions';

interface GeoGebraSpellingReviewProps {
  corrections: readonly SpellingCorrection[];
  onChoose(index: number, replacement: string): void;
  onAccept(): void;
  onDismiss(): void;
}

const GeoGebraSpellingReview: React.FC<GeoGebraSpellingReviewProps> = ({ corrections, onChoose, onAccept, onDismiss }) => (
  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="geogebra-spelling-review">
    <p role="status" className="font-semibold">Possible function name typo. Apply these changes?</p>
    <div className="my-2 flex max-h-28 flex-wrap gap-2 overflow-auto">
      {corrections.map((correction, index) => <label key={correction.start} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-2 py-1 font-mono"><span>{correction.name}</span><span aria-hidden="true">→</span>{correction.suggestions.length === 1 ? <strong>{correction.replacement}</strong> : <select aria-label={`Replacement for ${correction.name}`} value={correction.replacement} onChange={(event) => onChoose(index, event.target.value)} className="min-w-0 rounded border border-amber-200 bg-white px-1 py-0.5 text-xs">{correction.suggestions.map((name) => <option key={name}>{name}</option>)}</select>}</label>)}
    </div>
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={onAccept} className="rounded-lg bg-amber-700 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-800">Apply names (Tab)</button><button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1.5 hover:bg-amber-100">Dismiss (Esc)</button><span className="text-[11px] text-amber-700">Review, then run again to execute.</span></div>
  </div>
);

export default GeoGebraSpellingReview;
