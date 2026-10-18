import type { PointCoordinate } from '../graphTypes';

export const displacement = (from: PointCoordinate, to: PointCoordinate): PointCoordinate => ({ x: to.x - from.x, y: to.y - from.y });
export const dot = (a: PointCoordinate, b: PointCoordinate): number => a.x * b.x + a.y * b.y;
export const cross = (a: PointCoordinate, b: PointCoordinate): number => a.x * b.y - a.y * b.x;
export const squaredNorm = (a: PointCoordinate): number => dot(a, a);
export const orientedDoubleArea = (a: PointCoordinate, b: PointCoordinate, c: PointCoordinate): number => cross(displacement(a, b), displacement(a, c));
export const powerOfCircle = (point: PointCoordinate, center: PointCoordinate, radius: number): number => squaredNorm(displacement(center, point)) - radius * radius;
export const polarEvaluation = (point: PointCoordinate, pole: PointCoordinate, center: PointCoordinate, radius: number): number => dot(displacement(center, point), displacement(center, pole)) - radius * radius;

/** Zero power at the orthogonal projection characterizes line/circle tangency. */
export const tangentPower = (center: PointCoordinate, radius: number, onLine: PointCoordinate, direction: PointCoordinate): number | null => {
  const norm = squaredNorm(direction);
  if (!(norm > 0) || !Number.isFinite(norm)) return null;
  const distance = cross(direction, displacement(onLine, center)) / Math.sqrt(norm);
  return distance * distance - radius * radius;
};
