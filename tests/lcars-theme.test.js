import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validateBackup} from '../core.js';
import {THEMES,normalizeTheme,applyTheme} from '../lcars-theme.js';
test('theme defaults and legacy backups',()=>{
 assert.deepEqual(THEMES,['voyager','elite','redalert']);
 assert.equal(defaults().settings.theme,'voyager');
 const old=defaults();delete old.settings.theme;
 assert.equal(validateBackup(old).settings.theme,'voyager');
});
test('all palettes roundtrip in backups and reject invalid values',()=>{
 for(const theme of THEMES){const state=defaults();state.settings.theme=theme;
  assert.equal(validateBackup(JSON.parse(JSON.stringify(state))).settings.theme,theme);}
 const state=defaults();state.settings.theme='bad';
 assert.throws(()=>validateBackup(state),/LCARS display theme/);
});
test('palette sets shell, launch preview and controls',()=>{
 const buttons=THEMES.map(theme=>({dataset:{setTheme:theme},setAttribute(k,v){this[k]=v;}}));
 const setting={value:'voyager'},overlay={dataset:{}};
 const root={documentElement:{dataset:{}},querySelector:s=>s==='#lcarsStartup'?overlay:s==='#appTheme'?setting:null,querySelectorAll:()=>buttons};
 assert.equal(applyTheme(root,'redalert'),'redalert');
 assert.equal(root.documentElement.dataset.appTheme,'redalert');
 assert.equal(overlay.dataset.theme,'redalert');
 assert.equal(setting.value,'redalert');
 assert.deepEqual(buttons.map(b=>b['aria-pressed']),['false','false','true']);
 assert.equal(normalizeTheme('invalid'),'voyager');
});
