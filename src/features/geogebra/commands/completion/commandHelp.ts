import type { CompletionItem } from './types';

// Optional help is separate from the generated name index and provider logic.
export const COMMAND_HELP: Record<string, Pick<CompletionItem, 'description' | 'signatures'>> = {
  Circle: { description: 'Construct a circle from its center and radius, or from three points.', signatures: ['Circle(center, radius)', 'Circle(A, B, C)'] },
  Line: { description: 'Construct a line through two points.', signatures: ['Line(A, B)'] },
  Segment: { description: 'Connect two endpoints.', signatures: ['Segment(A, B)'] },
  Ray: { description: 'Construct a ray from its start point through another point.', signatures: ['Ray(A, B)'] },
  Intersect: { description: 'Find intersections of two objects.', signatures: ['Intersect(object1, object2)'] },
  Midpoint: { description: 'Find the midpoint of two points or a segment.', signatures: ['Midpoint(A, B)', 'Midpoint(segment)'] },
  Distance: { description: 'Measure the distance between objects.', signatures: ['Distance(A, B)'] },
  Angle: { description: 'Measure an angle with the middle point as its vertex.', signatures: ['Angle(A, B, C)'] },
  PerpendicularLine: { description: 'Construct a perpendicular through a point.', signatures: ['PerpendicularLine(point, line)'] },
  ParallelLine: { description: 'Construct a parallel through a point.', signatures: ['ParallelLine(point, line)'] },
  Polygon: { description: 'Construct a polygon from its vertices.', signatures: ['Polygon(A, B, C, ...)'] },
  Reflect: { description: 'Reflect an object about a point or line.', signatures: ['Reflect(object, pointOrLine)'] },
  Rotate: { description: 'Rotate an object around a center.', signatures: ['Rotate(object, angle, center)'] },
  Translate: { description: 'Move an object by a vector.', signatures: ['Translate(object, vector)'] },
  Vector: { description: 'Construct a vector from two points.', signatures: ['Vector(A, B)'] },
  Point: { description: 'Create a point on a path.', signatures: ['Point(path)'] },
  Derivative: { description: 'Differentiate a function.', signatures: ['Derivative(function)'] },
  Integral: { description: 'Find an antiderivative or a definite integral.', signatures: ['Integral(function)', 'Integral(function, start, end)'] },
};
