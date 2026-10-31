/** Test-only comparison of equations after their nonzero global gauges match.
 * scale is the magnitude on independent off-curve reference probes, not 1.
 * Near roots use an absolute floor relative to that equation scale; away from
 * roots also allow relative error. This is not a geometric distance estimate.
 */
export const compareGibertResidual = (actual: number, expected: number, scale: number) => {
  const finite = [actual, expected, scale].every(Number.isFinite) && scale > 0;
  const difference = Math.abs(actual - expected);
  const denominator = Math.max(scale, Math.abs(expected));
  const tolerance = 1e-6 * scale + 1e-6 * Math.abs(expected);
  return {
    accepted: finite && difference <= tolerance,
    normalizedError: finite ? difference / denominator : Infinity,
    strictDiagnosticPassed: finite && difference <= 1e-8 * denominator,
  };
};
