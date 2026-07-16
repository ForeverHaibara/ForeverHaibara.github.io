import type { GeometryProjectRecord } from '../types';

export interface ProjectStore {
  getLatest(): Promise<GeometryProjectRecord | null>;
  save(record: GeometryProjectRecord): Promise<void>;
  clear(): Promise<void>;
}
