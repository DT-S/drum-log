import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup} from '../core.js';
import {createSoundSystem,SOUND_FILES} from '../sound.js';
import {createStartupConsole} from '../lcars-startup.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('M4 startup is opt-out, stays in schema 10 and roundtrips with all existing student data',()=>{
 const now=defaults();assert.equal(now.settings.launchScreen,true);
 now.settings.launchScreen=false;
 now.students.push({id:'student-test',name:'SYNTHETIC',day:2,time:'16:00',duration:45,
  archived:false,remarks:'Test-only',makeupBalance:0});
 const recovered=validateBackup(JSON.parse(JSON.stringify(now)));
 assert.equal(recovered.schemaVersion,10);
 assert.deepEqual(recovered,now);
 const legacy=JSON.parse(JSON.stringify(now));delete legacy.settings.launchScreen;
 assert.equal(validateBackup(legacy).settings.launchScreen,true);
 for(const invalid of ['no',null,0,1,[]]){
  const raw=JSON.parse(JSON.stringify(now));raw.settings.launchScreen=invalid;
  assert.throws(()=>validateBackup(raw),/LCARS start screen/);
 }
});
test('M4 local logo, classes and actual gesture boot require no CDN and are offline-cached',()=>{
 const html=read('index.html'),css=read('lcars-startup.css'),js=read('app.js'),sw=read('sw.js');
 assert.match(html,/id="lcarsStartup"/);
 assert.match(html,/id="lcarsInitialize"/);
 assert.match(html,/id="lcarsStartupHeading">DRUM/);
 assert.match(html,/src="\.\/icon\.svg"/);
 assert.match(html,/lcars-start-top/);
 assert.match(html,/href="lcars-startup\.css"/);
 assert.match(css,/\.lcars-subbrand-label/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(js,/id="launchScreen"/);
 assert.match(js,/startAudio:\(\)=>sounds\.startLaunch\(\)/);
 assert.match(sw,/'\.\/lcars-startup\.css'/);
 assert.match(sw,/'\.\/lcars-startup\.js'/);
 assert.match(sw,/v23-update-console/);
 assert.equal(SOUND_FILES.launch,'soundsv2/launchsound_Staggered_Entrance_Animation.mp3');
 assert.doesNotMatch(css,/@import|https?:\/\//);
});
test('M4 plays real launch sample, never triggers before user gesture',async()=>{
 const started=[];
 class Context{
  constructor(){this.state='running';this.destination={};}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  decodeAudioData(bytes){return Promise.resolve(bytes);}
  createBufferSource(){return {buffer:null,connect(){},disconnect(){},start(){started.push(new TextDecoder().decode(this.buffer));},stop(){}};}
  resume(){return Promise.resolve();}
 }
 const sounds=createSoundSystem({AudioContextClass:Context,
  fetchFile:async url=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer})});
 await flush();
 assert.equal(started.length,0);
 assert.equal(await sounds.startLaunch(),true);
 assert.equal(started.length,1);
 assert.ok(started[0].endsWith('launchsound_Staggered_Entrance_Animation.mp3'));
 sounds.configure({soundEnabled:false});
 assert.equal(await sounds.startLaunch(),false);
 assert.equal(started.length,1);
});
test('M4 launch is fail-open if MP3 unavailable or Web Audio blocked',async()=>{
 class Context{
  constructor(){this.state='suspended';this.destination={};}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  resume(){return Promise.reject(Error('blocked'));}
  decodeAudioData(){return Promise.reject(Error('broken file'));}
 }
 const system=createSoundSystem({AudioContextClass:Context,
  fetchFile:async()=>({ok:false})});
 assert.equal(await system.startLaunch({timeoutMs:10}),false);
});
test('M4 console starts audio only inside a direct click and opens journal if sound fails',async()=>{
 const elements=new Map();
 function el(key){
  const o={hidden:false,disabled:false,inert:false,dataset:{},textContent:'',
    style:{width:''},classList:{add(){},remove(){}},focus(){},setAttribute(){},
    addEventListener(name,fn){this['on'+name]=fn;}};
  elements.set(key,o);return o;
 }
 const overlay=el('#lcarsStartup'),button=el('#lcarsInitialize'),
 fill=el('#lcarsBootFill');el('#lcarsBootBar');el('#lcarsInitText');el('#lcarsInitCode');el('#lcarsStartupNote');
 overlay.querySelectorAll=()=>[];
 const header={tagName:'HEADER',inert:false},script={tagName:'SCRIPT',inert:false};
 const root={querySelector:key=>elements.get(key),body:{children:[overlay,header,script]}};
 const screen=createStartupConsole(root);
 let calls=0,entered=0;
 assert.equal(screen.show({startAudio:()=>{calls++;return Promise.resolve(false);},onEnter:()=>entered++}),true);
 assert.equal(header.inert,true);
 assert.equal(calls,0,'no autoplay before user action');
 button.onclick();
 assert.equal(calls,1);
 button.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(entered,1);
 assert.equal(header.inert,false);
 assert.equal(overlay.hidden,true);
 assert.equal(fill.style.width,'100%');
});
