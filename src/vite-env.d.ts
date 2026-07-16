/// <reference types="vite/client" />

import type { GeoGebraDebugApi } from './features/geogebra/types';

declare global {
  interface Window {
    GGBApplet?: new (parameters: Record<string, unknown>, useBrowserForJS?: boolean) => {
      inject(container: HTMLElement): void;
    };
    __GGB_DEBUG__?: GeoGebraDebugApi;
  }
}

export {};
