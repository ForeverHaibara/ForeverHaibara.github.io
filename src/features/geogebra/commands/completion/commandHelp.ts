import type { CompletionItem } from './types';

// Optional help is separate from the generated name index and provider logic.
export const COMMAND_HELP: Record<string, Pick<CompletionItem, 'description' | 'signatures'>> = {
  ParallelLine: { description: 'Construct a parallel through a point.', signatures: ['ParallelLine(point, line)'] },
  Reflect: { description: 'Reflect an object about a point or line.', signatures: ['Reflect(object, pointOrLine)'] },
  Rotate: { description: 'Rotate an object around a center.', signatures: ['Rotate(object, angle, center)'] },
  Translate: { description: 'Move an object by a vector.', signatures: ['Translate(object, vector)'] },
  Vector: { description: 'Construct a vector from two points.', signatures: ['Vector(A, B)'] },
  Derivative: { description: 'Differentiate a function.', signatures: ['Derivative(function)'] },
  Integral: { description: 'Find an antiderivative or a definite integral.', signatures: ['Integral(function)', 'Integral(function, start, end)'] },
};
