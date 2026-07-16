import React, { useEffect, useRef } from 'react';
import type { GeoGebraEngine } from '../types';

interface GeoGebraCanvasProps {
  engine: GeoGebraEngine;
  onReady(): void;
  onError(error: Error): void;
}

const GeoGebraCanvas: React.FC<GeoGebraCanvasProps> = ({ engine, onReady, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let active = true;
    engine.initialize(container).then(() => {
      if (active) onReady();
    }).catch((error: unknown) => {
      if (active) onError(error instanceof Error ? error : new Error('GeoGebra failed to initialize.'));
    });

    return () => {
      active = false;
      engine.dispose();
    };
  }, [engine, onError, onReady]);

  return <div ref={containerRef} className="h-full min-h-[520px] w-full min-w-0 overflow-hidden bg-white" data-testid="geogebra-canvas" />;
};

export default GeoGebraCanvas;
