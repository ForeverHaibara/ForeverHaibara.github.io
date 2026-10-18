import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../types';
import { readPointConstraint, readPointRole } from './pointRoles';

const command = (name: string, output: string, input = 'g') => `<command name="${name}"><input a0="${input}"/><output a0="${output}"/></command>`;

function engine(independent: boolean, xml: string, type = 'line', moveable = false) {
  return { callApi: vi.fn(async (method: string) => {
    if (method === 'isIndependent') return independent;
    if (method === 'getAlgorithmXML') return xml;
    if (method === 'getObjectType') return type;
    if (method === 'isMoveable') return moveable;
    throw new Error(`Unexpected call: ${method}`);
  }) } as unknown as GeoGebraEngine;
}

describe('point roles', () => {
  it('identifies a free point independently of its fixed/moveable flag', async () => {
    const source = engine(true, '');
    expect(await readPointRole(source, 'A')).toBe('free');
    expect(source.callApi).toHaveBeenCalledTimes(1);
  });

  it('recognizes points on a path and in a region even when they are manually locked', async () => {
    expect(await readPointRole(engine(false, command('Point', 'T')), 'T')).toBe('constrained');
    expect(await readPointRole(engine(false, command('PointIn', 'T')), 'T')).toBe('constrained');
  });

  it('recognizes intersections, midpoints and movable slider-dependent points as dependent', async () => {
    for (const construction of ['Intersect', 'Midpoint', 'Expression']) {
      expect(await readPointRole(engine(false, command(construction, 'I'), 'line', true), 'I')).toBe('dependent');
    }
  });

  it('matches the target output instead of a nested anonymous path-point algorithm', () => {
    const xml = command('Point', 'temp') + command('Midpoint', 'M');
    expect(readPointConstraint(xml, 'M')).toBeNull();
    expect(readPointConstraint(command('Point', 'A&apos;'), "A'")).toEqual({ command: 'Point', input: 'g' });
  });

  it('does not mistake coordinate points from lists for points constrained to a path', async () => {
    expect(await readPointRole(engine(false, command('Point', 'T', '{a,b}')), 'T')).toBe('dependent');
    expect(await readPointRole(engine(false, command('Point', 'T', 'L'), 'list', false), 'T')).toBe('dependent');
  });
});
