import { useId, useState } from 'react';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import { DISCOVERY_BUDGET_FIELDS, DISCOVERY_BUDGET_KEYS } from '../analysis/preferences/discoveryPreferences';
import { DEFAULT_DISCOVERY_OPTIONS } from '../analysis/relations/catalog';
import { REASONING_FIELDS, REASONING_FIELD_KEYS, REASONING_GROUPS, reasoningPreset } from '../reasoning/preferences/reasoningPreferences';
import type { ReasoningPreferences, ReasoningPreset } from '../reasoning/preferences/reasoningPreferences';
import { RelationTypeControls } from './RelationTypeControls';
import StudioIcon, { StudioIconButton } from './StudioIcon';
import './proof-settings.css';

interface Props {
  preferences: ReasoningPreferences;
  discovery: GeometryRelationsState;
  storageUnavailable: boolean;
  onApply(value: ReasoningPreferences): void;
  onClose(): void;
}
const strings = (value: Record<string, number>) => Object.fromEntries(Object.entries(value).map(([key, number]) => [key, String(number)]));
const draftNumbers = (p: ReasoningPreferences, d: GeometryRelationsState['preferences']) => strings({
  ...Object.fromEntries(REASONING_FIELD_KEYS.map((key) => [key, p[key]])),
  ...Object.fromEntries(DISCOVERY_BUDGET_KEYS.map((key) => [key, d.options[key]])),
});

/** Draft locally so typing or choosing a preset never restarts discovery. */
export default function ProofSettingsPanel({ preferences, discovery, storageUnavailable, onApply, onClose }: Props) {
  const id = useId();
  const [numbers, setNumbers] = useState(() => draftNumbers(preferences, discovery.preferences));
  const [behavior, setBehavior] = useState(preferences);
  const [discoveryDraft, setDiscoveryDraft] = useState(discovery.preferences);
  const [applied, setApplied] = useState(false);
  const changed = () => setApplied(false);
  const fields = { ...REASONING_FIELDS, ...DISCOVERY_BUDGET_FIELDS };
  const errors = Object.entries(fields).filter(([key, field]) => numbers[key]?.trim() === '' || !Number.isInteger(Number(numbers[key])) || Number(numbers[key]) < field.min || Number(numbers[key]) > field.max);
  const choosePreset = (preset: ReasoningPreset) => {
    const next = reasoningPreset(preset);
    // A resource preset changes budgets only; keep deliberate evidence and type choices.
    const options = { ...discoveryDraft.options };
    for (const key of DISCOVERY_BUDGET_KEYS) options[key] = preset === 'standard' ? DEFAULT_DISCOVERY_OPTIONS[key] : DISCOVERY_BUDGET_FIELDS[key][preset];
    setNumbers(draftNumbers(next, { ...discoveryDraft, options })); changed();
  };
  const reset = () => {
    const next = reasoningPreset();
    setNumbers(draftNumbers(next, { ...discoveryDraft, options: { ...discoveryDraft.options, ...Object.fromEntries(DISCOVERY_BUDGET_KEYS.map((key) => [key, DEFAULT_DISCOVERY_OPTIONS[key]])) } }));
    setBehavior(next); changed();
  };
  const fieldInput = (key: keyof typeof fields) => {
    const field = fields[key]; const invalid = errors.some(([name]) => name === key);
    return <label key={key} className="ggb-budget-field" htmlFor={`${id}-${key}`}>
      <span>{field.label}</span><span className="ggb-budget-input"><input id={`${id}-${key}`} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} required value={numbers[key]} aria-label={field.label} aria-invalid={invalid} aria-describedby={`${id}-${key}-help`} onChange={(event) => { setNumbers({ ...numbers, [key]: event.target.value }); changed(); }} />{'unit' in field && field.unit && <span>{field.unit}</span>}</span>
      <small id={`${id}-${key}-help`}>{field.help} <span>{field.min.toLocaleString('en-US')}–{field.max.toLocaleString('en-US')}{'unit' in field && field.unit ? ` ${field.unit}` : ''}.</span></small>
    </label>;
  };
  return <section id="geogebra-proof-settings" className="ggb-proof-settings" aria-labelledby={`${id}-title`} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="ggb-proof-settings-heading"><div><span className="ggb-eyebrow">COMPUTATION & SEARCH</span><h2 id={`${id}-title`}>Proof settings</h2><p>Balance search depth and computation time. Larger budgets can find more consequences and use more memory.</p></div><StudioIconButton icon="close" label="Close proof settings" onClick={onClose} /></div>
    <form onSubmit={(event) => {
      event.preventDefault(); if (errors.length) return;
      const next = { ...behavior };
      for (const key of REASONING_FIELD_KEYS) next[key] = Number(numbers[key]);
      const options = { ...discoveryDraft.options };
      for (const key of DISCOVERY_BUDGET_KEYS) options[key] = Number(numbers[key]);
      onApply(next); discovery.setPreferences({ ...discoveryDraft, options }); setApplied(true);
    }}>
      <div className="ggb-budget-presets"><span>Budget presets</span>{(['light', 'standard', 'deep'] as const).map((preset) => <button key={preset} type="button" onClick={() => choosePreset(preset)}>{preset === 'light' ? 'Light' : preset === 'standard' ? 'Standard' : 'Deep'}</button>)}<button type="button" className="ggb-budget-reset" onClick={reset}>Reset proof defaults</button></div>
      <div className="ggb-proof-settings-scroll"><div className="ggb-budget-grid">
        {REASONING_GROUPS.map((group) => <fieldset key={group}><legend>{group}</legend>{group === 'Condition search' && <div className="ggb-budget-toggles">
          <label><input type="checkbox" checked={behavior.validateSamples} onChange={(event) => { setBehavior({ ...behavior, validateSamples: event.target.checked }); changed(); }} />Check suggestions on an independent construction copy</label>
          <label><input type="checkbox" checked={behavior.allowEarlierContext} onChange={(event) => { setBehavior({ ...behavior, allowEarlierContext: event.target.checked }); changed(); }} />Search earlier related objects when upstream inputs are insufficient</label>
        </div>}{REASONING_FIELD_KEYS.filter((key) => REASONING_FIELDS[key].group === group).map(fieldInput)}</fieldset>)}
        <fieldset><legend>Relation discovery</legend><div className="ggb-budget-toggles"><label><input type="checkbox" checked={discoveryDraft.automatic} onChange={(event) => { setDiscoveryDraft({ ...discoveryDraft, automatic: event.target.checked }); changed(); }} />Automatically discover after construction or settings changes</label></div>{DISCOVERY_BUDGET_KEYS.map(fieldInput)}</fieldset>
        <fieldset className="ggb-budget-relation-types"><legend>Discovery types</legend><RelationTypeControls kinds={discoveryDraft.options.enabledKinds} purpose="compute" onChange={(enabledKinds) => { setDiscoveryDraft({ ...discoveryDraft, options: { ...discoveryDraft.options, enabledKinds } }); changed(); }} /><div className="ggb-budget-toggles"><label><input type="checkbox" checked={!discoveryDraft.options.compressConsequences} onChange={(event) => { setDiscoveryDraft({ ...discoveryDraft, options: { ...discoveryDraft.options, compressConsequences: !event.target.checked } }); changed(); }} />Expand derived observations</label></div><p>Local condition search uses its own numerical pool. Discovery types and catalog filters do not limit that pool.</p></fieldset>
      </div></div>
      <div className="ggb-proof-settings-footer"><div role="status">{errors.length ? <span className="ggb-budget-error">Enter whole numbers within the displayed ranges ({errors.length} fields).</span> : storageUnavailable || discovery.storageUnavailable ? 'Browser storage is unavailable; applied settings last for this session.' : applied ? 'Settings saved in this browser.' : 'Changes apply when you select Apply settings.'}<small>Running workers keep their starting limits. Discovery changes in Auto mode refresh the catalog and may stop an active proof. Limits can leave results incomplete.</small></div><button type="button" onClick={onClose}>Close</button><button className="ggb-budget-apply" type="submit" disabled={errors.length > 0}><StudioIcon name="settings" size={14} />Apply settings</button></div>
    </form>
  </section>;
}
