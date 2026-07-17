import type { ConstructionObjectInput } from './graphTypes';
import type { GeoGebraEngine } from '../types';

export interface ConstructionSnapshot {
  objects: ConstructionObjectInput[];
  diagnostics: string[];
  capturedAt: number;
}

const normalizeObjectNames = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (typeof value === 'string') return value.split(',').map((name) => name.trim()).filter(Boolean);
  return [];
};

const isTwoDimensionalPoint = (objectType: string | null): boolean => {
  const normalized = objectType?.toLowerCase().replace(/^geo/u, '') ?? '';
  return normalized === 'point' || normalized === 'pointonpath' || normalized === 'pointinregion';
};

const finiteNumber = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
};

export interface ConstructionSource {
  read(): Promise<ConstructionSnapshot>;
}

export class GeoGebraConstructionSource implements ConstructionSource {
  public constructor(private readonly engine: GeoGebraEngine) {}

  public async read(): Promise<ConstructionSnapshot> {
    const diagnostics: string[] = [];
    let names: string[];
    try {
      names = normalizeObjectNames(await this.engine.callApi('getAllObjectNames', []));
    } catch (error) {
      return { objects: [], diagnostics: [error instanceof Error ? error.message : 'Unable to read GeoGebra object names.'], capturedAt: Date.now() };
    }

    const objects = await Promise.all(names.map(async (name): Promise<ConstructionObjectInput> => {
      const [commandResult, typeResult] = await Promise.allSettled([
        this.engine.callApi('getCommandString', [name]),
        this.engine.callApi('getObjectType', [name]),
      ]);
      const errors: string[] = [];
      const coordinateErrors: string[] = [];
      const commandString = commandResult.status === 'fulfilled'
        ? (typeof commandResult.value === 'string' ? commandResult.value : commandResult.value == null ? '' : String(commandResult.value))
        : null;
      const objectType = typeResult.status === 'fulfilled'
        ? (typeof typeResult.value === 'string' ? typeResult.value : typeResult.value == null ? null : String(typeResult.value))
        : null;
      if (commandResult.status === 'rejected') errors.push(`getCommandString(${name}): ${commandResult.reason instanceof Error ? commandResult.reason.message : String(commandResult.reason)}`);
      if (typeResult.status === 'rejected') errors.push(`getObjectType(${name}): ${typeResult.reason instanceof Error ? typeResult.reason.message : String(typeResult.reason)}`);
      let coordinates;
      if (isTwoDimensionalPoint(objectType)) {
        const [xResult, yResult] = await Promise.allSettled([
          this.engine.callApi('getXcoord', [name]),
          this.engine.callApi('getYcoord', [name]),
        ]);
        const x = xResult.status === 'fulfilled' ? finiteNumber(xResult.value) : null;
        const y = yResult.status === 'fulfilled' ? finiteNumber(yResult.value) : null;
        if (x !== null && y !== null) coordinates = { x, y };
        else {
          if (xResult.status === 'rejected') coordinateErrors.push(`getXcoord(${name}): ${xResult.reason instanceof Error ? xResult.reason.message : String(xResult.reason)}`);
          if (yResult.status === 'rejected') coordinateErrors.push(`getYcoord(${name}): ${yResult.reason instanceof Error ? yResult.reason.message : String(yResult.reason)}`);
          if (x === null && xResult.status === 'fulfilled') coordinateErrors.push(`getXcoord(${name}): returned a non-finite value.`);
          if (y === null && yResult.status === 'fulfilled') coordinateErrors.push(`getYcoord(${name}): returned a non-finite value.`);
        }
      }
      if (errors.length > 0 || coordinateErrors.length > 0) diagnostics.push(...errors, ...coordinateErrors);
      return { name, objectType, commandString, ...(coordinates ? { coordinates } : {}), ...(coordinateErrors.length > 0 ? { coordinateError: coordinateErrors.join(' ') } : {}), ...(errors.length > 0 ? { readError: errors.join(' ') } : {}) };
    }));

    return { objects, diagnostics, capturedAt: Date.now() };
  }
}
