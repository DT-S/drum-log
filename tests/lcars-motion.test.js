import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LCARS_VIEW_DURATION_MS,LCARS_BOOT_DURATION_MS,createViewMotion} from '../lcars-motion.js';

function page(){const classes=new Set();return {
 hidden:false,classList:{
  add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)
 }}}
test('M3 builds only destination on real navigation and stops previous animation',()=>{
 const journal=page(),schedule=page(),pages={journal,schedule};
 let counter=0;const pending=new Map();
 const motion=createViewMotion({getElementById:id=>pages[id]},{
  schedule:(fn,ms)=>{const id=++counter;pending.set(id,{fn,ms});return id;},
  clear:id=>pending.delete(id),reduced:()=>false
 });
 assert.equal(motion.play('journal'),true);
 assert.equal(journal.classList.contains('lcars-view-enter'),true);
 assert.equal([...pending.values()][0].ms,LCARS_VIEW_DURATION_MS);
 assert.equal(motion.play('schedule'),true);
 assert.equal(journal.classList.contains('lcars-view-enter'),false);
 assert.equal(schedule.classList.contains('lcars-view-enter'),true);
 assert.equal(pending.size,1,'rapid tab changes cancel the prior timer');
 [...pending.values()][0].fn();
 assert.equal(schedule.classList.contains('lcars-view-enter'),false);
 assert.equal(pending.size,1,'test scheduler is deliberately manual');
 motion.stop();pending.clear();
 assert.equal(schedule.classList.contains('lcars-view-enter'),false);
});

test('M3 animation skips hidden pages, unknown pages and reduced motion',()=>{
 const journal=page();journal.hidden=true;
 const motion=createViewMotion({getElementById:id=>id==='journal'?journal:null},
 {reduced:()=>false});
 assert.equal(motion.play('journal'),false);
 assert.equal(motion.play('unknown'),false);
 journal.hidden=false;
 const reduced=createViewMotion({getElementById:()=>journal},{reduced:()=>true});
 assert.equal(reduced.play('journal'),false);
 assert.equal(journal.classList.contains('lcars-view-enter'),false);
});

test('M3 CSS cannot shift hit targets and uses a one-shot app-navigation trigger',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const css=read('lcars-navigation-motion.css'),app=read('app.js'),
       html=read('index.html'),sw=read('sw.js');
 assert.match(app,/import \{createViewMotion,createShellMotion\} from '\.\/lcars-motion\.js'/);
 assert.match(app,/if\(entering\)viewMotion\.play\(view\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.view\.lcars-view-enter/);
  const declarations=css.replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(declarations,/translate\(|scale\(|clip-path|pointer-events\s*:\s*none|infinite|position\s*:\s*(?:fixed|absolute)/);
 assert.match(html,/href="lcars-navigation-motion\.css"/);
 assert.match(sw,/lcars-core-v2|v30-makeup-audio-recovery/);
 assert.match(sw,/'\.\/lcars-navigation-motion\.css'/);
 assert.match(sw,/'\.\/lcars-motion\.js'/);
});

test('RC28 full boot lasts longer than navigation and never doubles on quick tab change',()=>{
 const journal=page(),students=page(),pages={journal,students};
 let id=0;const pending=new Map();
 const motion=createViewMotion({getElementById:key=>pages[key]},{
  schedule:(fn,ms)=>{const key=++id;pending.set(key,{fn,ms});return key;},
  clear:key=>pending.delete(key),reduced:()=>false
 });
 assert.equal(motion.play('journal',{boot:true}),true);
 assert.ok(journal.classList.contains('lcars-view-boot'));
 assert.equal([...pending.values()][0].ms,LCARS_BOOT_DURATION_MS);
 assert.equal(LCARS_BOOT_DURATION_MS,1620);
 assert.equal(LCARS_VIEW_DURATION_MS,640);
 assert.equal(motion.play('students'),true);
 assert.equal(journal.classList.contains('lcars-view-boot'),false);
 assert.equal(students.classList.contains('lcars-view-enter'),true);
 assert.equal([...pending.values()][0].ms,LCARS_VIEW_DURATION_MS);
 motion.stop();
 assert.equal(students.classList.contains('lcars-view-enter'),false);
});
