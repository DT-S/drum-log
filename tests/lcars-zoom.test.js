import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installZoomGuard} from '../lcars-zoom.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function target(){
 const handlers=new Map();
 const doc={
  addEventListener:(type,cb,opts)=>{handlers.set(type,{cb,opts});},
  removeEventListener:(type,cb)=>{if(handlers.get(type)?.cb===cb)handlers.delete(type);}
 };
 const fire=(type,touches=[])=>{
  let prevented=false;
  const e={cancelable:true,touches,preventDefault(){prevented=true;}};
  handlers.get(type)?.cb(e);
  return prevented;
 };
 return {doc,handlers,fire};
}
test('mobile zoom guard suppresses iOS pinch but retains one-finger scrolling and taps',()=>{
 const t=target();
 const stop=installZoomGuard(t.doc,{isTouch:()=>true});
 assert.equal(t.handlers.size,3);
 for(const evt of t.handlers.values())assert.equal(evt.opts.passive,false);
 assert.equal(t.fire('touchmove',[{}]),false,'single-finger journal scrolling should remain');
 assert.equal(t.fire('touchmove',[{},{}]),true,'two-finger browser pinch prevented');
 assert.equal(t.fire('gesturestart'),true);
 assert.equal(t.fire('gesturechange'),true);
 assert.equal(t.fire('click'),false,'tap/click handlers are not overridden');
 stop();
 assert.equal(t.handlers.size,0,'detach all listeners cleanly');
});
test('zoom guard never binds on desktop pointer devices',()=>{
 const t=target();
 installZoomGuard(t.doc,{isTouch:()=>false})();
 assert.equal(t.handlers.size,0);
});
test('coarse touch CSS blocks pinch but allows scrolling and 16px input text',()=>{
 const css=read('lcars-zoom.css'),html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 assert.match(css,/touch-action:\s*pan-x pan-y/);
 const declarations=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(declarations,/touch-action:\s*none|touch-action:\s*manipulation/);
 assert.match(css,/@media\s*\(any-pointer:\s*coarse\)/);
 assert.match(css,/font-size:\s*max\(16px,\s*1em\)/);
 assert.match(app,/installZoomGuard\(document\)/);
 assert.match(html,/href="lcars-zoom\.css"/);
 assert.match(sw,/'\.\/lcars-zoom\.css'/);
 assert.match(sw,/'\.\/lcars-zoom\.js'/);
 assert.match(sw,/v29-audio-sync/);
});
