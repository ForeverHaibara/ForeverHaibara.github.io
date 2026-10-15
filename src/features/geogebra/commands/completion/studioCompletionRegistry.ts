import { API_METHODS } from '../../types';
import { CompletionRegistry } from './completionRegistry';
import { GEOGEBRA_COMMAND_NAMES } from './geogebraCommandNames';
import { COMMAND_HELP } from './commandHelp';
import { studioToolLibrary, toolSignature } from '../custom/toolLibrary';

/** Shared by all studio command bars. Extensions can also inject their own registry. */
export const studioCompletionRegistry = new CompletionRegistry();

studioCompletionRegistry.registerCommands('geogebra', GEOGEBRA_COMMAND_NAMES.map((label) => ({
  label,
  kind: 'command',
  description: 'GeoGebra command',
  ...COMMAND_HELP[label],
})));

studioCompletionRegistry.registerCommands('geogebra-api', API_METHODS.map((label) => ({
  label,
  kind: 'api',
  description: 'GeoGebra JavaScript API',
})), 'api');

studioCompletionRegistry.registerCommands('studio-geometry', studioToolLibrary.tools.map((tool) => ({
  label: tool.name,
  kind: 'custom',
  description: tool.description,
  signatures: [...tool.overloads.map((overload) => toolSignature(tool, overload)), ...(tool.name === 'Conic' ? ['Conic(a: number, b: number, c: number, d: number, e: number, f: number)', 'Conic(coefficients: list)'] : [])],
  priority: 10,
})));
