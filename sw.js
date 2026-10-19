// Bump CACHE for each release. An update activates after all old app tabs close.
const PREFIX='drum-log-shell-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+'v13';
const ASSETS=['./','./index.html','./style.css','./mobile.css','./schedule.css','./fonts/drum-console.woff','./app.js','./sound.js','./sounds/buttonpress.mp3','./sounds/hoversound.mp3','./sounds/switchingmenus.mp3','./sounds/Acceptsound.mp3','./sounds/invalidsound.mp3','./sounds/Warningsound.mp3','./core.js','./schedule.js','./db.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(error=>{if(event.request.mode==='navigate')return caches.match('./index.html');throw error;})));});
