import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup} from '../core.js';

test('default phone UI scale is 80% with schema-7 backward compatibility',()=>{
 const state=defaults();
 assert.equal(state.schemaVersion,7);
 assert.equal(state.settings.uiScale,80);
 assert.equal(validateBackup(state).settings.uiScale,80);
});

test('phone scale survives an exported JSON backup and older backups remain valid',()=>{
 const state=defaults();
 state.settings.uiScale=75;
 assert.equal(validateBackup(JSON.parse(JSON.stringify(state))).settings.uiScale,75);
 delete state.settings.uiScale;
 assert.equal(validateBackup(state).settings.uiScale,80);
});

test('invalid phone scale from a backup is rejected before replacing data',()=>{
 for(const scale of [0,64,66,101,75.5,'80',null,Infinity]){
  const state=defaults();state.settings.uiScale=scale;
  assert.throws(()=>validateBackup(state),/Invalid backup: mobile UI scale/);
 }
 for(const scale of [65,70,75,80,85,90,95,100]){
  const state=defaults();state.settings.uiScale=scale;
  assert.equal(validateBackup(state).settings.uiScale,scale);
 }
});

test('offline shell includes the mobile CSS and phone panel controls',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../mobile.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(sw,/'\.\/mobile\.css'/);
 assert.match(html,/href="mobile\.css"/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/data-mobile-pane="history"/);
 assert.match(app,/id="mobileScale"/);
 assert.match(app,/function bindMobilePanes/);
});
