const registration = await navigator.serviceWorker.register('/service-worker.mjs');
await navigator.serviceWorker.ready;
if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
globalThis.proofWorkerReady = Boolean(registration.active);
