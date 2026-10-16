// Local Web Audio buffers avoid streaming/range-request dependencies while offline.
export const SOUND_FILES={hover:'hoversound.mp3',press:'buttonpress.mp3',menu:'switchingmenus.mp3',accept:'Acceptsound.mp3',invalid:'invalidsound.mp3',warning:'Warningsound.mp3'};
export function createSoundSystem({AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,fetchFile=globalThis.fetch?.bind(globalThis),clock=()=>performance.now()}={}){
 let context,master,enabled=true,volume=.35,active=null,lastHover=-Infinity,lastSignal=-Infinity,lastAlert=-Infinity,sequence=0;
 const bytes=new Map(),buffers=new Map();
 // Fetch only our bundled files. Audio failure must never affect journal storage.
 for(const [kind,file] of Object.entries(SOUND_FILES))bytes.set(kind,Promise.resolve().then(()=>fetchFile(new URL('./sounds/'+file,import.meta.url))).then(r=>{if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer();}).catch(()=>null));
 function stop(){sequence++;if(active){try{active.stop();}catch{}active=null;}}
 function configure(settings={}){enabled=settings.soundEnabled??true;volume=Number.isFinite(settings.soundVolume)?Math.max(0,Math.min(1,settings.soundVolume)):.35;if(master)master.gain.value=volume;if(!enabled||volume===0)stop();}
 function unlock(){if(!enabled||volume===0||!AudioContextClass)return;try{if(!context){context=new AudioContextClass();master=context.createGain();master.gain.value=volume;master.connect(context.destination);for(const kind of bytes.keys())buffers.set(kind,bytes.get(kind).then(data=>data?context.decodeAudioData(data.slice(0)):null).catch(()=>null));}if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
 function play(kind){if(!enabled||volume===0||!context||!buffers.has(kind))return;const now=clock();if(kind==='hover'){if(now-lastHover<90||now-lastSignal<240)return;lastHover=now;}else{if(kind==='invalid'||kind==='warning'){if(now-lastAlert<160)return;lastAlert=now;}lastSignal=now;}
 const token=++sequence;void buffers.get(kind).then(buffer=>{if(!buffer||token!==sequence||!enabled||volume===0||context.state!=='running')return;if(active){try{active.stop();}catch{}}const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=kind==='hover'?.45:1;source.connect(gain);gain.connect(master);source.onended=()=>{source.disconnect();gain.disconnect();if(active===source)active=null;};active=source;source.start();}).catch(()=>{});}
 function bind(root=document){const target=e=>e.target?.closest?.('button, select, input:not([type="hidden"]), textarea, a[href]');const usable=el=>el&&!el.disabled&&!el.closest('[hidden]');
 root.addEventListener('pointerdown',e=>{unlock();const el=target(e);if(usable(el)&&e.pointerType!=='mouse')play('hover');},true);
 root.addEventListener('keydown',e=>{if(!e.repeat)unlock();},true);
 root.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const el=target(e);if(usable(el)&&!el.contains(e.relatedTarget))play('hover');});
 root.addEventListener('click',e=>{const el=target(e);if(!usable(el)||el.type==='file'||el.dataset.view)return;unlock();play('press');},true);
 root.addEventListener('invalid',()=>play('invalid'),true);
 root.addEventListener('visibilitychange',()=>{if(root.hidden)stop();});
 }
 return {configure,unlock,play,bind,stop};
}
