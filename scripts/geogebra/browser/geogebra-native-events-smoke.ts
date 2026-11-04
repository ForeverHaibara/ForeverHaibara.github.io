import type { GeoGebraEngine } from '../../../src/features/geogebra/types';
import { PreferenceController } from '../../../src/features/geogebra/settings/PreferenceController';
import { DEFAULT_GGB_PREFERENCES } from '../../../src/features/geogebra/settings/defaults';

/** Exercise native evaluation, including the scratch point inside circle inversion.
 * Run with verification.html?page=smoke&suite=native-events. */
export async function verifyNativeEvents(engine: GeoGebraEngine, report: (message: string) => void): Promise<void> {
  const errors: string[] = [];
  const controller = new PreferenceController(engine, { ...DEFAULT_GGB_PREFERENCES }, (error) => errors.push(error));
  let events = 0;
  const unsubscribe = engine.subscribe(() => { events += 1; });
  const pause = () => new Promise<void>((resolve) => window.setTimeout(resolve, 500));
  const stable = async (label: string) => {
    await pause();
    const before = events;
    await pause();
    if (events !== before) throw new Error(`${label}: native events keep firing (${before} → ${events}).`);
    if (errors.length) throw new Error(errors.join('; '));
    report(`PASS ${label}: event stream settled (${events} events)`);
  };
  const command = async (source: string) => {
    if (await engine.callApi('evalCommand', [source]) !== true) throw new Error(`Native command failed: ${source}`);
  };
  try {
    await controller.loadDocument(async () => undefined);
    for (const source of ['O=(0,0)', 'S=(3,1)', 'P=(1,2)', 'c=Circle(O,2)', 'd=Circle(S,1)', 'l=Line(O,P)']) await command(source);
    await stable('initial construction');
    for (const source of ['Reflect(d,c)', 'Reflect(c,d)', 'Reflect(l,c)', 'Reflect(P,c)']) {
      await command(source);
      await stable(source);
    }
    if (await engine.callApi('isDefined', ["d'"]) !== true) throw new Error('Circle inverse is undefined.');
    await engine.callApi('setCoords', ['S', 1, 0]); // d now passes through inversion center: line limit.
    await stable('circle-to-line degeneration');
    await engine.callApi('setCoords', ['S', 3, 1]);
    await stable('circle restored after dragging');
    await controller.update({ ...DEFAULT_GGB_PREFERENCES, decimals: 7 });
    await stable('precision change with native inversions');
    await engine.callApi('setUndoPoint', []);
    await engine.callApi('deleteObject', ["d'"]);
    await engine.callApi('setUndoPoint', []);
    await stable('delete inverse');
    await engine.callApi('undo', []);
    await stable('native undo');
    if (await engine.callApi('exists', ["d'"]) !== true) throw new Error('Undo did not restore the inverse.');
    await engine.callApi('redo', []);
    await stable('native redo');
    if (await engine.callApi('exists', ["d'"]) !== false) throw new Error('Redo did not delete the inverse.');
  } finally {
    controller.dispose();
    unsubscribe();
  }
}
