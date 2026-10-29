import type { CommandResult, GeoGebraEngine } from '../../types';
import type { CompiledBindingPlan } from './bindingPlan';
import { beginHelperGroup, isExpectedHelperType } from './internalHelpers';

export const executeNamedPlan = async (engine: GeoGebraEngine, plan: CompiledBindingPlan,
  existing: ReadonlySet<string>, assignmentName?: string): Promise<CommandResult> => {
  const command = [...plan.helpers.map(({ name, expression }) => `${name}=${expression}`), plan.output].join('\n');
  const group = /^ggbaux([0-9a-f]{16})nv\d+$/u.exec(plan.helpers[0]?.name)?.[1];
  if (!group) throw new Error('Invalid internal helper group.');
  const release = beginHelperGroup(group);
  const helperNames = new Set(plan.helpers.map((helper) => helper.name));
  let resultLabels: string[] = [];
  const cleanup = async () => {
    const current = await engine.callApi('getAllObjectNames', []) as string[];
    const owned: string[] = [];
    for (const name of current.filter((name) => !existing.has(name))) {
      if (helperNames.has(name) || name === assignmentName || resultLabels.includes(name)) { owned.push(name); continue; }
      try {
        const definition = String(await engine.callApi('getDefinitionString', [name]));
        if (definition.includes(`ggbaux${group}nv`)) owned.push(name);
      } catch { /* An unreadable object is never guessed to be ours. */ }
    }
    for (const name of owned.reverse()) {
      try { await engine.callApi('deleteObject', [name]); } catch { /* Preserve the original error. */ }
    }
  };
  try {
    await engine.callApi('setUndoPoint', []);
    const result = await engine.executeCommand(command);
    resultLabels = result.labels;
    const after = await engine.callApi('getAllObjectNames', []) as string[];
    const outputs = assignmentName ? after.includes(assignmentName) ? [assignmentName] : []
      : result.labels.filter((name) => !existing.has(name) && !helperNames.has(name) && after.includes(name));
    if (!result.success || !outputs.length) {
      await cleanup();
      return { success: false, command, labels: [],
        error: result.success ? 'GeoGebra did not create the requested output.' : result.error ?? 'GeoGebra rejected this command.', timestamp: Date.now() };
    }
    try {
      for (const helper of plan.helpers) {
        if (!isExpectedHelperType(helper.kind, await engine.callApi('getObjectType', [helper.name])))
          throw new Error(`Unexpected internal object type for ${helper.name}.`);
        await engine.callApi('setAuxiliary', [helper.name, true]);
        await engine.callApi('setVisible', [helper.name, false]);
        await engine.callApi('setLabelVisible', [helper.name, false]);
      }
    } catch (error) {
      await cleanup();
      return { success: false, command, labels: [],
        error: error instanceof Error ? error.message : 'Could not create hidden intermediate values.', timestamp: Date.now() };
    }
    await engine.callApi('setUndoPoint', []);
    return { ...result, labels: outputs };
  } catch (error) {
    await cleanup().catch(() => undefined);
    return { success: false, command, labels: [],
      error: error instanceof Error ? error.message : 'Could not complete the named construction.', timestamp: Date.now() };
  } finally { release(); }
};
