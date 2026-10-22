import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {defaults,validateBackup} from '../core.js';
import {SOUND_FILES as cueRegistry} from '../sound.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('LCARS refresh remains separate from the stable data and layout modules',()=>{
 const html=read('index.html'),css=read('lcars-refresh.css'),app=read('app.js');
 assert.match(html,/href="lcars-refresh\.css"/);
 assert.match(css,/--padd-amber/);
 assert.match(css,/--padd-lavender/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.doesNotMatch(css,/\.view\s*\{[^}]*transform|\.layout\s*\{[^}]*display:/);
 assert.match(app,/if\(view!==next\)sounds\.transition\(\);else sounds\.play\('press'\)/);
 const state=defaults();
 assert.equal(state.schemaVersion,10);
 assert.deepEqual(validateBackup(state),state);
});
test('Drum Log v19 offline shell precaches the style and every active sound',()=>{
 const sw=read('sw.js'),html=read('index.html');
 assert.match(sw,/const CACHE=PREFIX\+'v33-launch-palette-polish'/);
 assert.match(sw,/'\.\/lcars-refresh\.css'/);
 assert.match(html,/href="mobile\.css"/);
 assert.match(html,/href="schedule\.css"/);
 for(const path of Object.values(cueRegistry)){
  const rel='./sounds/'+path;
  assert.ok(sw.includes("'"+rel+"'"),'PWA missed '+rel);
  assert.ok(existsSync(new URL('../sounds/'+path,import.meta.url)),'missing '+rel);
 }
 assert.doesNotMatch(sw,/sounds_update21102026\.7z/);
});
