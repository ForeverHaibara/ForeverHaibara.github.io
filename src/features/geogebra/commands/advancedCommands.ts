import type { GeoGebraEngine } from '../types';
import { nearestTriangleCenter } from './advanced/nearestTriangleCenter';
import { parseApiCall } from './apiConsoleParser';
import { validateReferenceMetadata } from './reference/referenceMetadata';
import type { ReferenceMetadata } from './reference/referenceMetadata';
export interface AdvancedCommand {
  name: string;
  description: string;
  signatures: string[];
  reference?: ReferenceMetadata;
  execute(engine: GeoGebraEngine, args: unknown[]): Promise<unknown>;
}
/** Commands in this registry return immediate values; unknown names remain API calls. */
export class AdvancedCommandRegistry {
  private readonly commands = new Map<string, AdvancedCommand>();
  register(command: AdvancedCommand): void {
    validateReferenceMetadata(command.reference, `!${command.name}`);
    const key = command.name.toLowerCase();
    if (this.commands.has(key))
      throw new Error(`Advanced command already registered: ${command.name}`);
    this.commands.set(key, command);
  }
  list(): AdvancedCommand[] { return [...this.commands.values()]; }
  async execute(engine: GeoGebraEngine, input: string): Promise<unknown> {
    const call = parseApiCall(input);
    const command = this.commands.get(call.method.toLowerCase());
    return command ? command.execute(engine, call.args) : engine.callApi(call.method, call.args);
  }
}
export const advancedCommands = new AdvancedCommandRegistry();
advancedCommands.register(nearestTriangleCenter);
