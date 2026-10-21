import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../schedule.css',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const sourceBetween=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected functions for error lifecycle testing');
 return app.slice(a,b);
};
function fakeUI(){
 let activeAlert=null,task=null,timeoutDelay=null;
 const banner={hidden:true,textContent:'',title:'',tabIndex:-1};
 const modal={
  open:true,
  innerHTML:'',
  prepend(node){activeAlert=node;},
  querySelector(selector){
   if(selector==='[data-dialog-error]')return activeAlert;
   if(selector==='form')return null;
   return null;
  },
  querySelectorAll(){return [];},
  showModal(){this.open=true;},
  close(){this.open=false;this.onclose?.();}
 };
 const document={createElement:()=>({
  textContent:'',title:'',tabIndex:-1,dataset:{},
  setAttribute(name,value){this[name]=value;},
  remove(){activeAlert=null;}
 })};
 const context={
  document,
  $:id=>id==='#modal'?modal:id==='#error'?banner:null,
  sounds:{play(){}},
  bindDateTimeFields(){},
  setTimeout(fn,delay){task=fn;timeoutDelay=delay;return 1;},
  clearTimeout(){task=null;}
 };
 const code=sourceBetween('let dialogErrorTimeout=null;','function notice(')+
  '\n'+sourceBetween('function dialog(html,onSubmit){','function editStudent(');
 const {error,dialog,clearDialogError,clearGlobalError}=vm.runInNewContext(
  code+'\n({error,dialog,clearDialogError,clearGlobalError})',context);
 return {error,dialog,clearDialogError,clearGlobalError,modal,banner,getAlert:()=>activeAlert,fireTimer:()=>task?.(),getDelay:()=>timeoutDelay};
}

test('Schedule has exactly three single-row LCARS actions while Students retains Add Student',()=>{
 const schedule=sourceBetween('function renderSchedule(){','function bindPlanActions(){');
 assert.match(schedule,/class="sectionhead schedule-head"/);
 assert.match(schedule,/class="schedule-actions"/);
 assert.doesNotMatch(schedule,/One-off cancellations · Replacement lessons · Available time/);
 for(const id of ['addAppointment','addTrial','addHoliday'])assert.match(schedule,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(schedule,/id="addStudent"/);
 assert.match(app,/function renderStudents\(\)[\s\S]*?id="addStudent"/);
 assert.match(css,/schedule-actions button:first-child/);
 assert.match(css,/schedule-actions button:last-child/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/#schedule \.schedule-actions button:not\(:first-child\):not\(:last-child\)\{border-radius:0\}/);
});

test('date navigation uses two real SVG vector chevrons, not Unicode glyph arrows',()=>{
 const schedule=sourceBetween('function renderSchedule(){','function bindPlanActions(){');
 assert.match(schedule,/<svg viewBox="0 0 38 28"/);
 assert.match(schedule,/class="plan-arrow plan-arrow-prev"/);
 assert.match(schedule,/class="plan-arrow plan-arrow-next"/);
 assert.match(schedule,/aria-label="Previous/);
 assert.match(schedule,/aria-label="Next/);
 assert.doesNotMatch(schedule,/[◀▶←→]/);
 assert.match(schedule,/id="plannerDate"/);
 assert.match(schedule,/id="planDay"/);
 assert.match(schedule,/id="planWeek"/);
 assert.match(css,/#schedule \.plan-date-nav svg/);
});

test('holiday validation is a dismissible modal error and never an immortal page alert',()=>{
 const ui=fakeUI();
 ui.error(new Error('Holiday end date must be on or after the start date.'));
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.textContent,'');
 assert.equal(ui.getAlert().textContent,'Holiday end date must be on or after the start date.');
 assert.equal(ui.getAlert().role,'alert');
 assert.equal(ui.getDelay(),10000);
 ui.getAlert().onclick();
 assert.equal(ui.getAlert(),null);
});

test('changing a holiday field and cancelling/escaping dialog clear validation',()=>{
 const ui=fakeUI();
 ui.dialog('<form></form>',()=>{});
 ui.error(new Error('Holiday end date must be on or after the start date.'));
 assert.ok(ui.getAlert());
 ui.modal.oninput();
 assert.equal(ui.getAlert(),null);
 ui.error(new Error('Holiday end date must be on or after the start date.'));
 ui.modal.onchange();
 assert.equal(ui.getAlert(),null);
 ui.error(new Error('Holiday end date must be on or after the start date.'));
 ui.modal.close();
 assert.equal(ui.getAlert(),null);
});

test('validation auto expires, while non-modal errors persist until explicitly dismissed',()=>{
 const ui=fakeUI();
 ui.dialog('<form></form>',()=>{});
 ui.error(new Error('Holiday end date must be on or after the start date.'));
 assert.ok(ui.getAlert());
 ui.fireTimer();
 assert.equal(ui.getAlert(),null);
 ui.modal.close();
 ui.error(new Error('Storage failed'));
 assert.equal(ui.banner.hidden,false);
 assert.equal(ui.banner.textContent,'Storage failed');
 ui.clearGlobalError();
 assert.equal(ui.banner.hidden,true);
 assert.equal(ui.banner.textContent,'');
});

test('offline stylesheet cache and release label update together',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(html,/schedule\.css/);
 assert.match(sw,/'\.\/schedule\.css'/);
 assert.equal(pkg.version,'1.10.1');
 assert.match(html,/DRUM LOG \/ 1\.10\.1/);
 assert.match(sw,/PREFIX\+'v21-lcars-startup'/);
});
