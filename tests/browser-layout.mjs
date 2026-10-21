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
try{
 for(const vp of [{width:320,height:700},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
  const page=await browser.newPage({viewport:vp});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const label=`${vp.width}x${vp.height}`;
  try{
   await page.goto(origin,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#storageStatus')?.textContent?.includes('OFFLINE READY'),{timeout:15000});
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
   await page.locator('#addStudent').click();
   assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
   await page.locator('#modal [name="name"]').fill('VISUAL TEST STUDENT');
   await page.locator('#modal [type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#studentCount')?.textContent==='01',{timeout:15000});
   // Explicitly open the newly saved profile rather than assuming the
   // scheduler automatically selects an arbitrary weekday's first student.
   await page.locator('#students [data-open]').first().click();
   const notes=page.locator('#notes');
   await notes.waitFor({state:'visible'});
   assert.equal(await notes.count(),1,`${label}: journal missing after opening synthetic student`);
   const editor=await notes.evaluate(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height}));
   assert.ok(editor.fontSize>=16,`${label}: iPhone input text must not trigger zoom`);
   assert.ok(editor.height>=75,`${label}: journal editor is too small`);
   await notes.fill('M2 LCARS visual regression sample. No real student information.');
   await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent?.includes('Saved on this device'),{timeout:15000});
   await page.locator('nav [data-view="schedule"]').click();
   const schedule=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();
      return {x:r.x,width:r.width,y:r.y,height:r.height,right:r.right};};
    return ['addAppointment','addTrial','addHoliday'].map(rect);
   });
   for(let i=0;i<schedule.length;i++){
    assert.ok(schedule[i].width>=35&&schedule[i].height>=35,`${label}: schedule touch target ${i} too small`);
    if(i>0)assert.ok(schedule[i].x>=schedule[i-1].right-1,`${label}: schedule actions overlap`);
   }
   await page.locator('nav [data-view="settings"]').click();
   assert.equal(await page.locator('#soundEnabled').count(),1);
   await page.reload({waitUntil:'networkidle'});
   await page.locator('nav [data-view="journal"]').click();
   assert.equal(await page.locator('#notes').inputValue(),
    'M2 LCARS visual regression sample. No real student information.',
    `${label}: journal data changed after reload`);
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
