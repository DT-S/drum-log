// M2 browser gate: Chrome/Chromium layout with synthetic users only.
// Never read or upload production IndexedDB. The test serves the branch on
// an isolated localhost origin, which has its own disposable browser profile.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mimes={'.html':'text/html','.js':'text/javascript','.css':'text/css',
 '.json':'application/json','.webmanifest':'application/manifest+json',
 '.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const local=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
 const file=path.resolve(root,local);
 if(!file.startsWith(root+path.sep)&&file!==root){
  res.writeHead(403).end();return;
 }
 try{
  const fileStat=await stat(file);
  if(!fileStat.isFile())throw Error('Not a file');
  res.setHeader('content-type',mimes[path.extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end('Missing asset');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true});
let failures=0;
// Separate emulated touchscreen probe, using disposable browser context. This
// does not prove iOS Safari behavior but catches lost scroll/tap handlers.
try{
 const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await touch.goto(origin,{waitUntil:'networkidle'});
  const gestures=await touch.evaluate(()=>{
   const event=(type,count)=>{
    const e=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,'touches',{value:Array.from({length:count},()=>({}))});
    document.dispatchEvent(e);return e.defaultPrevented;
   };
   return {
    coarse:matchMedia('(any-pointer: coarse)').matches,
    action:getComputedStyle(document.body).touchAction,
    twoFinger:event('touchmove',2),
    oneFinger:event('touchmove',1),
    gesture:event('gesturestart',0)
   };
  });
  assert.equal(gestures.coarse,true);
  assert.match(gestures.action,/pan-x pan-y/);
  assert.equal(gestures.oneFinger,false);
  assert.equal(gestures.twoFinger,true);
  assert.equal(gestures.gesture,true);
  console.log('PASS emulated touch zoom guard');
 }finally{await touch.close();}
}catch(error){failures++;console.error('FAIL emulated touch zoom guard',error);}

try{
 for(const vp of [{width:320,height:700},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
  const page=await browser.newPage({viewport:vp});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const label=`${vp.width}x${vp.height}`;
  try{
   await page.goto(origin,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#storageStatus')?.textContent?.includes('OFFLINE READY'),{timeout:15000});
   // Full Voyager launch gate defaults on, with a real click for audio.
   await page.locator('#lcarsInitialize').waitFor({state:'visible'});
   const startup=await page.evaluate(()=>{
    const bounds=q=>{
     const e=document.querySelector(q),r=e.getBoundingClientRect();
     return {left:r.left,right:r.right,width:r.width,top:r.top,bottom:r.bottom};
    };
    return {heading:document.querySelector('#lcarsStartupHeading').textContent,
      screen:bounds('#lcarsStartup'),button:bounds('#lcarsInitialize'),
      subtitle:bounds('.lcars-subbrand-label'),
      center:bounds('.lcars-subbrand-bar'),
      badge:bounds('.lcars-studio-badge')};
   });
   assert.match(startup.heading,/DRUM LOG/);
   assert.ok(startup.button.width>=90&&startup.button.left>=0&&startup.button.right<=vp.width+2,
    `${label}: launch CTA clipped horizontally`);
   assert.ok(startup.subtitle.left>=startup.center.left-2 &&
    startup.subtitle.right<=startup.center.right+2,
    `${label}: LCARS subtitle outside colored bar`);
   assert.ok(startup.badge.top>=startup.center.bottom-1,
    `${label}: studio badge overlaps subtitle`);
   const start=Date.now();
   await page.locator('#lcarsInitialize').click();
   await page.waitForTimeout(240);
   const launchPhase=await page.evaluate(()=>({
    visible:!document.querySelector('#lcarsStartup').hidden,
    booting:document.body.classList.contains('lcars-chassis-assembling'),
    viewBoot:document.querySelector('#journal').classList.contains('lcars-view-boot'),
    elbow:getComputedStyle(document.querySelector('header .elbow')).animationName,
    rail:getComputedStyle(document.querySelector('nav button')).animationName,
    versionVisible:getComputedStyle(document.querySelector('footer span:last-child')).display!=='none',
    version:document.querySelector('footer span:last-child').textContent,
    navWidth:document.querySelector('nav button').getBoundingClientRect().width
   }));
   assert.equal(launchPhase.visible,false,`${label}: launcher should disappear immediately`);
   assert.equal(launchPhase.booting,true,`${label}: main chassis not assembling`);
   assert.equal(launchPhase.viewBoot,true,`${label}: first page missing long boot`);
   assert.match(launchPhase.elbow,/dl-assembly-elbow/);
   assert.match(launchPhase.rail,/dl-assembly-appear/);
   assert.equal(launchPhase.versionVisible,true,`${label}: mobile version hidden`);
   assert.match(launchPhase.version,/1\.11\.2/);
   assert.ok(launchPhase.navWidth>=40,`${label}: nav button collapsed during assembly`);
   await page.waitForFunction(()=>!document.body.classList.contains('lcars-chassis-assembling') &&
    !document.querySelector('#journal').classList.contains('lcars-view-boot'));
   assert.ok(Date.now()-start>=1450,`${label}: MP3-aligned full boot ended too early`);
   // Shell animation is finished before regular tab transitions begin.

   const initial=await page.evaluate(()=>{
    const styles=[...document.styleSheets].map(s=>s.href||'');
    return {
     styles:styles.some(s=>s.endsWith('/lcars-components.css')),
     bodyOverflow:document.documentElement.scrollWidth-innerWidth,
     safeData:!!document.querySelector('#journal'),
     navHeight:document.querySelector('nav button').getBoundingClientRect().height
    };
   });
   assert.equal(initial.styles,true,`${label}: no M2 style loaded`);
   assert.ok(initial.bodyOverflow<=3,`${label}: viewport spills horizontally (${initial.bodyOverflow}px)`);
   assert.ok(initial.navHeight>=35,`${label}: navigation too small to touch`);
   await page.locator('nav [data-view="students"]').click();
   await page.locator('#students.lcars-view-enter').waitFor({state:'visible'});
   assert.equal(await page.locator('#students.lcars-view-enter').count(),1,
    `${label}: animation did not acknowledge Students navigation`);
   const built=await page.evaluate(()=>({
    title:getComputedStyle(document.querySelector('#students>.sectionhead')).animationName,
    list:getComputedStyle(document.querySelector('#students>.list')).animationName
   }));
   assert.match(built.title,/dl-sequence-head/);
   assert.match(built.list,/dl-sequence-frame/);
   await page.locator('#addStudent').click();
   assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
   await page.locator('#modal [name="name"]').fill('VISUAL TEST STUDENT');
   await page.locator('#modal [type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#studentCount')?.textContent==='01',{timeout:15000});
   // Explicitly open the newly saved profile rather than assuming the
   // scheduler automatically selects an arbitrary weekday's first student.
   await page.locator('#students [data-open]').first().click();
   assert.equal(await page.locator('#journal.lcars-view-enter').count(),1,
    `${label}: Student to Journal also requires LCARS construction`);
   if(vp.width<=600){
    const history=page.locator('#journal [data-mobile-pane="history"]');
    await history.click();
    assert.equal(await history.evaluate(el=>el.classList.contains('lcars-pane-ack')),true,
     `${label}: history key needs LCARS mode feedback`);
    await page.locator('#journal [data-mobile-pane="notes"]').click();
   }
   const notes=page.locator('#notes');
   await notes.waitFor({state:'visible'});
   assert.equal(await notes.count(),1,`${label}: journal missing after opening synthetic student`);
   const editor=await notes.evaluate(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height}));
   assert.ok(editor.fontSize>=16,`${label}: iPhone input text must not trigger zoom`);
   assert.ok(editor.height>=75,`${label}: journal editor is too small`);
   await notes.fill('M2 LCARS visual regression sample. No real student information.');
   await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent?.includes('Saved on this device'),{timeout:15000});
   await page.locator('nav [data-view="schedule"]').click();
   await page.locator('#addAppointment').waitFor({state:'visible'});
   const schedule=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();
      return {x:r.x,width:r.width,y:r.y,height:r.height,right:r.right};};
    return ['addAppointment','addTrial','addHoliday'].map(rect);
   });
   for(let i=0;i<schedule.length;i++){
    assert.ok(schedule[i].width>=35&&schedule[i].height>=35,`${label}: schedule touch target ${i} too small`);
    if(i>0)assert.ok(schedule[i].x>=schedule[i-1].right-1,`${label}: schedule actions overlap`);
   }
   await page.locator('#planWeek').click();
   assert.equal(await page.locator('#schedule.lcars-view-enter').count(),1,
    `${label}: Week mode should rebuild the LCARS schedule`);
   await page.locator('#planDay').click();
   assert.equal(await page.locator('#schedule.lcars-view-enter').count(),1,
    `${label}: Day mode should rebuild the LCARS schedule`);
   await page.locator('nav [data-view="settings"]').click();
   await page.locator('#soundEnabled').waitFor({state:'visible'});
   assert.equal(await page.locator('#soundEnabled').count(),1);
   assert.equal(await page.locator('#updateCheck').isVisible(),true,
    `${label}: LCARS update console missing`);
   assert.equal(await page.locator('#settings .lcars-slide-percent .lcars-pill').count(),24);
   assert.equal(await page.locator('#settings .lcars-slide-scale .lcars-pill').count(),24);
   const scaleLimits=await page.locator('#mobileScale').evaluate(el=>[el.min,el.max,el.step]);
   assert.deepEqual(scaleLimits,['65','100','5']);
   await page.locator('#settings .lcars-slide-percent .lcars-preset[data-value="50"]').click();
   await page.locator('#settings .lcars-slide-scale .lcars-preset[data-value="65"]').click();
   assert.equal(await page.locator('#soundVolume').inputValue(),'50');
   assert.equal(await page.locator('#mobileScale').inputValue(),'65');
   assert.equal(await page.locator('#volumeValue').textContent(),'50%');
   assert.equal(await page.locator('#mobileScaleValue').textContent(),'65%');
   await page.locator('#mobileScale').focus();
   await page.locator('#mobileScale').press('ArrowUp');
   assert.equal(await page.locator('#mobileScale').inputValue(),'70');
   await page.waitForFunction(async()=>{
    const db=await new Promise((resolve,reject)=>{
     const r=indexedDB.open('drum-log-lcars',1);
     r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    try{return await new Promise(resolve=>{
     const r=db.transaction('state','readonly').objectStore('state').get('main');
     r.onsuccess=()=>resolve(r.result.settings.uiScale===70&&r.result.settings.soundVolume===.5);
     r.onerror=()=>resolve(false);
    });}finally{db.close();}
   });

   assert.equal(await page.locator('#launchScreen').isChecked(),true);
   await page.locator('#launchScreen').uncheck();
   await page.waitForFunction(async()=>{
    const db=await new Promise((resolve,reject)=>{
     const req=indexedDB.open('drum-log-lcars',1);
     req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    try{return await new Promise(resolve=>{
     const get=db.transaction('state','readonly').objectStore('state').get('main');
     get.onsuccess=()=>resolve(get.result.settings.launchScreen===false);
     get.onerror=()=>resolve(false);
    });}finally{db.close();}
   });
   await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#storageStatus')?.textContent?.includes('OFFLINE READY'),{timeout:15000});
   assert.equal(await page.locator('#lcarsStartup').isVisible(),false,
    `${label}: disabled launch should not block restored journal`);
   await page.locator('nav [data-view="students"]').click();
   await page.locator('#students [data-open]').first().waitFor({state:'visible'});
   await page.locator('#students [data-open]').first().click();
   await page.locator('#notes').waitFor({state:'visible'});
   assert.equal(await page.locator('#notes').inputValue(),
    'M2 LCARS visual regression sample. No real student information.',
    `${label}: journal data changed after reload`);
   // Regression for Edit Student with a different student's one-off override.
   await page.evaluate(async()=>{
    const {mutate}=await import('/db.js');
    await mutate(st=>{
     st.students.push({id:'synthetic-override-owner',name:'ZZ OVERRIDE OWNER',
      schedule:'weekly',day:1,time:'14:00',duration:45,remarks:'',
      archived:false,makeupBalance:2});
     st.lessonOverrides.push({studentId:'synthetic-override-owner',
      originalDate:'2026-10-19',originalTime:'14:00',
      date:'2026-10-19',time:'14:00',duration:90});
    });
   });
   await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#storageStatus')?.textContent?.includes('OFFLINE READY'));
   await page.locator('nav [data-view="students"]').click();
   await page.locator('#students .studentrow').filter({hasText:'VISUAL TEST STUDENT'}).locator('[data-edit]').click();
   await page.locator('#modal [name="makeupBalance"]').fill('4');
   await page.locator('#modal [type="submit"]').click();
   await page.waitForFunction(()=>!document.querySelector('#modal').open);
   const safety=await page.evaluate(async()=>{
    const {readState}=await import('/db.js'),st=await readState();
    return {balance:st.students.find(x=>x.name==='VISUAL TEST STUDENT')?.makeupBalance,
     overrides:st.lessonOverrides.filter(x=>x.studentId==='synthetic-override-owner').length,
     notes:st.lessons.find(x=>x.notes?.startsWith('M2 LCARS visual regression'))?.notes};
   });
   assert.equal(safety.balance,4,`${label}: manual makeup balance correction failed`);
   assert.equal(safety.overrides,1,`${label}: another student's override changed`);
   assert.match(safety.notes||'',/M2 LCARS visual regression/);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('nav [data-view="schedule"]').click();
   await page.locator('#addAppointment').waitFor({state:'visible'});
   assert.equal(await page.locator('#schedule.lcars-view-enter').count(),0,
    `${label}: reduced-motion requested yet a view animation started`);
   assert.deepEqual(errors,[],`${label}: browser JavaScript errors`);
   console.log(`PASS ${label}: visuals, four views, dialog, input, save/reload`);
  }catch(error){
   failures++;
   console.error(`FAIL ${label}`,error);
   await page.screenshot({path:`/tmp/drum-log-layout-${vp.width}.png`,fullPage:true}).catch(()=>{});
  }finally{await page.close();}
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failures)process.exitCode=1;
