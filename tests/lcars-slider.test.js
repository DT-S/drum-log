import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lcarsFraction,lcarsSnap,lcarsLedCount,LCARS_LED_COUNT,LCARS_TICK_COUNT} from '../lcars-slider.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('M7 native percentage and mobile size presets preserve original value bounds',()=>{
 assert.equal(lcarsFraction(65,65,100),0);
 assert.equal(lcarsFraction(100,65,100),1);
 assert.equal(lcarsLedCount(65,65,100),0);
 assert.equal(lcarsLedCount(100,65,100),LCARS_LED_COUNT);
 assert.equal(lcarsSnap(71,65,100,5),70);
 assert.equal(lcarsSnap(67,65,100,5),65);
 assert.equal(lcarsSnap(101,0,100,1),100);
 assert.equal(lcarsSnap(-2,0,100,1),0);
 assert.equal(LCARS_LED_COUNT,24);
 assert.equal(LCARS_TICK_COUNT,41);
});
test('M7 ports exactly the recognizable metronome fader elements',()=>{
 const js=read('lcars-slider.js'),css=read('lcars-slider.css'),app=read('app.js'),html=read('index.html'),sw=read('sw.js');
 for(const kind of ['lcars-slide-strip','lcars-pill-housing','lcars-bracket','lcars-tick',
   'lcars-slide-cap','lcars-cap-readout','lcars-range-native','lcars-calibration'])
  assert.ok(js.includes(kind),kind);
 assert.match(css,/\.lcars-bracket-box/);
 assert.match(css,/\.lcars-pill\.lit/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(js,/input\.dispatchEvent\(new Event\('change'/);
 assert.match(app,/id:'soundVolume',title:'SOUND \/ VOLUME',kind:'percent'/);
 assert.match(app,/id:'mobileScale',title:'MOBILE \/ SIZE',kind:'scale'/);
 assert.match(html,/href="lcars-slider\.css"/);
 assert.match(sw,/'\.\/lcars-slider\.js'/);
 assert.match(sw,/'\.\/lcars-slider\.css'/);
 assert.match(sw,/v31-makeup-filter/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
});
