export const AG2_COMMIT = '251e7e16f0bba8ac7c83cdea789fccc195d0c0c7';
export const PYODIDE_VERSION = '314.0.7';
export const AG2_LIMITS = { points: 40, predicates: 250, coefficient: 32, constant: 1000000 };

/** Upstream names are not promises of site-level semantic lowering. */
export const AG2_CAPABILITIES = [
  { name: 'coll', exported: true, assumption: true, goal: true },
  { name: 'para', exported: true, assumption: true, goal: true },
  { name: 'perp', exported: true, assumption: true, goal: true },
  { name: 'cong', exported: true, assumption: true, goal: true },
  { name: 'eqangle', exported: false, assumption: true, goal: true },
  { name: 's_angle', exported: false, assumption: true, goal: true },
  { name: 'aconst', exported: false, assumption: true, goal: true },
  { name: 'angeq', exported: true, assumption: true, goal: true },
  { name: 'eqratio', exported: false, assumption: true, goal: true },
  { name: 'rconst', exported: false, assumption: true, goal: true },
  { name: 'distmeq', exported: true, assumption: true, goal: true },
  { name: 'distseq', exported: true, assumption: true, goal: true },
  { name: 'cyclic', exported: true, assumption: true, goal: true },
  { name: 'cyclic_with_centers', exported: false, assumption: true, goal: true },
  { name: 'overlap', exported: true, assumption: true, goal: true },
  { name: 'acompute', exported: false, assumption: false, goal: true },
] as const;
