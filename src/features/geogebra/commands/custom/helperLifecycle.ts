import type { GeoGebraEngine, GeometryEvent } from '../../types';
import { isActiveHelperGroup, isInternalHelperName } from './internalHelpers';

const GROUP = /^ggbaux([0-9a-f]{16})nv\d+$/u;
const WORD = (name: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${name}(?![\\p{L}\\p{N}_])`, 'u');

/** Parses native metadata so similarly named user objects are never collected. */
export const verifiedHelpers = (xml: string, names: readonly string[]): string[] => {
  const elements = new Map([...xml.matchAll(/<element\b[^>]*\blabel="([^"]+)"[^>]*>[\s\S]*?<\/element>/gu)]
    .map((match) => [match[1], match[0]]));
  return names.filter((name) => {
    if (!isInternalHelperName(name)) return false;
    const element = elements.get(name);
    return Boolean(element && /<auxiliary\s+val="true"\s*\/>/u.test(element)
      && /<element\b[^>]*\btype="(?:numeric|list|function|functionNVar|point|vector|line|circle|conic|implicitPoly|implicitCurve)"/iu.test(element));
  });
};

/** Removes only unreferenced helper groups after a user deletes or rewrites an output. */
export class InternalHelperLifecycle {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private disposed = false;
  private unsubscribe: () => void;

  constructor(private readonly engine: GeoGebraEngine) {
    this.unsubscribe = engine.subscribe((event: GeometryEvent) => {
      if (this.disposed || this.running || event.objectName && isInternalHelperName(event.objectName)) return;
      if (['remove', 'rename', 'undo', 'redo'].includes(event.type)) this.schedule();
    });
  }

  private schedule() {
    clearTimeout(this.timer);
    // Native reconstruction can emit remove/add bursts before outputs return.
    this.timer = setTimeout(() => { this.timer = undefined; void this.reconcile(); }, 750);
  }

  async reconcile(): Promise<void> {
    if (this.disposed || this.running) return;
    this.running = true;
    try {
      const names = await this.engine.callApi('getAllObjectNames', []) as string[];
      if (!names.some(isInternalHelperName)) return;
      const xml = String(await this.engine.callApi('getXML', []));
      const helpers = verifiedHelpers(xml, names);
      const groups = new Map<string, string[]>();
      for (const name of helpers) {
        const group = GROUP.exec(name)![1];
        groups.set(group, [...groups.get(group) ?? [], name]);
      }
      for (const members of groups.values()) {
        if (isActiveHelperGroup(GROUP.exec(members[0])![1])) continue;
        const ownNames = new Set(members);
        const outsiders = names.filter((name) => !ownNames.has(name));
        let referenced = false;
        for (const name of outsiders) {
          // Both APIs are needed: commands and algebraic definitions differ by type.
          const [definition, command] = await Promise.all([
            this.engine.callApi('getDefinitionString', [name]),
            this.engine.callApi('getCommandString', [name]),
          ]);
          if (members.some((member) => WORD(member).test(`${definition ?? ''}\n${command ?? ''}`))) {
            referenced = true;
            break;
          }
        }
        if (referenced) continue;
        // Delete dependents before their inputs. A fresh native undo point keeps
        // the final construction coherent if the user undoes the deletion.
        for (const name of [...members].reverse()) {
          if (await this.engine.callApi('exists', [name])) await this.engine.callApi('deleteObject', [name]);
        }
      }
    } catch {
      // Unreadable metadata or dependencies must never trigger speculative deletion.
    } finally { this.running = false; }
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.unsubscribe();
  }
}
