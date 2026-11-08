import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  findReferenceTool, getReferenceTools, gibertReferenceIds,
  searchReferenceTools, specialGroup, toolReferencePath, visitToolCategories,
} from '../../commands/reference/toolReference';
import type { ReferenceTool } from '../../commands/reference/toolReference';
import { toolGroups } from '../../commands/reference/toolCategories';
import type { ToolCategory } from '../../commands/reference/toolCategories';
import StudioIcon from '../studio/StudioIcon';
import './tool-reference.css';

interface ToolReferenceProps {
  name?: string;
  onSelect?(name?: string): void;
  onClose?(): void;
  onInsert?(command: string): boolean;
  insertUnavailable?: string;
}

const examplePoints = 'B = (0, 0)\nC = (13, 0)\nA = Intersect(Circle(B, 6), Circle(C, 9), 1)\nP = TriangleCenter(A,B,C,1)';

function ReferenceAction({ name, onSelect, children, current }: {
  name?: string;
  onSelect?: ToolReferenceProps['onSelect'];
  children: React.ReactNode;
  current?: boolean;
}) {
  return onSelect
    ? <button type="button" aria-current={current ? 'page' : undefined} onClick={() => onSelect(name)}>{children}</button>
    : <Link aria-current={current ? 'page' : undefined} to={toolReferencePath(name)}>{children}</Link>;
}

function Example({ command, note, onInsert, insertUnavailable }: Pick<ToolReferenceProps, 'onInsert' | 'insertUnavailable'> & {
  command: string;
  note?: string;
}) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setStatus('Copied.');
    } catch {
      setStatus('Select the example text to copy it.');
    }
  };
  return <div className="ggb-reference-example">
    {note && <p>{note}</p>}
    <pre><code>{command}</code></pre>
    <div className="ggb-reference-example-actions">
      <button type="button" onClick={() => void copy()}>Copy</button>
      {onInsert && <button type="button" disabled={Boolean(insertUnavailable)} onClick={() => {
        if (!onInsert(command)) setStatus('The command bar is unavailable. Copy the example to keep it.');
      }}>Insert</button>}
      <span role="status">{status}</span>
    </div>
  </div>;
}

function ToolDetail({ tool, related, onSelect, onInsert, insertUnavailable }: ToolReferenceProps & {
  tool: ReferenceTool;
  related: ReferenceTool[];
}) {
  return <>
    <div className="ggb-reference-paths">{tool.paths.map((path) => <p className="ggb-reference-kicker" key={JSON.stringify(path)}>{path.join(' / ')}</p>)}</div>
    <h3><code>{tool.name}</code></h3>
    <p>{tool.description}</p>
    {tool.aliases.length > 0 && <p className="ggb-reference-aliases">Also available as {tool.aliases.map((alias) => <code key={alias}>{alias}</code>)}</p>}
    <h4>Syntax</h4>
    <ul className="ggb-reference-signatures">
      {tool.signatures.map(({ text, type }) => <li key={text}>
        <code>{text}</code>
        {type && <span>Output type · {type.replace(/([A-Z])/gu, ' $1').toLowerCase()}</span>}
      </li>)}
    </ul>
    {tool.notes?.details && <div className="ggb-reference-notes">
      {tool.notes.details.map((detail) => <p key={detail}>{detail}</p>)}
    </div>}
    {tool.name === 'GibertCurve' && <details className="ggb-reference-ids">
      <summary>Supported catalogue IDs ({gibertReferenceIds.length})</summary>
      <p>{gibertReferenceIds.join(', ')}</p>
    </details>}
    {tool.notes?.examples && <>
      <h4>Examples</h4>
      {tool.notes.examples.map((example) => <Example key={example.command} {...example} onInsert={onInsert} insertUnavailable={insertUnavailable} />)}
      {onInsert && insertUnavailable && <p className="ggb-reference-muted">{insertUnavailable}</p>}
    </>}
    {related.length > 0 && <>
      <h4>Related tools</h4>
      <div className="ggb-reference-related">
        {related.map(({ name }) => <ReferenceAction key={name} name={name} onSelect={onSelect}><code>{name}</code></ReferenceAction>)}
      </div>
    </>}
  </>;
}

function CategoryTree({ categories, tools, selected, onSelect }: {
  categories: ToolCategory;
  tools: readonly ReferenceTool[];
  selected?: ReferenceTool;
  onSelect?: ToolReferenceProps['onSelect'];
}) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const renderCategories = (branches: ToolCategory): React.ReactNode => Object.entries(branches).map(([label, children]) => {
    const names = new Set<string>();
    if (Array.isArray(children)) children.forEach((name) => names.add(name));
    else visitToolCategories(children as ToolCategory, (_path, entries) => entries.forEach((name) => names.add(name)));
    const count = [...names].filter((name) => byName.has(name)).length;
    if (!count) return null;
    return <li key={label} className="ggb-reference-category">
      <details>
        <summary><span>{label}</span><span className="ggb-reference-category-count">{count}</span></summary>
        {Array.isArray(children)
          ? <ul className="ggb-reference-category-tools">{children.flatMap((name) => {
            const tool = byName.get(name);
            return tool ? [<li key={name}><ReferenceAction name={name} onSelect={onSelect} current={selected?.name === name}>
              <code>{name}</code>
            </ReferenceAction></li>] : [];
          })}</ul>
          : <ul className="ggb-reference-category-children">{renderCategories(children as ToolCategory)}</ul>}
      </details>
    </li>;
  });
  return <ul className="ggb-reference-category-tree">{renderCategories(categories)}</ul>;
}

export default function ToolReference({ name, onSelect, onClose, onInsert, insertUnavailable }: ToolReferenceProps) {
  const [query, setQuery] = useState('');
  const [introOpen, setIntroOpen] = useState(false);
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const tools = getReferenceTools();
  const selected = findReferenceTool(tools, name);
  const results = searchReferenceTools(tools, query, '');
  const other = tools.filter((tool) => tool.groups.includes('Other constructions')).map((tool) => tool.name);
  const special = tools.filter((tool) => tool.groups.includes(specialGroup)).map((tool) => tool.name);
  const categories: ToolCategory = { ...toolGroups, ...(other.length ? { 'Other constructions': other } : {}), ...(special.length ? { [specialGroup]: special } : {}) };
  const related = selected?.notes?.related?.flatMap((relatedName) => {
    const tool = findReferenceTool(tools, relatedName);
    return tool ? [tool] : [];
  }) ?? [];
  const Heading = onClose ? 'h2' : 'h1';
  const hasFilter = Boolean(query.trim());
  const showDetail = Boolean(name || introOpen);
  const focusOnNavigate = useRef(false);
  const select = onSelect && ((target?: string) => {
    focusOnNavigate.current = true;
    setIntroOpen(false);
    onSelect(target);
  });

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (!focusOnNavigate.current) return;
    focusOnNavigate.current = false;
    if (showDetail) contentRef.current?.focus({ preventScroll: true });
    else searchRef.current?.focus({ preventScroll: true });
  }, [name, showDetail]);

  return <div className={`ggb-reference ${onClose ? 'ggb-reference-drawer' : 'ggb-reference-page'}`} data-detail={showDetail}>
    <header className="ggb-reference-header">
      <div>
        <p className="ggb-reference-kicker">GeoGebra Studio</p>
        <Heading>Tool Reference</Heading>
        {!onClose && <p className="ggb-reference-introduction">Explore constructions, curves and commands for your geometry workspace.</p>}
      </div>
      <div className="ggb-reference-header-actions">
        {onClose
          ? <Link to={toolReferencePath(selected?.name)} target="_blank" rel="noopener">Open full reference ↗</Link>
          : <Link to="/geogebra">Open Studio →</Link>}
        {onClose && <button type="button" onClick={onClose} aria-label="Close tool reference" className="ggb-reference-close"><StudioIcon name="close" /></button>}
      </div>
    </header>
    <div className="ggb-reference-body">
      <nav aria-label="Browse tools" className="ggb-reference-browser">
        <div className="ggb-reference-filters">
          <label className="sr-only" htmlFor={`${id}-search`}>Search tools</label>
          <input ref={searchRef} id={`${id}-search`} type="search" placeholder="Search tools, aliases or terms…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="ggb-reference-list">
          <div className="ggb-reference-list-meta">
            <ReferenceAction onSelect={onSelect && (() => { focusOnNavigate.current = true; setIntroOpen(true); })}><strong>Quick start</strong></ReferenceAction>
            <span role="status">{results.length} {results.length === 1 ? 'tool' : 'tools'}</span>
          </div>
          {!hasFilter && <p className="ggb-reference-browse-label">Browse by category</p>}
          {results.length === 0 && <div className="ggb-reference-empty">
            <p>No tools match these filters.</p>
            <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }}>Clear search</button>
          </div>}
          <div hidden={hasFilter}><CategoryTree categories={categories} tools={tools} selected={selected} onSelect={select} /></div>
          {hasFilter && results.length > 0 && <ul>
            {results.map(({ tool, alias }) => <li key={tool.name}>
              <ReferenceAction name={tool.name} onSelect={select} current={selected?.name === tool.name}>
                <code>{tool.name}</code>
                {alias && <span>Alias {alias}</span>}
                <span>{tool.description}</span>
              </ReferenceAction>
            </li>)}
          </ul>}
        </div>
      </nav>
      <article ref={contentRef} tabIndex={-1} className="ggb-reference-content" aria-label={selected?.name ?? 'Quick start'}>
        {showDetail && <div className="ggb-reference-back"><ReferenceAction onSelect={select}>← Browse tools</ReferenceAction></div>}
        {selected ? <ToolDetail key={selected.name} tool={selected} related={related} onSelect={select} onInsert={onInsert} insertUnavailable={insertUnavailable} />
          : name ? <><h3>Tool not found</h3><p>Search the directory by command name or alias.</p></>
            : <>
              <h3>Quick start</h3>
              <p>Use these tools in the command bar at the bottom of GeoGebra Studio. Select a category to browse or search for a name, alias or construction.</p>
              <h4>Try a pedal point</h4>
              <Example command={examplePoints} note="In a blank construction, create four points with these commands." onInsert={onInsert} insertUnavailable={insertUnavailable} />
              <p>Open <ReferenceAction name="PedalTriangle" onSelect={select}><code>PedalTriangle</code></ReferenceAction> and try the indexed example to project P onto BC.</p>
              {onInsert && insertUnavailable && <p className="ggb-reference-muted">{insertUnavailable}</p>}
              <p>Commands beginning with <code>!</code> have their own <strong>Special commands</strong> category.</p>
            </>}
      </article>
    </div>
  </div>;
}
