import type { CommandResult, GeoGebraEngine } from '../types';
import { compileStudioCommand, compileStudioPlan, containsStudioCall, extendedTriangleCenterIds } from './custom/commandCompiler';
import { readCommandEnvironment } from './custom/commandEnvironment';
import { prepareTriangleCenter } from './custom/builders/triangleCenters';
import { splitTopLevel, unpackAssignment } from './custom/commandSyntax';
import { newHelperGroupId } from './custom/internalHelpers';
import { executeNamedPlan } from './custom/namedExecution';

export const normalizeCommand = (command: string): string =>
  command
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export const executeCommandPipeline = async (engine: GeoGebraEngine, command: string,
  options: { helperMode?: 'low' | 'medium' | 'high'; allowNonGeometricHelpers?: boolean } = {}): Promise<CommandResult> => {
  const normalized = normalizeCommand(command);
  const labels: string[] = [];
  const expanded: string[] = [];
  try {
    const statements = splitTopLevel(normalized, '\n').filter((line) => line.trim());
    if (!statements.some((statement) => containsStudioCall(statement))) return engine.executeCommand(normalized);
    for (const statement of statements) {
      // Resolve after the previous statement: newly created objects and functions
      // participate in overload selection without numeric coordinate sampling.
      const custom = containsStudioCall(statement);
      const expectedLabels = unpackAssignment(statement)?.labels;
      const environment = custom ? await readCommandEnvironment(engine) : null;
      if (environment) for (const id of new Set(extendedTriangleCenterIds(statement, environment))) await prepareTriangleCenter(id);
      const mode = options.helperMode ?? (options.allowNonGeometricHelpers ? 'medium' : 'low');
      const plan = custom && mode !== 'low'
        ? compileStudioPlan(statement, environment!, newHelperGroupId(), mode) : null;
      const assignmentName = /^([\p{L}_][\p{L}\p{N}_{}'′]*)\s*=/u.exec(statement)?.[1];
      const existing = plan?.materialized || expectedLabels ? new Set(await engine.callApi('getAllObjectNames', []) as string[]) : null;
      const canMaterialize = Boolean(plan?.materialized && existing
        && (!assignmentName || !existing.has(assignmentName))
        && plan.helpers.every((helper) => !existing.has(helper.name)));
      if (plan?.requiresMaterialization && !canMaterialize)
        throw new Error('This curve requires a new output label in Medium or High mode. Delete its existing output before recreating it.');
      const compiled = canMaterialize ? [...plan!.helpers.map(({ name, expression }) => `${name}=${expression}`), plan!.output].join('\n')
        : custom ? plan?.materialized ? compileStudioCommand(statement, environment!) : plan?.output ?? compileStudioCommand(statement, environment!) : statement;
      expanded.push(compiled);
      const result = canMaterialize
        ? await executeNamedPlan(engine, plan!, existing!, assignmentName, expectedLabels)
        : expectedLabels ? await executeNamedPlan(engine, { output: compiled, helpers: [], materialized: false },
          existing!, undefined, expectedLabels) : await engine.executeCommand(compiled);
      labels.push(...result.labels);
      if (!result.success) return { ...result, command: normalized, labels, expandedCommand: expanded.join('\n') };
    }
  } catch (error) {
    return { success: false, command: normalized, labels, expandedCommand: expanded.join('\n'), error: error instanceof Error ? error.message : 'Unable to compile the custom command.', timestamp: Date.now() };
  }
  return { success: true, command: normalized, labels, expandedCommand: expanded.join('\n'), timestamp: Date.now() };
};
