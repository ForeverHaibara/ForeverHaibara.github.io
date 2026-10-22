/** Full JavaScript / GeoGebra double coordinates, never display-rounded values.
 * Residuals use a translated, uniformly scaled scene. Allow a small amount of
 * accumulated arithmetic error; visual closeness at 1e-7 is not equality.
 * Denominator/conditioning guards and finite-difference steps are separate.
 */
export const GEOMETRY_EPSILON = 1e-11;
export const SCALAR_EPSILON = 4 * GEOMETRY_EPSILON;
export const TRIANGLE_EPSILON = 8 * GEOMETRY_EPSILON;
export const SAMPLE_EPSILON = 16 * GEOMETRY_EPSILON;
// Conditioning, not an equality tolerance: do not fit huge circumcircles or
// triangle shapes to almost-flat inputs and lose the significant digits again.
export const MIN_STABLE_AREA = 2e-7;
