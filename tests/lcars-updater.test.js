import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {awaitWorkerState,createUpdateManager} from '../lcars-updater.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup({openTabs=1,maySave=true,hasWaiting=true,online=true}={}){
 let state='installed',reloads=0,activations=0,checks=0;
 const handlers=new Map();
 const waiting={
  get state(){return state;},
  addEventListener(name,fn){handlers.set(name,fn);},
  removeEventListener(name){handlers.delete(name);},
  postMessage(msg){if(msg.type==='ACTIVATE_DRUM_LOG_UPDATE'){
   activations++;state='activated';queueMicrotask(()=>handlers.get('statechange')?.());
  }}
 };
 const active={
  postMessage(msg,ports){
   if(msg.type==='COUNT_DRUM_LOG_CLIENTS')ports?.[0]?.postMessage({count:openTabs});
  }
 };
 const registration={
  waiting:hasWaiting?waiting:null,installing:null,active,
  addEventListener(){},
  update:async()=>{checks++;}
 };
 const sw={controller:active,ready:Promise.resolve(registration),
  addEventListener(){},register:async()=>registration};
 const status={textContent:''},button={disabled:false,hidden:false,textContent:'',onclick:null};
 const manager=createUpdateManager({
  serviceWorker:sw,online:()=>online,canProceed:async()=>maySave,
  reload:()=>reloads++
 });
 manager.mount(button,status);
 return {manager,button,status,waiting,registration,
  get reloads(){return reloads;},get activations(){return activations;},
  get checks(){return checks;}}
}
test('M6 installs a waiting SW only on explicit click, reloads only on second click',async()=>{
 const x=setup();
 await x.manager.register();
 assert.match(x.button.textContent,/INSTALL UPDATE/);
 assert.equal(x.activations,0);
 await x.button.onclick();
 assert.equal(x.activations,1);
 assert.equal(x.reloads,0);
 assert.equal(x.manager.readyToReload,true);
 assert.match(x.button.textContent,/RELOAD UPDATED APP/);
 await x.button.onclick();
 assert.equal(x.reloads,1);
});
test('M6 blocks installation when an editor cannot safely save or another tab is open',async()=>{
 const busy=setup({maySave:false});
 await busy.manager.register();await busy.manager.check();
 assert.equal(busy.activations,0);assert.equal(busy.reloads,0);
 assert.match(busy.status.textContent,/Finish saving/);
 const other=setup({openTabs:2});
 await other.manager.register();await other.manager.check();
 assert.equal(other.activations,0);
 assert.match(other.status.textContent,/Close other/);
});
test('M6 offline update check is non-destructive and checks no network if disconnected',async()=>{
 const x=setup({hasWaiting:false,online:false});
 await x.manager.register();await x.manager.check();
 assert.equal(x.checks,0);
 assert.equal(x.reloads,0);
 assert.match(x.status.textContent,/Offline/);
});
test('M6 worker activation observer recognizes redundancy and completion',async()=>{
 const handlers=new Map(),worker={
  state:'installing',
  addEventListener(key,fn){handlers.set(key,fn);},
  removeEventListener(key){handlers.delete(key)}
 };
 const p=awaitWorkerState(worker,'activated',500);
 worker.state='activated';handlers.get('statechange')();
 assert.equal(await p,true);
 assert.equal(awaitWorkerState({state:'redundant'},'activated') instanceof Promise,true);
 assert.equal(await awaitWorkerState({state:'redundant'},'activated'),false);
});
test('M6 update files are offline-cached and journal save protection remains unchanged',()=>{
 const sw=read('sw.js'),app=read('app.js'),updater=read('lcars-updater.js');
 assert.match(sw,/v24-lcars-faders/);
 assert.match(sw,/'\.\/lcars-updater\.js'/);
 assert.match(sw,/ACTIVATE_DRUM_LOG_UPDATE/);
 assert.match(sw,/COUNT_DRUM_LOG_CLIENTS/);
 assert.match(app,/canProceed:async\(\)=>!\$\('#modal'\)\?\.open&&!pending&&!saveFailure&&await ready\(\)/);
 assert.match(app,/id="updateCheck"/);
 assert.match(app,/updater\.register\(\)/);
 assert.doesNotMatch(updater,/indexedDB|replaceState|mutate\(/);
});
