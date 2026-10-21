import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Schedule date/week rerender animates only the current plot, no student logic edits',()=>{
 const app=read('app.js'),css=read('lcars-sequence.css');
 assert.match(app,/const rebuildPlanner=\(\)=>\{renderSchedule\(\);viewMotion\.play\('schedule'\);\}/);
 for(const cmd of ['planPrev','planNext','planToday','planDay','planWeek','plannerDate'])
  assert.ok(app.includes(cmd),cmd);
 assert.match(css,/dl-pane-ack/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(app,/button\.classList\.add\('lcars-pane-ack'\)/);
});
