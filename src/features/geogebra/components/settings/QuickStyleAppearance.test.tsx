import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import QuickStyleAppearance from './QuickStyleAppearance';
import type { SelectedObjectStyle } from '../../settings/objectStyles';

const point: SelectedObjectStyle = { name: 'P', type: 'point', typeLabel: 'Point', point: true, line: false, fill: false, stroke: false, xml: '', color: '#ff0000', size: 5, pointStyle: 0 };
const line: SelectedObjectStyle = { ...point, name: 'l', type: 'segment', typeLabel: 'Segment', point: false, line: true, stroke: true, pointStyle: undefined, lineStyle: 2, strokeOpacity: .4 };
const render = (objects: SelectedObjectStyle[]) => renderToStaticMarkup(<QuickStyleAppearance objects={objects} onEdit={() => {}} />);

describe('capability-based quick appearance controls', () => {
  it('offers native point styles without ineffective fill or line controls for a point', () => {
    const html = render([point]);
    expect(html).toContain('Set point style: Triangle up');
    expect(html).toContain('Set point style: Circle without outline');
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('Set line style:');
  });
  it('offers dash density and stroke opacity for an unfilled line', () => {
    const html = render([line]);
    expect(html).toContain('Set line style: Long dash · sparse');
    expect(html).toContain('Set line style: Short dash · dense');
    expect(html).toContain('aria-label="Opacity"');
    expect(html).toContain('40%');
  });
  it('separates fill opacity from stroke opacity for a region or mixed selection', () => {
    const html = render([point, { ...line, name: 'c', type: 'circle', fill: true, opacity: .2 }]);
    expect(html).toContain('aria-label="Fill opacity"');
    expect(html).toContain('aria-label="Stroke opacity"');
    expect(html).toContain('aria-label="Point style"');
    expect(html).toContain('aria-label="Line style"');
  });
});
