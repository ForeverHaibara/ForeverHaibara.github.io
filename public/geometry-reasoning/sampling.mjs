// Independent realm and API handle: never access the parent construction.
const channel = 'geometry-sampling-v1';
let started = false;
window.addEventListener('message', async (event) => {
  if (started || event.source !== parent || event.origin !== location.origin || event.data?.channel !== channel) return;
  started = true;
  const { token, base64, points, plan } = event.data;
  const send = (data) => parent.postMessage({ channel, token, ...data }, location.origin);
  let api;
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://www.geogebra.org/apps/deployggb.js';
      script.onload = resolve; script.onerror = () => reject(new Error('Replica GeoGebra could not load.')); document.head.append(script);
    });
    await new Promise((resolve) => new window.GGBApplet({ id: 'geometrySamplingReplica', appName: 'classic', width: 640, height: 480,
      ggbBase64: base64, useBrowserForJS: true, disableJavaScript: true, randomize: false, preventFocus: true,
      showToolBar: false, showMenuBar: false, showAlgebraInput: false, errorDialogsActive: false,
      appletOnLoad: (loaded) => { api = loaded; resolve(); },
    }, true).inject(document.getElementById('replica')));
    api.stopAnimation();
    const read = () => Object.fromEntries(points.map(({ id, name }) => {
      const x = api.getXcoord(name); const y = api.getYcoord(name);
      return [id, api.exists(name) && api.isDefined(name) && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null];
    }));
    send({ baseline: read() });
    const samples = [];
    for (const step of plan) {
      api.setRepaintingActive(false);
      try { for (const point of step.points) api.setCoords(point.name, point.x, point.y); }
      finally { api.setRepaintingActive(true); }
      await new Promise((resolve) => setTimeout(resolve, 0));
      samples.push({ index: step.index, phase: step.phase, coordinates: read() });
      send({ progress: samples.length });
    }
    send({ samples });
  } catch (error) { send({ error: error instanceof Error ? error.message : 'Replica sampling failed.' }); }
  finally { api?.remove(); }
});
parent.postMessage({ channel, ready: true }, location.origin);
