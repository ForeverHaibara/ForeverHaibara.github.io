import { GEOGEBRA_DEPLOY_SCRIPT } from '../config';

let scriptPromise: Promise<void> | null = null;

const waitForAppletConstructor = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      if (window.GGBApplet) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > 30000) {
        reject(new Error('GeoGebra embedding API did not become available.'));
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  });

export const loadGeoGebraScript = (): Promise<void> => {
  if (window.GGBApplet) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GEOGEBRA_DEPLOY_SCRIPT}"]`);
    if (existingScript) {
      if (existingScript.dataset.geogebraLoadFailed === 'true') {
        reject(new Error('GeoGebra script failed to load.'));
        return;
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => {
        existingScript.dataset.geogebraLoadFailed = 'true';
        reject(new Error('GeoGebra script failed to load.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GEOGEBRA_DEPLOY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.dataset.geogebraLoadFailed = 'true';
      reject(new Error('GeoGebra script failed to load. Check your network connection.'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise.then(waitForAppletConstructor);
};
