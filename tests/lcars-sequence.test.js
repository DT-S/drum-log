import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('RC27 builds real LCARS content in five stages, not a subtle flash',()=>{
 const css=get('lcars-sequence.css'),app=get('app.js'),motion=get('lcars-motion.js');
 for(const name of ['dl-sequence-head','dl-sequence-frame','dl-sequence-element',
  'dl-sequence-steps','dl-sequence-bar','dl-sequence-lamp'])
  assert.match(css,new RegExp(name));
 for(const scope of ['#students.lcars-view-enter','#journal.lcars-view-enter',
  '#schedule.lcars-view-enter','#settings.lcars-view-enter'])
  assert.ok(css.includes(scope),scope);
 assert.match(css,/nth-child\(-n\+8\)/);
 assert.match(css,/#journal\.lcars-view-enter #notes\{animation:none!important/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(motion,/LCARS_VIEW_DURATION_MS=640/);
 assert.match(app,/lastRenderedView/);
 assert.match(app,/if\(entering\)viewMotion\.play\(view\)/);
 assert.doesNotMatch(css,/infinite|\.chart-lock-reticle/);
});
test('RC28 launcher hands off immediately to the long main-shell assembly',()=>{
 const css=get('lcars-assembly.css'),js=get('lcars-startup.js'),sw=get('sw.js'),app=get('app.js');
 for(const key of ['dl-assembly-elbow','dl-assembly-rail-x','dl-assembly-extend',
  'dl-assembly-unfold','lcars-view-boot','prefers-reduced-motion:reduce'])
  assert.ok(css.includes(key),key);
 assert.match(js,/dismiss\(\);\s*try\{onEnter\(\)/);
 assert.match(js,/startAudio\(\)/);
 assert.doesNotMatch(js,/minimumMs|Promise\.race/);
 assert.match(app,/viewMotion\.play\(view,\{boot:true\}\)/);
 assert.match(sw,/v31-makeup-filter/);
 assert.match(sw,/'\.\/lcars-assembly\.css'/);
 assert.match(get('index.html'),/href="lcars-assembly\.css"/);
 assert.match(get('index.html'),/DRUM LOG \/ 1\.11\.3/);
 assert.match(css,/footer span:last-child\{display:inline!important/);
});
