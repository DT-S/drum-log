import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createShellMotion} from '../lcars-motion.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(reduced=false){
 const classes=new Set(),timers=new Map();let id=0;
 const body={classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
 const controller=createShellMotion({body},{
  reduced:()=>reduced,
  schedule:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},
  clear:key=>timers.delete(key)
 });
 return {controller,timers,classes};
}
test('M8 chassis runs once, then removes its class without any layout change',()=>{
 const t=setup();
 assert.equal(t.controller.play(),true);
 assert.ok(t.classes.has('lcars-chassis-assembling'));
 assert.equal([...t.timers.values()][0].ms,1150);
 t.controller.stop();
 assert.equal(t.classes.size,0);
 assert.equal(t.timers.size,0);
});
test('M8 short circuits when reduced-motion is enabled',()=>{
 const t=setup(true);
 assert.equal(t.controller.play(),false);
 assert.equal(t.timers.size,0);
 assert.equal(t.classes.size,0);
});
test('M8 modal/light bar animations are finite, offline cached and do not move input targets',()=>{
 const css=read('lcars-effects.css'),app=read('app.js'),sw=read('sw.js');
 assert.match(app,/shellMotion\.play\(\)/);
 assert.match(css,/body\.lcars-chassis-assembling nav button/);
 assert.match(css,/dialog\[open\]/);
 assert.match(css,/#notice:not\(\[hidden\]\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/infinite|translate\(|scale\(|pointer-events:\s*none/);
 assert.match(sw,/'\.\/lcars-effects\.css'/);
 assert.match(sw,/v27-visible-sequences/);
});
