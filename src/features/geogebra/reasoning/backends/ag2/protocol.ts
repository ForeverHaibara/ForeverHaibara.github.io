import type { Ag2Export } from './exportProblem';

export interface Ag2RunResult {
  status: 'derived' | 'not-derived' | 'already-assumed';
  checks: boolean[];
  elapsedMs: number;
  points: number;
  assumptions: number;
  certificate: null;
}
export type Ag2WorkerResponse = { id: number; phase: 'loading' | 'solving' }
  | { id: number; result: Ag2RunResult } | { id: number; error: string };
export interface Ag2WorkerRequest { id: number; problem: Ag2Export; }
