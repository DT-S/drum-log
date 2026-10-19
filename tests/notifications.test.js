import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const segment=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected notification lifecycle');
 return app.slice(a,b);
};
function fakeNotices(){
 const banner={hidden:true,textContent:'',title:'',tabIndex:-1,onclick:null,onkeydown:null};
 const sounds=[];
 const pending=new Map();
 let nextId=1;
 const context={
  $:id=>id==='#notice'?banner:null,
  sounds:{play:tone=>sounds.push(tone)},
  setTimeout:(fn,delay)=>{const id=nextId++;pending.set(id,{fn,delay});return id;},
  clearTimeout:id=>pending.delete(id)
 };
 const code=segment('let noticeTimer=null;','async function change(');
 const api=vm.runInNewContext(code+'\n({notice,clearNotice,NOTICE_LIFETIME_MS})',context);
 const fire=id=>{const t=pending.get(id);if(!t)return;pending.delete(id);t.fn();};
 return {banner,sounds,pending,fire,...api};
}
test('every ordinary status notice closes automatically after 8.5 seconds',()=>{
 const ui=fakeNotices();
 ui.notice('Persistent storage granted. Keep making backups.','accept');
 assert.equal(ui.banner.hidden,false);
 assert.match(ui.banner.textContent,/Persistent storage granted/);
 assert.equal(ui.banner.tabIndex,0);
 assert.equal(ui.pending.size,1);
 const [[id,t]]=[...ui.pending.entries()];
 assert.equal(t.delay,8500);
 ui.fire(id);
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.textContent,'');
 assert.equal(ui.banner.tabIndex,-1);
 assert.equal(ui.pending.size,0);
 assert.deepEqual(ui.sounds,['accept']);
});
test('browser-managed persistent storage warning expires too',()=>{
 const ui=fakeNotices();
 ui.notice('Persistent storage was not granted by this browser. Keep regular backups.','warning');
 assert.equal(ui.banner.hidden,false);
 const id=[...ui.pending.keys()][0];
 ui.fire(id);
 assert.equal(ui.banner.hidden,true);
 assert.deepEqual(ui.sounds,['warning']);
});
test('new notice replaces old text and restarts expiry timer, so old timer cannot hide it',()=>{
 const ui=fakeNotices();
 ui.notice('Teaching hours saved.','accept');
 const oldId=[...ui.pending.keys()][0];
 ui.notice('Backup download started. Keep the file somewhere safe.','accept');
 assert.equal(ui.pending.has(oldId),false);
 assert.equal(ui.pending.size,1);
 assert.match(ui.banner.textContent,/Backup download/);
 ui.fire(oldId);
 assert.equal(ui.banner.hidden,false);
 const newId=[...ui.pending.keys()][0];
 ui.fire(newId);
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.textContent,'');
});
test('touch/click dismisses a notice immediately and cancels the timer',()=>{
 const ui=fakeNotices();
 ui.notice('Backup interval exceeded.','warning');
 assert.equal(ui.banner.title,'Tap to dismiss this message');
 ui.banner.onclick();
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.onclick,null);
 assert.equal(ui.pending.size,0);
});
test('keyboard Enter, Space and Escape dismiss active notice accessibly',()=>{
 for(const key of ['Enter',' ','Escape']){
  const ui=fakeNotices();
  ui.notice('Data changed in another tab.','warning');
  let prevented=false;
  ui.banner.onkeydown({key,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(ui.banner.hidden,true);
  assert.equal(ui.pending.size,0);
 }
});
test('non-dismissal keys do not close notice or cancel its expiry',()=>{
 const ui=fakeNotices();
 ui.notice('Saved.','accept');
 let prevented=false;
 ui.banner.onkeydown({key:'Tab',preventDefault(){prevented=true;}});
 assert.equal(prevented,false);
 assert.equal(ui.banner.hidden,false);
 assert.equal(ui.pending.size,1);
});
test('empty notice clears active text and timeout without another sound',()=>{
 const ui=fakeNotices();
 ui.notice('Message','warning');
 ui.notice('');
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.textContent,'');
 assert.equal(ui.pending.size,0);
 assert.deepEqual(ui.sounds,['warning']);
});
test('every ordinary popup shares notice lifecycle, and nav/dialog clear it',()=>{
 assert.match(app,/function notice\(text,tone='warning'\)/);
 assert.match(app,/notice\(yes\?'Persistent storage granted/);
 assert.match(app,/notice\('Teaching hours saved/);
 assert.match(app,/notice\('Backup download started/);
 assert.match(app,/notice\('Backup interval exceeded/);
 assert.match(app,/channel&&\(channel\.onmessage=\(\)=>\{notice\('Data changed in another tab/);
 assert.match(app,/async function navigate\(next\)\{if\(!await ready\(\)\)return;clearNotice\(\);clearGlobalError/);
 assert.match(app,/const m=\$\('#modal'\);clearDialogError\(\);clearNotice\(\);clearGlobalError/);
});
test('critical save errors still use the separate persistent #error channel',()=>{
 const code=segment('let dialogErrorTimeout=null;','let noticeTimer=null;');
 assert.match(code,/function error\(e\)/);
 assert.match(code,/const banner=\$\('#error'\);banner\.textContent=message;banner\.hidden=false/);
 assert.match(app,/if\(saveFailure\)\{error\(Error\('Your last edit is not saved/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<div id="notice" role="status" hidden><\/div>/);
 assert.match(html,/<div id="error" role="alert" hidden><\/div>/);
});
