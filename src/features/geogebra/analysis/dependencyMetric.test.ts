import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from './constructionGraph';
import { buildDependencyProfile, explainDependencySeparation, measureDependencySeparation, scoreDependencySeparation } from './dependencyMetric';
import type { ConstructionObjectInput } from './graphTypes';

const object = (name: string, commandString = ''): ConstructionObjectInput => ({ name, objectType: 'point', commandString });
const free = (...names: string[]): ConstructionObjectInput[] => names.map((name) => object(name));
const measure = (objects: ConstructionObjectInput[], names: string[]) => measureDependencySeparation(buildDependencyProfile(buildDependencyGraph(objects)), names);
const value = (objects: ConstructionObjectInput[], names: string[]) => scoreDependencySeparation(measure(objects, names));

describe('construction locality scoring', () => {
  it('treats midpoint, opaque functions, and anonymous nested expressions uniformly', () => {
    const scores = ['Midpoint(A,B)', '(A+B)/2', 'Mystery(A,B)', 'Outer(Inner(A),Inner(B))'].map((definition) =>
      value([...free('A', 'B'), object('M', definition)], ['M', 'A', 'B']));
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBeLessThan(10);
  });

  it('recognizes the symmedian example structurally without knowing either command', () => {
    const objects = [...free('A', 'B', 'C'), object('K', 'TriangleCenter(A,B,C,6)'), object('D', 'HarmonicConjugate(B,C,A)')];
    expect(value(objects, ['A', 'K', 'D'])).toBeLessThan(15);
    expect(value(objects, ['K', 'D'])).toBeLessThan(35);
    const anonymous = [...free('A', 'B', 'C'), object('K', 'F(A,B,C)'), object('D', 'G(A,B,C)')];
    expect(value(anonymous, ['A', 'K', 'D'])).toBe(value(objects, ['A', 'K', 'D']));
  });

  it('does not dilute direct output/input links with all the independent input pairs', () => {
    const scores = [2, 4, 16].map((count) => {
      const names = Array.from({ length: count }, (_, index) => `A${index}`);
      return value([...free(...names), object('Q', `Unknown(${names.join(',')})`)], [...names, 'Q']);
    });
    expect(scores[0]).toBeLessThan(scores[1]);
    expect(scores[1]).toBeLessThan(scores[2]);
    expect(scores[2]).toBeLessThan(25);
  });

  it('considers functions of more side inputs somewhat less local', () => {
    const score = (count: number) => {
      const names = Array.from({ length: count }, (_, index) => `P${index}`);
      return value([...free(...names), object('X', `F(${names.join(',')})`), object('Y', `G(${names.join(',')})`)], ['X', 'Y']);
    };
    expect(score(3)).toBeLessThan(score(30));
  });

  it('raises the score modestly when a user explicitly expands a construction', () => {
    const base = free('A', 'B', 'C', 'P');
    const names = ['A', 'B', 'C', 'P', 'Q'];
    const direct = value([...base, object('Q', 'Unknown(A,B,C,P)')], names);
    const expanded = value([...base,
      object('Pa', 'Reflect(P,Line(B,C))'), object('Pb', 'Reflect(P,Line(C,A))'), object('Pc', 'Reflect(P,Line(A,B))'),
      object('Q', 'Circumcenter(Pa,Pb,Pc)'),
    ], names);
    expect(expanded).toBeGreaterThan(direct);
    expect(expanded - direct).toBeLessThan(20);
  });

  it('ranks deeper separate branches above immediate properties of a triangle', () => {
    const objects = [...free('A', 'B', 'C'), object('X0', 'F(A,B,C)'), object('Y0', 'G(A,B,C)'), object('Z0', 'H(A,B,C)')];
    const scores = [value(objects, ['X0', 'Y0', 'Z0'])];
    for (let depth = 1; depth <= 4; depth += 1) {
      for (const label of ['X', 'Y', 'Z']) objects.push(object(`${label}${depth}`, `Next(${label}${depth - 1})`));
      scores.push(value(objects, [`X${depth}`, `Y${depth}`, `Z${depth}`]));
    }
    expect(scores.every((score, index) => index === 0 || score > scores[index - 1])).toBe(true);
  });

  it('does not reward arbitrary depth above a nearby construction', () => {
    const base = [...free('A', 'B', 'C'), object('X', 'F(A,B,C)'), object('Y', 'G(A,B,C)')];
    const padded = [...free('U'), object('V', 'Step(U)'), ...base.map((node) => node.name === 'A' ? object('A', 'Step(V)') : node)];
    expect(value(padded, ['A', 'X', 'Y'])).toBe(value(base, ['A', 'X', 'Y']));
  });

  it('ignores identity aliases, including duplicate arguments referring to the same object', () => {
    const base = [...free('A', 'B'), object('M', 'F(A,B)')];
    const aliased = [...free('A', 'B'), object('Alias', 'A'), object('Alias2', 'Alias'), object('M', 'F(A,Alias2,B)')];
    expect(value(aliased, ['Alias2', 'B', 'M'])).toBe(value(base, ['A', 'B', 'M']));
    expect(value(aliased, ['A', 'Alias', 'Alias2', 'B', 'M'])).toBe(value(base, ['A', 'B', 'M']));
    expect(value([...base, object('X', 'Arbitrary(M)')], ['A', 'B', 'X'])).toBeGreaterThan(value(base, ['A', 'B', 'M']));
  });

  it('does not connect free points through the root or an unrelated downstream construction', () => {
    const objects = [...free('A', 'B', 'C'), object('Later', 'F(A,B,C)')];
    const metric = measure(objects, ['A', 'B', 'C']);
    expect(metric.connectedComponents).toBe(3);
    expect(metric.constructionSpan).toBeNull();
    expect(value(objects, ['A', 'B', 'C'])).toBe(100);
  });

  it('does not let numerous nearby points hide one unrelated point', () => {
    const objects = [...free('A', 'B', 'Unrelated'), ...Array.from({ length: 30 }, (_, index) => object(`M${index}`, 'F(A,B)'))];
    const names = objects.filter((node) => node.name !== 'Unrelated').map((node) => node.name);
    expect(value(objects, names)).toBeLessThan(10);
    expect(value(objects, [...names, 'Unrelated'])).toBe(100);
  });

  it('is invariant to object order, renaming, duplicate names, and unrelated objects', () => {
    const objects = [...free('A', 'B', 'C'), object('X', 'F(A,B,C)'), object('Y', 'G(A,B,C)')];
    const baseline = measure(objects, ['A', 'X', 'Y']);
    expect(measure([...objects].reverse(), ['Y', 'A', 'X', 'X'])).toEqual(baseline);
    expect(measure([...objects, ...free('U', 'V'), object('W', 'F(U,V)')], ['A', 'X', 'Y'])).toEqual(baseline);
    const rename = (text: string) => text.replace(/\bA\b/g, 'Alpha').replace(/\bX\b/g, 'Omega');
    expect(measure(objects.map((node) => ({ ...node, name: rename(node.name), commandString: rename(node.commandString ?? '') })), ['Alpha', 'Omega', 'Y'])).toEqual(baseline);
  });

  it('handles a shared non-point parent such as four points on one circle', () => {
    const objects = [{ ...object('c'), objectType: 'circle' }, ...['P', 'Q', 'R', 'S'].map((name) => object(name, 'Point(c)'))];
    expect(value(objects, ['P', 'Q', 'R', 'S'])).toBeLessThan(15);
  });
});

describe('dependency quality and search boundaries', () => {
  it('does not turn read errors or their downstream effects into full-value independence', () => {
    const objects = [...free('A', 'B'), { ...object('Unknown'), readError: 'unavailable' }, object('Child', 'F(Unknown)')];
    const metric = measure(objects, ['A', 'B', 'Child']);
    expect(metric.dependencyCoverage).toBeCloseTo(2 / 3);
    expect(scoreDependencySeparation(metric)).toBe(50);
    expect(explainDependencySeparation(metric)).toContain('incomplete');
  });

  it('keeps best-effort partial dependencies local while marking the score incomplete', () => {
    const objects = [...free('A', 'B'), object('M', 'A ⊗ B')];
    const metric = measure(objects, ['A', 'B', 'M']);
    expect(metric.dependencyCoverage).toBeLessThan(1);
    expect(scoreDependencySeparation(metric)).toBeLessThan(10);
  });

  it('handles cycles without recursion or false complete-dependency claims', () => {
    const objects = [object('X', 'F(Y)'), object('Y', 'G(X)'), object('Z', 'H(X)')];
    const metric = measure(objects, ['X', 'Y', 'Z']);
    expect(metric.dependencyCoverage).toBe(0);
    expect(Number.isFinite(scoreDependencySeparation(metric))).toBe(true);
    expect(scoreDependencySeparation(metric)).toBeLessThanOrEqual(50);
  });

  it('marks a self-reference incomplete even when the display graph omits self-loops', () => {
    expect(measure([object('A', 'F(A)'), object('B', 'G(A)')], ['A', 'B']).dependencyCoverage).toBe(0);
  });

  it('handles absent names and trivial inputs with finite scores', () => {
    for (const names of [[], ['A'], ['Missing'], ['A', 'Missing']]) {
      expect(Number.isFinite(value(free('A'), names))).toBe(true);
    }
  });

  it('uses the cheapest ancestral route when multiple paths have different fan-in costs', () => {
    const objects = [...free('A', 'B', 'C', 'D'), object('Wide', 'F(A,B,C,D)'), object('Narrow', 'G(A)'), object('P', 'H(Wide,Narrow)')];
    // P -> Narrow -> A is cheaper than P -> Wide -> A.
    expect(measure(objects, ['P', 'A']).constructionSpan).toBeCloseTo(2.5);
  });

  it('agrees with an exhaustive path oracle on a branching DAG', () => {
    const objects = [...free('P0', 'P1', 'P2')];
    // Deterministic fan-in/path variation exercises alternative heap routes.
    for (let index = 3; index < 24; index += 1) {
      const parents = [...new Set([index - 1, Math.floor(index / 2), index % 3])];
      objects.push(object(`P${index}`, `F(${parents.map((parent) => `P${parent}`).join(',')})`));
    }
    const profile = buildDependencyProfile(buildDependencyGraph(objects));
    const walk = (id: string, distance: number, result: Map<string, number>) => {
      if (distance >= (result.get(id) ?? Infinity)) return;
      result.set(id, distance);
      for (const parent of profile.parents.get(id) ?? []) walk(parent, distance + profile.stepCosts.get(id)!, result);
    };
    for (let left = 0; left < objects.length; left += 1) {
      for (let right = left + 1; right < objects.length; right += 1) {
        const a = new Map<string, number>(); const b = new Map<string, number>();
        walk(profile.nodeIdsByName.get(`P${left}`)!, 0, a);
        walk(profile.nodeIdsByName.get(`P${right}`)!, 0, b);
        const expected = Math.min(...[...a].map(([id, cost]) => cost + (b.get(id) ?? Infinity)));
        const actual = measureDependencySeparation(profile, [`P${left}`, `P${right}`]).constructionSpan;
        if (Number.isFinite(expected)) expect(actual).toBeCloseTo(expected);
        else expect(actual).toBeNull();
      }
    }
  });

  it('handles deep named constructions without recursive stack growth', () => {
    const objects = [object('P0'), ...Array.from({ length: 1200 }, (_, index) => object(`P${index + 1}`, `F(P${index})`))];
    const metric = measure(objects, ['P0', 'P1200']);
    expect(metric.constructionSpan).toBe(1200);
    expect(metric.dependencyCoverage).toBe(1);
  });
});
