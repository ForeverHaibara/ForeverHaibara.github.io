import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ToolReference from './ToolReference';
import { nativeCommandReference } from '../../commands/toolReference';
import { studioToolCatalog } from '../../commands/custom/toolLibrary';

describe('Tool Reference', () => {
  it.each([false, true])('shows native descriptions and the command index in both modes (drawer: %s)', (drawer) => {
    const props = drawer ? { onClose() {}, onSelect() {} } : {};
    const render = (name: string) => renderToStaticMarkup(<MemoryRouter><ToolReference name={name} {...props} /></MemoryRouter>);
    const mixed = render('Conic');
    expect(mixed).toContain(studioToolCatalog.tools.find((tool) => tool.name === 'Conic')!.description);
    expect(mixed).toContain(nativeCommandReference.Conic.description);
    expect(mixed).toContain('https://geogebra.github.io/docs/manual/en/commands/All_Commands/');
    const nativeOnly = render('Incircle');
    expect(nativeOnly.split(nativeCommandReference.Incircle.description)).toHaveLength(2);
    expect(nativeOnly).toContain('https://geogebra.github.io/docs/manual/en/commands/All_Commands/');
  });
});
