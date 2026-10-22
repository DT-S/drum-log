import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundSystem} from '../sound.js';
import {readFileSync} from 'node:fs';

const flush=()=>new Promise(r=>setImmediate(r));
function harness(){
 const instances=[],starts=[],listeners=new Map();
 const doc={hidden:false,defaultView:{addEventListener(type,fn){listeners.set('window:'+type,fn);}},
  addEventListener(type,fn){listeners.set('document:'+type,fn);}};
 class Context{
  constructor(){this.state='running';this.destination={};this.resumeCalls=0;instances.push(this);}
  createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
  decodeAudioData(data){return Promise.resolve({owner:this,data});}
  createBufferSource(){const owner=this;return {
   buffer:null,connect(){},disconnect(){},stop(){},
   start(){starts.push({owner,buffer:this.buffer});}
  };}
  resume(){this.resumeCalls++;this.state='running';return Promise.resolve();}
 }
 const sys=createSoundSystem({
  AudioContextClass:Context,
  fetchFile:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})
 });
 sys.bind(doc);
 const send=(key,event)=>{const cb=listeners.get(key);assert.ok(cb,'missing '+key);cb(event);};
 return {sys,doc,send,instances,starts};
}
test('iOS foreground visibility resumes interrupted audio context without rebooting PWA',async()=>{
 const h=harness();h.sys.unlock();h.sys.play('press');await flush();
 assert.equal(h.starts.length,1);
 const old=h.instances[0];
 h.doc.hidden=true;h.send('document:visibilitychange');
 old.state='interrupted';
 h.doc.hidden=false;h.send('document:visibilitychange');await flush();
 assert.equal(old.resumeCalls,1);
 assert.equal(h.starts.length,1,'foreground itself must not emit a ghost sound');
 h.sys.play('press');await flush();
 assert.equal(h.starts.length,2,'next UI action has sound after returning from Calendar');
 assert.equal(h.starts[1].buffer.owner,old,'normal interruption reuses decoded buffer');
});
test('pageshow and focus recover audio even if visibilitychange was not emitted by WebKit',async()=>{
 const h=harness();h.sys.unlock();const old=h.instances[0];
 old.state='interrupted';h.send('window:pageshow');await flush();
 assert.equal(old.resumeCalls,1);
 old.state='interrupted';h.send('window:focus');await flush();
 assert.equal(old.resumeCalls,2);
 h.doc.hidden=true;old.state='interrupted';h.send('window:focus');
 assert.equal(old.resumeCalls,2,'background focus cannot force an audio resume');
});
test('closed background audio context is recreated on foreground with fresh decoded buffers',async()=>{
 const h=harness();h.sys.unlock();h.sys.play('press');await flush();
 const old=h.instances[0];old.state='closed';
 h.doc.hidden=false;h.send('document:visibilitychange');await flush();
 assert.equal(h.instances.length,2);
 const next=h.instances[1];
 h.sys.play('press');await flush();
 assert.equal(h.starts.length,2);
 assert.equal(h.starts[1].owner,next);
 assert.equal(h.starts[1].buffer.owner,next,'decoded buffer belongs to reopened context');
});
test('muted sound remains muted after returning to app, and retry remains attached to user gesture',async()=>{
 const h=harness();h.sys.configure({soundEnabled:false});
 h.send('window:pageshow');h.send('window:focus');
 assert.equal(h.instances.length,0,'do not reopen a muted audio context');
 h.sys.configure({soundEnabled:true,soundVolume:.35});h.sys.unlock();
 h.instances[0].state='interrupted';
 // A user gesture re-attempts WebKit audio resumption even if lifecycle
 // callbacks did not fire or an earlier automatic attempt was denied.
 h.send('document:pointerdown',{
  pointerType:'mouse',
  target:{closest:()=>({disabled:false,closest:()=>null})}
 });
 await flush();
 assert.equal(h.instances[0].resumeCalls,1);
 assert.match(readFileSync(new URL('../sound.js',import.meta.url),'utf8'),
  /root\.addEventListener\('pointerdown',e=>\{unlock\(\)/);
});
