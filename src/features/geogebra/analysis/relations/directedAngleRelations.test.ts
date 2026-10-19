import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../constructionGraph';
import { detectGeometryRelations } from '../geometryRelations';
import { canonicalDirectionEquation, directedAngleValue, wrapHalfTurns } from '../quantities/directedAngles';
import { DEFAULT_DISCOVERY_OPTIONS } from './catalog';

const ray = (degrees: number) => ({ x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) });
const origin = { x: 0, y: 0 };
const equation = (target: string, coefficient: number, numerator = 0, denominator = 1) => canonicalDirectionEquation([
  { angle: ['B', 'A', target], coefficient: 1 }, { angle: ['B', 'A', 'C'], coefficient },
], { numerator, denominator }).key;
const discover = (target: number, rotation = 0, maxAngles = 1000) => {
  const graph = buildDependencyGraph([origin, ray(0), ray(30), ray(target)].map((coordinates, i) => ({
    name: ['A', 'B', 'C', 'D'][i], objectType: 'point', commandString: '',
    coordinates: { x: coordinates.x * Math.cos(rotation) - coordinates.y * Math.sin(rotation), y: coordinates.x * Math.sin(rotation) + coordinates.y * Math.cos(rotation) },
  })), 123);
  const result = detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['directed-angles'], maxAngles });
  const keys = new Set(result.relations.map((relation) => {
    const eq = relation.witnesses[0].equation!;
    return canonicalDirectionEquation(eq.terms.map((term) => ({ angle: term.quantity.points as [string, string, string], coefficient: term.coefficient })), eq.pi!).key;
  }));
  return { result, keys };
};

describe('directed angle discovery and circle semantics', () => {
  it('distinguishes mirrored equal ordinary angles from equal directed angles', () => {
    const { keys } = discover(-30);
    expect(keys.has(equation('D', -1))).toBe(false);
    expect(keys.has(equation('D', 1))).toBe(true);
  });
  it('discovers ordered double-angle equations without cancelling modular factors', () => {
    expect(discover(60).keys.has(equation('D', -2))).toBe(true);
    const doubled = canonicalDirectionEquation([{ angle: ['B', 'A', 'C'], coefficient: 2 }], { numerator: 0, denominator: 1 });
    const single = canonicalDirectionEquation([{ angle: ['B', 'A', 'C'], coefficient: 1 }], { numerator: 0, denominator: 1 });
    expect(doubled.key).not.toBe(single.key);
    expect(doubled.terms.map((term) => term.coefficient)).toEqual([2, -2]);
  });
  it('finds half-turn offsets and is independent of the world-axis cut', () => {
    expect(discover(120).keys.has(equation('D', -1, 1, 2))).toBe(true);
    expect(discover(120, 2.4).keys).toEqual(discover(120).keys);
  });
  it('treats line reversal modulo pi, angle-side exchange and reflection consistently', () => {
    const value = directedAngleValue(ray(0), origin, ray(30))!;
    expect(Math.abs(wrapHalfTurns(directedAngleValue(ray(180), origin, ray(30))! - value))).toBeLessThan(1e-12);
    expect(Math.abs(wrapHalfTurns(directedAngleValue(ray(30), origin, ray(0))! + value))).toBeLessThan(1e-12);
    expect(Math.abs(wrapHalfTurns(directedAngleValue(ray(0), origin, ray(-30))! + value))).toBeLessThan(1e-12);
    expect(directedAngleValue(origin, origin, ray(30))).toBeNull();
  });
  it('reports incomplete directed-angle search when its candidate budget is exhausted', () => {
    const { result } = discover(30, 0, 0);
    expect(result.relations).toHaveLength(0);
    expect(result.diagnostics.join(' ')).toContain('Directed angle candidates limit');
  });
});
