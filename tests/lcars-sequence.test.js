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
 assert.match(motion,/LCARS_VIEW_DURATION_MS=1480/);
 assert.match(app,/lastRenderedView/);
 assert.match(app,/if\(entering\)viewMotion\.play\(view\)/);
 assert.doesNotMatch(css,/infinite|\.chart-lock-reticle/);
});
test('RC27 1450ms startup includes a fail-open deadline and cached CSS',()=>{
 const css=get('lcars-startup.css'),js=get('lcars-startup.js'),sw=get('sw.js');
 assert.match(js,/minimumMs=reduced\?0:1450/);
 assert.match(js,/2350/);
 assert.match(js,/startAudio\(\)/);
 assert.match(js,/Promise\.race\(/);
 assert.match(css,/dl-init-progress/);
 assert.match(css,/lcars-initializing/);
 assert.match(sw,/v27-visible-sequences/);
 assert.match(sw,/'\.\/lcars-sequence\.css'/);
});
