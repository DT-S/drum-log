// Bump CACHE for each release. An update activates after all old app tabs close.
const PREFIX='drum-log-shell-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+'v23-update-console';
const ASSETS=['./','./index.html','./style.css','./mobile.css','./schedule.css','./lcars-refresh.css','./lcars-components.css','./lcars-navigation-motion.css','./lcars-startup.css','./lcars-startup.js','./lcars-zoom.css','./lcars-zoom.js','./lcars-updater.js','./lcars-motion.js','./fonts/drum-console.woff','./app.js','./sound.js','./sounds/buttonpress.mp3','./sounds/hoversound.mp3','./sounds/switchingmenus.mp3','./sounds/Acceptsound.mp3','./sounds/invalidsound.mp3','./sounds/Warningsound.mp3','./sounds/soundsv2/caution.mp3','./sounds/soundsv2/consolewarning.mp3','./sounds/soundsv2/denied.mp3','./sounds/soundsv2/erase_accepted.mp3','./sounds/soundsv2/hovering.mp3','./sounds/soundsv2/invalid_input.mp3','./sounds/soundsv2/keypress_decrease.mp3','./sounds/soundsv2/keypress_increase.mp3','./sounds/soundsv2/keypress_standart.mp3','./sounds/soundsv2/launchsound_Staggered_Entrance_Animation.mp3','./sounds/soundsv2/menu_or_window_change.mp3','./sounds/soundsv2/modechange.mp3','./sounds/soundsv2/option_toggle_or_secondary_menu_pops_up.mp3','./sounds/soundsv2/update&restart.mp3','./sounds/soundsv2/windowcloses.mp3','./core.js','./schedule.js','./db.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Explicit activation only. Before updating, the UI waits for any notes to be
// saved and checks that other controlled Drum Log tabs are closed.
self.addEventListener('message',event=>{
 if(event.data?.type==='COUNT_DRUM_LOG_CLIENTS'){
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true})
   .then(clients=>event.ports[0]?.postMessage({count:clients.length})));
 }
 if(event.data?.type==='ACTIVATE_DRUM_LOG_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(error=>{if(event.request.mode==='navigate')return caches.match('./index.html');throw error;})));});
