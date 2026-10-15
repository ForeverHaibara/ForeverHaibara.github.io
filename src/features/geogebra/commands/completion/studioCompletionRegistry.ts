import { API_METHODS } from '../../types';
import { CompletionRegistry } from './completionRegistry';
import { GEOGEBRA_COMMAND_NAMES } from './geogebraCommandNames';
import { COMMAND_HELP } from './commandHelp';

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
