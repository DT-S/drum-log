// Local Web Audio buffers avoid streaming/range-request dependencies while offline.
// Original 2026 LCARS samples. Drum Log already includes these recordings
// under sounds/soundsv2/. Keep semantic names separate from the asset filenames.
export const SOUND_FILES=Object.freeze({
 hover:'soundsv2/hovering.mp3',
 press:'soundsv2/keypress_standart.mp3',
 menu:'soundsv2/menu_or_window_change.mp3',
 mode:'soundsv2/modechange.mp3',
 toggle:'soundsv2/option_toggle_or_secondary_menu_pops_up.mp3',
 increase:'soundsv2/keypress_increase.mp3',
 decrease:'soundsv2/keypress_decrease.mp3',
 warning:'soundsv2/caution.mp3',
 consoleWarning:'soundsv2/consolewarning.mp3',
 denied:'soundsv2/denied.mp3',
 invalid:'soundsv2/invalid_input.mp3',
 erase:'soundsv2/erase_accepted.mp3',
 update:'soundsv2/update&restart.mp3',
 close:'soundsv2/windowcloses.mp3',
 launch:'soundsv2/launchsound_Staggered_Entrance_Animation.mp3',
 // No generic success in the newer pack; retain the original recording.
 accept:'Acceptsound.mp3'
});
// Buttons communicate their action with the same specific LCARS cues as the
// metronome rather than giving every action the identical generic keypress.
export function classifyDrumCue(el){
 if(!el||el.dataset?.view!==undefined)return null;
 if(el.hasAttribute?.('data-close'))return 'close';
 if(el.dataset?.mobilePane!==undefined)return 'mode';
 if(el.dataset?.up!==undefined||el.classList?.contains?.('lcars-plus')||
  el.classList?.contains?.('lcars-jump-up')||el.classList?.contains?.('plan-arrow-next'))return 'increase';
 if(el.dataset?.down!==undefined||el.classList?.contains?.('lcars-minus')||
  el.classList?.contains?.('lcars-jump-down')||el.classList?.contains?.('plan-arrow-prev'))return 'decrease';
 if(el.type==='checkbox'||el.tagName==='SUMMARY'||
  el.getAttribute?.('aria-expanded')!==null&&el.getAttribute?.('aria-expanded')!==undefined)return 'toggle';
 return 'press';
}
export function createSoundSystem({AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,fetchFile=globalThis.fetch?.bind(globalThis),clock=()=>performance.now()}={}){
 let context,master,enabled=true,volume=.35,active=null,lastHover=-Infinity,lastSignal=-Infinity,lastAlert=-Infinity,sequence=0,resuming=Promise.resolve(),audioError='';
 const layered=new Set();
 const bytes=new Map(),buffers=new Map();
 // Fetch only our bundled files. Audio failure must never affect journal storage.
 for(const [kind,file] of Object.entries(SOUND_FILES))bytes.set(kind,Promise.resolve().then(()=>fetchFile(new URL('./sounds/'+file,import.meta.url))).then(r=>{if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer();}).catch(()=>{audioError='Sound files could not be loaded. Reopen online and check the sounds folder.';return null;}));
 function stopLayered(){for(const source of layered){try{source.stop();}catch{}}layered.clear();}
 function stop(){sequence++;if(active){try{active.stop();}catch{}active=null;}stopLayered();}
 function configure(settings={}){enabled=settings.soundEnabled??true;volume=Number.isFinite(settings.soundVolume)?Math.max(0,Math.min(1,settings.soundVolume)):.35;if(master)master.gain.value=volume;if(!enabled||volume===0)stop();}
 function unlock(){
  if(!enabled||volume===0||!AudioContextClass)return resuming;
  try{
   // iOS can close a Web Audio context while the home-screen PWA is in the
   // background. A closed context cannot be resumed: rebuild its audio graph.
   if(!context||context.state==='closed'){
    context=new AudioContextClass();const target=context;
    master=target.createGain();master.gain.value=volume;master.connect(target.destination);
    buffers.clear();
    for(const kind of bytes.keys())buffers.set(kind,bytes.get(kind).then(data=>data?target.decodeAudioData(data.slice(0)):null).catch(()=>{audioError='A sound file could not be decoded.';return null;}));
    resuming=Promise.resolve();
   }
   // WebKit has a nonstandard "interrupted" state after app switching.
   // Resume on foreground AND retry inside the next trusted touch/click.
   if(context.state!=='running')
    resuming=Promise.resolve(context.resume()).catch(()=>{audioError='Audio blocked. Tap Test sound again.';});
  }catch{audioError='Audio could not be initialized.';}
  return resuming;
 }
 function play(kind){if(!enabled||volume===0||!context||!buffers.has(kind))return;const now=clock();if(kind==='hover'){if(now-lastHover<90||now-lastSignal<240)return;lastHover=now;}else{if(kind==='invalid'||kind==='warning'){if(now-lastAlert<160)return;lastAlert=now;}lastSignal=now;}
 const token=++sequence;void Promise.all([buffers.get(kind),resuming]).then(([buffer])=>{if(!buffer||token!==sequence||!enabled||volume===0||context.state!=='running')return;if(active){try{active.stop();}catch{}}stopLayered();const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=kind==='hover'?.45:1;source.connect(gain);gain.connect(master);source.onended=()=>{source.disconnect();gain.disconnect();if(active===source)active=null;};active=source;source.start();}).catch(()=>{});}
 // Navigation is a deliberate layered cue: short keypress immediately, then
 // the full window-build sample after 55ms. Unlike calling play() twice,
 // neither recording cuts off the other. New alerts can preempt both.
 function transition(){
  if(!enabled||volume===0||!context)return;
  lastSignal=clock();
  const token=++sequence;
  void Promise.all([buffers.get('press'),buffers.get('menu'),resuming]).then(([press,menu])=>{
   if(token!==sequence||!enabled||volume===0||context.state!=='running')return;
   if(active){try{active.stop();}catch{}active=null;}
   stopLayered();
   const at=Number.isFinite(context.currentTime)?context.currentTime:0;
   for(const [buffer,delay,level] of [[press,0,.75],[menu,.055,1]]){
    if(!buffer)continue;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffer;gain.gain.value=level;
    source.connect(gain);gain.connect(master);
    source.onended=()=>{layered.delete(source);source.disconnect();gain.disconnect();};
    layered.add(source);source.start(at+delay);
   }
  }).catch(()=>{});
 }
 // A cold start is allowed only in the trusted INITIALIZE DRUM LOG click.
 // Buffer decoding is time-bounded so broken audio cannot trap student data.
 async function startLaunch({timeoutMs=1800}={}){
  unlock(); // AudioContext.resume() occurs synchronously in the click call.
  if(!enabled||volume===0||!context||!buffers.has('launch'))return false;
  const token=++sequence;
  const timeout=Number.isFinite(timeoutMs)?Math.max(0,Math.min(3000,timeoutMs)):1800;
  let timer;
  try{
   const ready=await Promise.race([
    Promise.all([buffers.get('launch'),resuming]).then(([buffer])=>buffer),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeout);})
   ]);
   if(!ready||token!==sequence||!enabled||volume===0||context.state!=='running')return false;
   if(active){try{active.stop();}catch{}active=null;}
   stopLayered();
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=ready;gain.gain.value=1;source.connect(gain);gain.connect(master);
   source.onended=()=>{source.disconnect();gain.disconnect();if(active===source)active=null;};
   active=source;source.start();
   return true;
  }catch{return false;}finally{clearTimeout(timer);}
 }
 function bind(root=document){const target=e=>e.target?.closest?.('button, summary, select, input:not([type="hidden"]), textarea, a[href]');const usable=el=>el&&!el.disabled&&!el.closest('[hidden]');
 root.addEventListener('pointerdown',e=>{unlock();const el=target(e);if(usable(el)&&e.pointerType!=='mouse')play('hover');},true);
 root.addEventListener('touchend',()=>unlock(),{capture:true,passive:true});
 root.addEventListener('keydown',e=>{if(!e.repeat)unlock();},true);
 root.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=target(e);if(usable(el)&&!el.contains(e.relatedTarget))play('hover');});
 root.addEventListener('click',e=>{unlock();const el=target(e);if(!usable(el)||el.type==='file'||el.dataset.view||el.closest?.('#lcarsStartup'))return;
  unlock();
  const cue=classifyDrumCue(el);
  if(cue)play(cue);},true);
 root.addEventListener('invalid',()=>play('invalid'),true);
 // An installed iOS PWA may remain alive across several app switches.
 // Stop any half-played cue in the background, then re-arm the same context
 // on foreground. A denied automatic resume is retried on the next gesture.
 root.addEventListener('visibilitychange',()=>{if(root.hidden)stop();else unlock();});
 root.defaultView?.addEventListener('pageshow',()=>{if(!root.hidden)unlock();});
 root.defaultView?.addEventListener('focus',()=>{if(!root.hidden)unlock();});
 }
 function status(){if(!enabled)return 'Audio disabled in app settings.';if(volume===0)return 'App volume is zero.';if(audioError)return audioError;if(!context)return 'Tap Test sound to activate audio.';return context.state==='running'?'Audio active. If silent: turn off iPhone Silent Mode, raise media volume and check Bluetooth output.':'Audio '+context.state+'. Tap Test sound again.';}
 async function test(){unlock();play('accept');await Promise.all([buffers.get('accept'),resuming]);return status();}
 return {configure,unlock,play,transition,startLaunch,bind,stop,status,test};
}
