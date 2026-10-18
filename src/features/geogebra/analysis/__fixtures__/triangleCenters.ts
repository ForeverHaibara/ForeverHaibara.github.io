import type { ConstructionObjectInput, PointCoordinate } from '../graphTypes';

export const triangleCenterFixture = (): ConstructionObjectInput[] => {
  const a = { x: -0.7, y: 0.4 }; const b = { x: 4.1, y: -0.3 }; const c = { x: 1.2, y: 3.7 };
  const bx = b.x - a.x; const by = b.y - a.y; const cx = c.x - a.x; const cy = c.y - a.y;
  const determinant = 2 * (bx * cy - by * cx);
  const o = { x: a.x + ((bx * bx + by * by) * cy - (cx * cx + cy * cy) * by) / determinant,
    y: a.y + ((cx * cx + cy * cy) * bx - (bx * bx + by * by) * cx) / determinant };
  const h = { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y };
  const weights = [Math.hypot(b.x - c.x, b.y - c.y), Math.hypot(a.x - c.x, a.y - c.y), Math.hypot(a.x - b.x, a.y - b.y)];
  const sum = weights.reduce((s, w) => s + w, 0);
  const i = { x: (weights[0] * a.x + weights[1] * b.x + weights[2] * c.x) / sum,
    y: (weights[0] * a.y + weights[1] * b.y + weights[2] * c.y) / sum };
  const point = (name: string, coordinates: PointCoordinate, commandString = ''): ConstructionObjectInput => ({ name, coordinates, commandString, objectType: 'point' });
  return [point('A', a), point('B', b), point('C', c), point('O', o, 'TriangleCenter(A,B,C,3)'), point('H', h, 'TriangleCenter(A,B,C,4)'),
    point('I', i, 'TriangleCenter(A,B,C,1)'), point('G', { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }, 'Centroid(A,B,C)')];
};
