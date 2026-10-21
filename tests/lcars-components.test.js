import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup} from '../core.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('M2 renders themed components separately on all four existing views',()=>{
 const html=read('index.html'),css=read('lcars-components.css'),old=read('mobile.css');
 assert.match(html,/href="lcars-refresh\.css"><link rel="stylesheet" href="lcars-components\.css"/);
 for(const marker of [
 '#journal .editor-console','#journal .notes','#journal .history button.selected',
 '#students .studentrow','#students .searchbar',
 '#schedule .schedule-actions button','#schedule .plan-row.slot-trial','#schedule .plan-row.slot-calendar',
 '#settings .settingsgrid .panel','#settings .snippetrow','dialog h2',
 'prefers-reduced-motion:reduce'
 ])assert.ok(css.includes(marker),'missing component '+marker);
 assert.match(old,/height:100dvh/);
 assert.match(old,/data-mobile-pane="history"/);
 assert.match(css,/#journal \.notes\{font-size:16px/);
 assert.match(css,/pointer-events:none/);
});

test('M2 CSS keeps schedule-specific status colors and data rules intact',()=>{
 const css=read('lcars-components.css'),core=read('core.js'),db=read('db.js');
 assert.doesNotMatch(css,/\.slot-trial\s*\{[^}]*--accent:/);
 assert.doesNotMatch(css,/\.slot-available\s*\{[^}]*--accent:/);
 assert.doesNotMatch(css,/\.slot-calendar\s*\{[^}]*--accent:/);
 assert.doesNotMatch(css,/#schedule \.schedule-actions\s*\{[^}]*grid-template-columns:/);
 assert.match(core,/schemaVersion:10/);
 assert.match(db,/indexedDB\.open\('drum-log-lcars',1\)/);
 assert.deepEqual(validateBackup(defaults()),defaults());
});

test('M2 stylesheet is offline cached and cache version updated',()=>{
 const css=read('lcars-components.css'),sw=read('sw.js');
 assert.match(sw,/'\.\/lcars-components\.css'/);
 assert.match(sw,/const CACHE=PREFIX\+'v20-lcars-motion'/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
});
