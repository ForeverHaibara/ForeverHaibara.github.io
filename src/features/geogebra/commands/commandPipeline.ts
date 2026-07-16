import type { CommandResult, GeoGebraEngine } from '../types';

export const normalizeCommand = (command: string): string =>
  command
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export const executeCommandPipeline = (engine: GeoGebraEngine, command: string): Promise<CommandResult> => {
  const normalized = normalizeCommand(command);
  return engine.executeCommand(normalized);
};
