import { API_METHODS } from '../../types';
import { CompletionRegistry } from './completionRegistry';
import { GEOGEBRA_COMMAND_NAMES } from './geogebraCommandNames';
import { COMMAND_HELP } from './commandHelp';
import { studioToolLibrary, toolSignature } from '../custom/toolLibrary';
import { advancedCommands } from '../advancedCommands';
import { nativeCommandReference } from '../toolReference';

/** Shared by all studio command bars. Extensions can also inject their own registry. */
export const studioCompletionRegistry = new CompletionRegistry();

studioCompletionRegistry.registerCommands('geogebra', GEOGEBRA_COMMAND_NAMES.map((label) => ({
  label,
  kind: 'command',
  ...COMMAND_HELP[label],
  description: nativeCommandReference[label]?.description ?? COMMAND_HELP[label]?.description ?? 'GeoGebra command',
  ...(nativeCommandReference[label] && {
    signatures: nativeCommandReference[label].signatures.map(({ text }) => text),
    referenceName: label,
  }),
})));

studioCompletionRegistry.registerCommands('geogebra-api', API_METHODS.map((label) => ({
  label,
  kind: 'api',
  description: 'GeoGebra JavaScript API',
})), 'api');

studioCompletionRegistry.register({ id: 'studio-advanced', provide: (context) => context.mode === 'api'
  ? advancedCommands.list().map(({ name, description, signatures }) => ({ label: name, kind: 'api' as const, description, signatures, referenceName: `!${name}`, priority: 10 })) : [] });

studioCompletionRegistry.registerCommands('studio-geometry', studioToolLibrary.tools.map((tool) => ({
  label: tool.name,
  kind: 'custom',
  referenceName: tool.canonicalName,
  description: tool.description,
  nativeDescription: tool.name === tool.canonicalName ? nativeCommandReference[tool.name]?.description : undefined,
  signatures: [...new Set([
    ...tool.overloads.map((overload) => toolSignature(tool, overload)),
    ...(tool.name === tool.canonicalName ? nativeCommandReference[tool.name]?.signatures.map(({ text }) => text) ?? [] : []),
  ])],
  priority: 10,
})));
