import type { CommandResult, GeoGebraEngine } from '../types';
import { compileStudioCommand, containsStudioCall } from './custom/commandCompiler';
import { readCommandEnvironment } from './custom/commandEnvironment';
import { splitTopLevel } from './custom/commandSyntax';

export const normalizeCommand = (command: string): string =>
  command
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export const executeCommandPipeline = async (engine: GeoGebraEngine, command: string): Promise<CommandResult> => {
  const normalized = normalizeCommand(command);
  if (!containsStudioCall(normalized)) return engine.executeCommand(normalized);
  const labels: string[] = [];
  const expanded: string[] = [];
  try {
    for (const statement of splitTopLevel(normalized, '\n').filter((line) => line.trim())) {
      // Resolve after the previous statement: newly created objects and functions
      // participate in overload selection without numeric coordinate sampling.
      const compiled = containsStudioCall(statement) ? compileStudioCommand(statement, await readCommandEnvironment(engine)) : statement;
      expanded.push(compiled);
      const result = await engine.executeCommand(compiled);
      labels.push(...result.labels);
      if (!result.success) return { ...result, command: normalized, labels, expandedCommand: expanded.join('\n') };
    }
  } catch (error) {
    return { success: false, command: normalized, labels, expandedCommand: expanded.join('\n'), error: error instanceof Error ? error.message : 'Unable to compile the custom command.', timestamp: Date.now() };
  }
  return { success: true, command: normalized, labels, expandedCommand: expanded.join('\n'), timestamp: Date.now() };
};
