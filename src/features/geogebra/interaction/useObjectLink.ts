import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { GeoGebraEngine } from '../types';
import { ObjectLinkController } from './ObjectLinkController';

export function useObjectLink(engine: GeoGebraEngine, ready: boolean) {
  const controller = useMemo(() => new ObjectLinkController(engine), [engine]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => ready ? controller.connect() : undefined, [controller, ready]);
  return { ...state, select: controller.select, hover: controller.hover, focus: controller.focus };
}

export type ObjectLink = ReturnType<typeof useObjectLink>;
