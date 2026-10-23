import { useEffect, useId, useRef, useState } from 'react';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import { DISCOVERY_BUDGET_FIELDS, DISCOVERY_BUDGET_KEYS } from '../analysis/preferences/discoveryPreferences';
import { DEFAULT_DISCOVERY_OPTIONS } from '../analysis/relations/catalog';
import { REASONING_FIELDS, REASONING_FIELD_KEYS, reasoningPreset } from '../reasoning/preferences/reasoningPreferences';
import type { ReasoningPreferences, ReasoningPreset } from '../reasoning/preferences/reasoningPreferences';
import { RelationTypeControls } from './RelationTypeControls';
import StudioIcon, { StudioIconButton } from './StudioIcon';
import type { StudioIconName } from './StudioIcon';
import './proof-settings.css';

interface Props {
  preferences: ReasoningPreferences;
  discovery: GeometryRelationsState;
  storageUnavailable: boolean;
  onApply(value: ReasoningPreferences): void;
  onClose(): void;
}

// Presentation is independent of the parameter registry and computation behavior.
const SECTIONS = [
  { id: 'runtime', label: 'Runtime limits', group: 'Time budgets', icon: 'clock', description: 'Give each stage enough time, with a clear stopping point.' },
  { id: 'conditions', label: 'Condition search', group: 'Condition search', icon: 'search', description: 'Choose how much of the construction to explore for useful conditions.' },
  { id: 'local', label: 'Local discovery', group: 'Local numerical discovery', icon: 'focus', description: 'Fine-tune the numerical search within each local point scope.' },
  { id: 'proof', label: 'Proof engine', group: 'Proof computation', icon: 'layers', description: 'Balance the depth of the derivation with the work needed to record it.' },
  { id: 'conclusions', label: 'Conclusion checks', group: 'Conclusion checks', icon: 'check', description: 'Set the breadth of additional conclusions and coverage checks.' },
  { id: 'discovery', label: 'Relation discovery', icon: 'geometry', description: 'Control the numerical observations collected from the construction.' },
  { id: 'types', label: 'Discovery types', icon: 'filter', description: 'Choose which families of relations appear in numerical discovery.' },
] as const satisfies readonly { id: string; label: string; group?: typeof REASONING_FIELDS[keyof typeof REASONING_FIELDS]['group']; icon: StudioIconName; description: string }[];
type SectionId = typeof SECTIONS[number]['id'];
const PRESETS = [
  { id: 'light', label: 'Light', description: 'Smaller searches and shorter runs.' },
  { id: 'standard', label: 'Standard', description: 'A balanced starting point for most constructions.' },
  { id: 'deep', label: 'Deep', description: 'Broader searches with more time to explore.' },
] as const;
const FIELDS = { ...REASONING_FIELDS, ...DISCOVERY_BUDGET_FIELDS };
type BudgetKey = keyof typeof FIELDS;
const draftNumbers = (p: ReasoningPreferences, d: GeometryRelationsState['preferences']) => Object.fromEntries([
  ...REASONING_FIELD_KEYS.map((key) => [key, String(p[key])]),
  ...DISCOVERY_BUDGET_KEYS.map((key) => [key, String(d.options[key])]),
]);
const discoveryPreset = (preset: ReasoningPreset) => Object.fromEntries(DISCOVERY_BUDGET_KEYS.map((key) => [
  key, preset === 'standard' ? DEFAULT_DISCOVERY_OPTIONS[key] : DISCOVERY_BUDGET_FIELDS[key][preset],
]));
const sectionFor = (key: BudgetKey): SectionId => key in DISCOVERY_BUDGET_FIELDS ? 'discovery'
  : SECTIONS.find((section) => 'group' in section && section.group === REASONING_FIELDS[key as keyof typeof REASONING_FIELDS].group)!.id;

function PreferenceSwitch({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange(value: boolean): void;
}) {
  return <label className="ggb-proof-toggle-row">
    <span><strong>{label}</strong><small>{description}</small></span>
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="ggb-proof-switch" aria-hidden="true" />
  </label>;
}

/** The native modal top layer keeps the construction stationary and contains focus. */
export default function ProofSettingsPanel({ preferences, discovery, storageUnavailable, onApply, onClose }: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>('runtime');
  const [compact, setCompact] = useState(false);
  const [numbers, setNumbers] = useState(() => draftNumbers(preferences, discovery.preferences));
  const [behavior, setBehavior] = useState(preferences);
  const [discoveryDraft, setDiscoveryDraft] = useState(discovery.preferences);
  const fingerprint = JSON.stringify([numbers, behavior.validateSamples, behavior.allowEarlierContext, discoveryDraft.automatic,
    [...discoveryDraft.options.enabledKinds].sort(), discoveryDraft.options.compressConsequences]);
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
  const [applied, setApplied] = useState(false);
  const dirty = fingerprint !== savedFingerprint;
  const section = SECTIONS.find((item) => item.id === active)!;
  const errors = (Object.keys(FIELDS) as BudgetKey[]).filter((key) => {
    const field = FIELDS[key];
    return numbers[key]?.trim() === '' || !Number.isInteger(Number(numbers[key])) || Number(numbers[key]) < field.min || Number(numbers[key]) > field.max;
  });
  const selectedPreset = PRESETS.find(({ id: preset }) => {
    const proof = reasoningPreset(preset), discovery = discoveryPreset(preset);
    return REASONING_FIELD_KEYS.every((key) => Number(numbers[key]) === proof[key])
      && DISCOVERY_BUDGET_KEYS.every((key) => Number(numbers[key]) === discovery[key]);
  });

  useEffect(() => {
    const dialog = dialogRef.current!;
    const root = document.documentElement;
    const gutter = root.style.scrollbarGutter;
    const overflow = document.body.style.overflow;
    // Keep the background's horizontal position when its scrollbar is locked.
    if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = 'stable';
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    titleRef.current?.focus();
    return () => { dialog.close(); document.body.style.overflow = overflow; root.style.scrollbarGutter = gutter; };
  }, []);
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [active]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const sync = () => setCompact(query.matches);
    sync(); query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const choosePreset = (preset: ReasoningPreset) => {
    const next = reasoningPreset(preset);
    setNumbers(draftNumbers(next, { ...discoveryDraft, options: { ...discoveryDraft.options, ...discoveryPreset(preset) } }));
  };
  const fieldInput = (key: BudgetKey) => {
    const field = FIELDS[key], invalid = errors.includes(key);
    const defaultValue = key in REASONING_FIELDS ? REASONING_FIELDS[key as keyof typeof REASONING_FIELDS].default
      : DEFAULT_DISCOVERY_OPTIONS[key as keyof typeof DISCOVERY_BUDGET_FIELDS];
    const unit = 'unit' in field && field.unit ? field.unit : '';
    return <div key={key} className="ggb-proof-field" data-invalid={invalid}>
      <label htmlFor={`${id}-${key}`}><strong>{field.label}</strong><span id={`${id}-${key}-help`}>{field.help}</span></label>
      <div className="ggb-proof-value">
        <span className="ggb-proof-number"><input id={`${id}-${key}`} type="number" inputMode="numeric" min={field.min} max={field.max} step={1}
          required value={numbers[key]} aria-label={field.label} aria-invalid={invalid}
          aria-describedby={`${id}-${key}-help${invalid ? ` ${id}-${key}-error` : ''}`}
          title={`Whole numbers from ${field.min.toLocaleString('en-US')} to ${field.max.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`}
          onChange={(event) => setNumbers({ ...numbers, [key]: event.target.value })} />{unit && <span>{unit}</span>}
        </span>
        <small>Default {defaultValue.toLocaleString('en-US')}{unit && ` ${unit}`}</small>
      </div>
      {invalid && <p className="ggb-proof-field-error" id={`${id}-${key}-error`}>Use a whole number from {field.min.toLocaleString('en-US')} to {field.max.toLocaleString('en-US')}.</p>}
    </div>;
  };

  return <dialog ref={dialogRef} id="geogebra-proof-settings" className="ggb-proof-settings" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`}
    onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]'))
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      const outsideSequence = !controls.includes(document.activeElement as HTMLElement);
      if (event.shiftKey && (document.activeElement === first || outsideSequence)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outsideSequence)) { event.preventDefault(); first?.focus(); }
    }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <form noValidate onSubmit={(event) => {
      event.preventDefault(); if (errors.length || !dirty) return;
      const next = { ...behavior };
      for (const key of REASONING_FIELD_KEYS) next[key] = Number(numbers[key]);
      const options = { ...discoveryDraft.options };
      for (const key of DISCOVERY_BUDGET_KEYS) options[key] = Number(numbers[key]);
      onApply(next); discovery.setPreferences({ ...discoveryDraft, options }); setSavedFingerprint(fingerprint); setApplied(true);
    }}>
      <header className="ggb-proof-dialog-header">
        <span className="ggb-proof-dialog-mark"><StudioIcon name="settings" size={22} /></span>
        <div><h2 ref={titleRef} tabIndex={-1} id={`${id}-title`}>Proof settings</h2><p id={`${id}-intro`}>Search depth, runtime and discovery.</p></div>
        <StudioIconButton icon="close" label="Close proof settings" onClick={onClose} />
      </header>
      <div className="ggb-proof-profile">
        <div><span className="ggb-proof-profile-label">Computation profile{!selectedPreset && <span className="ggb-proof-custom">Custom</span>}</span>
          <p>{selectedPreset?.description ?? 'Your own balance of depth and computation time.'}</p></div>
        <div className="ggb-proof-preset-control" role="group" aria-label="Computation profile">{PRESETS.map((preset) =>
          <button key={preset.id} type="button" aria-pressed={selectedPreset?.id === preset.id} title={preset.description} onClick={() => choosePreset(preset.id)}>{preset.label}</button>)}</div>
      </div>
      <div className="ggb-proof-dialog-body">
        <nav className="ggb-proof-nav" aria-label="Proof settings categories">
          <div role="tablist" aria-label="Settings sections" aria-orientation={compact ? 'horizontal' : 'vertical'}>
            {SECTIONS.map((item, index) => <button key={item.id} type="button" role="tab" id={`${id}-tab-${item.id}`}
              aria-selected={active === item.id} aria-controls={`${id}-section`} tabIndex={active === item.id ? 0 : -1}
              onClick={() => setActive(item.id)} onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1
                  : (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + SECTIONS.length) % SECTIONS.length;
                setActive(SECTIONS[next].id); document.getElementById(`${id}-tab-${SECTIONS[next].id}`)?.focus();
              }}><StudioIcon name={item.icon} size={17} /><span>{item.label}</span>
              {errors.some((key) => sectionFor(key) === item.id) && <i className="ggb-proof-nav-error" aria-label="Invalid values" />}
            </button>)}
          </div>
          <div className="ggb-proof-nav-note"><span className="ggb-status-dot" /><span>Local preferences<small>Kept across constructions.</small></span></div>
        </nav>
        <div ref={contentRef} className="ggb-proof-section" id={`${id}-section`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
          <div className="ggb-proof-section-heading"><h3>{section.label}</h3><p>{section.description}</p></div>
          {'group' in section && <div className="ggb-proof-fields">{REASONING_FIELD_KEYS.filter((key) => REASONING_FIELDS[key].group === section.group).map(fieldInput)}</div>}
          {active === 'conditions' && <div className="ggb-proof-behavior"><h4>Search behavior</h4>
            <PreferenceSwitch label="Check a construction copy" description="Validate suggestions on six independent configurations." checked={behavior.validateSamples} onChange={(value) => setBehavior({ ...behavior, validateSamples: value })} />
            <PreferenceSwitch label="Include earlier related objects" description="Expand the context when upstream inputs are insufficient." checked={behavior.allowEarlierContext} onChange={(value) => setBehavior({ ...behavior, allowEarlierContext: value })} />
          </div>}
          {active === 'discovery' && <>
            <PreferenceSwitch label="Automatic discovery" description="Refresh observations when the construction or discovery settings change." checked={discoveryDraft.automatic} onChange={(value) => setDiscoveryDraft({ ...discoveryDraft, automatic: value })} />
            <div className="ggb-proof-fields">{DISCOVERY_BUDGET_KEYS.map(fieldInput)}</div>
          </>}
          {active === 'types' && <>
            <div className="ggb-proof-type-picker"><RelationTypeControls kinds={discoveryDraft.options.enabledKinds} purpose="compute" onChange={(enabledKinds) => setDiscoveryDraft({ ...discoveryDraft, options: { ...discoveryDraft.options, enabledKinds } })} /></div>
            <PreferenceSwitch label="Expand derived observations" description="Include consequences that would otherwise be compressed." checked={!discoveryDraft.options.compressConsequences} onChange={(value) => setDiscoveryDraft({ ...discoveryDraft, options: { ...discoveryDraft.options, compressConsequences: !value } })} />
          </>}
          <p className="ggb-proof-section-note"><StudioIcon name="info" size={15} /><span>{active === 'runtime'
            ? 'Each limit applies to its own stage. Runs already in progress keep their starting limits.'
            : active === 'local' || active === 'types' ? 'Local condition search uses an independent numerical pool. Discovery types and list filters do not limit that search.'
              : active === 'discovery' ? 'Applying discovery changes in Auto mode refreshes the catalog and may stop an active proof.'
                : 'A budget limits the work performed. Reaching it may leave results incomplete.'}</span></p>
        </div>
      </div>
      <footer className="ggb-proof-dialog-footer">
        <button className="ggb-proof-reset" type="button" title="Restore proof preferences and discovery budgets; keep discovery type choices" onClick={() => { choosePreset('standard'); setBehavior(reasoningPreset()); }}><StudioIcon name="reset" size={15} /><span>Restore defaults</span></button>
        <div className="ggb-proof-save-status" role="status" data-error={errors.length > 0}>
          {errors.length ? `${errors.length} ${errors.length === 1 ? 'value needs' : 'values need'} attention` : dirty ? 'Unapplied changes' : storageUnavailable || discovery.storageUnavailable ? 'Saved for this session' : applied ? 'Changes saved' : 'Saved locally'}
        </div>
        <div className="ggb-proof-footer-actions"><button className="ggb-proof-cancel" type="button" onClick={onClose}>{dirty ? 'Cancel' : 'Done'}</button>
          <button className="ggb-proof-apply" type="submit" disabled={errors.length > 0 || !dirty}>Apply settings</button></div>
      </footer>
    </form>
  </dialog>;
}
