const TYPE_LABELS: Record<string, string> = {
  point: 'Point', point3d: '3D point', line: 'Line', line3d: '3D line',
  segment: 'Segment', ray: 'Ray', vector: 'Vector', conic: 'Conic',
  conicpart: 'Conic arc', circle: 'Circle', ellipse: 'Ellipse',
  hyperbola: 'Hyperbola', parabola: 'Parabola', polygon: 'Polygon',
  polyline: 'Polyline', function: 'Function', functionnvar: 'Multivariable function',
  curvecartesian: 'Parametric curve', curvecartesian3d: '3D parametric curve',
  implicitpoly: 'Implicit curve', implicitcurve: 'Implicit curve',
  numeric: 'Number', boolean: 'Boolean', text: 'Text', list: 'List',
  angle: 'Angle', locus: 'Locus', plane: 'Plane', quadric: 'Quadric',
  surface: 'Surface', penstroke: 'Pen stroke', image: 'Image',
};

export const geometryTypeLabel = (type?: string | null): string => {
  if (!type) return 'Object';
  const key = type.replace(/^geo/i, '').toLowerCase();
  return TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
};
