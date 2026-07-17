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
      const commandString = commandResult.status === 'fulfilled'
        ? (typeof commandResult.value === 'string' ? commandResult.value : commandResult.value == null ? '' : String(commandResult.value))
        : null;
      const objectType = typeResult.status === 'fulfilled'
        ? (typeof typeResult.value === 'string' ? typeResult.value : typeResult.value == null ? null : String(typeResult.value))
        : null;
      if (commandResult.status === 'rejected') errors.push(`getCommandString(${name}): ${commandResult.reason instanceof Error ? commandResult.reason.message : String(commandResult.reason)}`);
      if (typeResult.status === 'rejected') errors.push(`getObjectType(${name}): ${typeResult.reason instanceof Error ? typeResult.reason.message : String(typeResult.reason)}`);
      if (errors.length > 0) diagnostics.push(...errors);
      return { name, objectType, commandString, ...(errors.length > 0 ? { readError: errors.join(' ') } : {}) };
    }));

    return { objects, diagnostics, capturedAt: Date.now() };
  }
}

