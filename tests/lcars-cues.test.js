import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyDrumCue,SOUND_FILES} from '../sound.js';
function control({tagName='BUTTON',type='',dataset={},classNames=[],attrs=[]}={}){
 const a=new Set(attrs);
 return {tagName,type,dataset,
  hasAttribute:name=>a.has(name),
  getAttribute:name=>a.has(name)?'true':null,
  classList:{contains:name=>classNames.includes(name)}
 };
}
test('LCARS feedback chooses a meaningful cue without changing navigation double-sound',()=>{
 const cases=[
  [control({dataset:{view:'settings'}}),null],
  [control({dataset:{mobilePane:'history'}}),'mode'],
  [control({classNames:['lcars-plus']}),'increase'],
  [control({classNames:['lcars-minus']}),'decrease'],
  [control({classNames:['lcars-jump-up']}),'increase'],
  [control({classNames:['lcars-jump-down']}),'decrease'],
  [control({classNames:['plan-arrow-next']}),'increase'],
  [control({dataset:{up:'a'}}),'increase'],
  [control({dataset:{down:'a'}}),'decrease'],
  [control({attrs:['data-close']}),'close'],
  [control({type:'checkbox'}),'toggle'],
  [control({tagName:'SUMMARY'}),'toggle'],
  [control({attrs:['aria-expanded']}),'toggle'],
  [control(),'press']
 ];
 for(const [el,expected] of cases)assert.equal(classifyDrumCue(el),expected);
});
test('Contextual cues use bundled original sounds and cache version is updated',()=>{
 for(const name of ['mode','increase','decrease','toggle','close','update'])
  assert.ok(SOUND_FILES[name]?.startsWith('soundsv2/'),name);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(sw,/v29-audio-sync/);
 assert.match(sw,/'\.\/sound\.js'/);
 assert.match(app,/sounds\.play\('update'\)/);
});
