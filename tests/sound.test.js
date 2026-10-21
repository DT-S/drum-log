import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSoundSystem,SOUND_FILES} from '../sound.js';
import {defaults,validateBackup} from '../core.js';
import {existsSync} from 'node:fs';
const flush=()=>new Promise(r=>setImmediate(r));
function harness(fail=false){let now=1000,starts=[],stops=0,contexts=0;class Context{constructor(){contexts++;this.state='running';this.destination={};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}decodeAudioData(data){return Promise.resolve(data);}createBufferSource(){return {connect(){},disconnect(){},start(){starts.push(this.buffer)},stop(){stops++}};}resume(){this.state='running';return Promise.resolve();}}
 const system=createSoundSystem({AudioContextClass:Context,clock:()=>now,fetchFile:async url=>{if(fail)throw Error('Offline / asset missing');return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer};}});
 return {system,starts,get stops(){return stops;},get contexts(){return contexts;},advance:n=>now+=n};}
test('audio stays silent before unlock; uses the bundled hover recording',async()=>{const h=harness();h.system.play('hover');await flush();assert.equal(h.contexts,0);h.system.unlock();h.system.play('hover');await flush();assert.equal(h.starts.length,1);assert.ok(new TextDecoder().decode(h.starts[0]).endsWith(SOUND_FILES.hover));});
test('warning replaces button click without being suppressed by click debounce',async()=>{const h=harness();h.system.unlock();h.system.play('press');await flush();h.system.play('warning');await flush();assert.equal(h.starts.length,2);assert.equal(h.stops,1);assert.ok(new TextDecoder().decode(h.starts[1]).endsWith(SOUND_FILES.warning));});
test('rapid hover is throttled and pending stale sounds are dropped',async()=>{const h=harness();h.system.unlock();h.system.play('hover');h.system.play('hover');await flush();assert.equal(h.starts.length,1);h.advance(300);h.system.play('hover');h.system.play('menu');await flush();assert.equal(h.starts.length,2);assert.ok(new TextDecoder().decode(h.starts[1]).endsWith(SOUND_FILES.menu));});
test('muting stops current playback and prevents new sounds',async()=>{const h=harness();h.system.unlock();h.system.play('accept');await flush();h.system.configure({soundEnabled:false});h.system.play('press');await flush();assert.equal(h.starts.length,1);assert.equal(h.stops,1);h.system.configure({soundEnabled:true,soundVolume:0});h.system.play('accept');await flush();assert.equal(h.starts.length,1);});
test('missing audio files fail silently',async()=>{const h=harness(true);h.system.unlock();h.system.play('press');await flush();assert.equal(h.starts.length,0);});
test('old backups receive audio defaults; new settings round trip; malformed audio rejected',()=>{const old=defaults();delete old.settings.soundEnabled;delete old.settings.soundVolume;const imported=validateBackup(old);assert.equal(imported.settings.soundEnabled,true);assert.equal(imported.settings.soundVolume,.35);imported.settings.soundEnabled=false;imported.settings.soundVolume=.2;assert.deepEqual(validateBackup(imported),imported);for(const value of [-1,2,'loud',null])assert.throws(()=>validateBackup({...imported,settings:{...imported.settings,soundVolume:value}}));});
test('playback waits for asynchronous audio activation, including interrupted contexts',async()=>{let instance,finish,played=0;class Context{constructor(){instance=this;this.state='interrupted';this.destination={};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}decodeAudioData(b){return Promise.resolve(b);}resume(){return new Promise(r=>{finish=()=>{this.state='running';r();};});}createBufferSource(){return {connect(){},disconnect(){},start(){played++;},stop(){}};}}
 const system=createSoundSystem({AudioContextClass:Context,fetchFile:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)})});system.unlock();system.play('accept');await flush();assert.equal(played,0);finish();await flush();assert.equal(played,1);assert.match(system.status(),/Audio active/);
});

test('Voyager soundbank uses original bundled samples without external requests',()=>{
 const names=['hovering.mp3','keypress_standart.mp3','menu_or_window_change.mp3',
 'modechange.mp3','option_toggle_or_secondary_menu_pops_up.mp3',
 'keypress_increase.mp3','keypress_decrease.mp3','caution.mp3',
 'consolewarning.mp3','denied.mp3','invalid_input.mp3',
 'erase_accepted.mp3','update&restart.mp3','windowcloses.mp3',
 'launchsound_Staggered_Entrance_Animation.mp3'];
 const fs=requireFilesystem();
 for(const name of names){
  assert.ok(Object.values(SOUND_FILES).includes('soundsv2/'+name),'missing semantic cue '+name);
  assert.ok(fs.existsSync(new URL('../sounds/soundsv2/'+name,import.meta.url)),
   'original MP3 must be in the repo: '+name);
 }
 assert.equal(SOUND_FILES.accept,'Acceptsound.mp3','generic success keeps older positive cue');
});
test('navigation overlays keypress and window-build at 55ms, with mute stopping both',async()=>{
 let starts=[],stops=0;
 class Context{
  constructor(){this.currentTime=2;this.state='running';this.destination={};}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  decodeAudioData(bytes){return Promise.resolve(bytes);}
  createBufferSource(){return {
   buffer:null,connect(){},disconnect(){},onended:null,
   start(at){starts.push({file:new TextDecoder().decode(this.buffer),at});},
   stop(){stops++;}
  };}
  resume(){return Promise.resolve();}
 }
 const system=createSoundSystem({AudioContextClass:Context,
  fetchFile:async url=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer})});
 system.unlock();
 system.transition();
 await flush();
 assert.equal(starts.length,2);
 assert.ok(starts[0].file.endsWith('/soundsv2/keypress_standart.mp3'));
 assert.ok(starts[1].file.endsWith('/soundsv2/menu_or_window_change.mp3'));
 assert.ok(Math.abs(starts[1].at-starts[0].at-.055)<1e-8);
 assert.equal(stops,0,'a second navigation sound must not cut off the first');
 system.configure({soundEnabled:false});
 assert.equal(stops,2,'mute must immediately stop all layered navigation sounds');
 system.transition();await flush();
 assert.equal(starts.length,2);
});
test('a warning preempts both navigation cues',async()=>{
 let starts=0,stops=0;
 class Context{
  constructor(){this.state='running';this.currentTime=10;this.destination={};}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  decodeAudioData(bytes){return Promise.resolve(bytes);}
  createBufferSource(){return {connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}
  resume(){return Promise.resolve();}
 }
 const sys=createSoundSystem({AudioContextClass:Context,
  fetchFile:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
 sys.unlock();sys.transition();await flush();
 assert.equal(starts,2);
 sys.play('warning');await flush();
 assert.equal(starts,3);
 assert.equal(stops,2);
});
// Small ESM-safe adapter used to avoid depending on browser APIs in the test.
function requireFilesystem(){return {existsSync:existsSync};}
