import { GEOGEBRA_DATABASE_NAME, GEOGEBRA_LATEST_PROJECT_ID, GEOGEBRA_PROJECT_STORE } from '../config';
import type { GeometryProjectRecord } from '../types';
import type { ProjectStore } from './projectStore';

export class IndexedDbProjectStore implements ProjectStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async getLatest(): Promise<GeometryProjectRecord | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(GEOGEBRA_PROJECT_STORE, 'readonly').objectStore(GEOGEBRA_PROJECT_STORE).get(GEOGEBRA_LATEST_PROJECT_ID);
      request.onsuccess = () => resolve((request.result as GeometryProjectRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read the local GeoGebra draft.'));
    });
  }

  async save(record: GeometryProjectRecord): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(GEOGEBRA_PROJECT_STORE, 'readwrite').objectStore(GEOGEBRA_PROJECT_STORE).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Unable to save the local GeoGebra draft.'));
    });
  }

  async clear(): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(GEOGEBRA_PROJECT_STORE, 'readwrite').objectStore(GEOGEBRA_PROJECT_STORE).delete(GEOGEBRA_LATEST_PROJECT_ID);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Unable to clear the local GeoGebra draft.'));
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(GEOGEBRA_DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(GEOGEBRA_PROJECT_STORE)) {
          request.result.createObjectStore(GEOGEBRA_PROJECT_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open local GeoGebra storage.'));
    });
    return this.databasePromise;
  }
}
