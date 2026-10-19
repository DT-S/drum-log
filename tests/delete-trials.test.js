import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,removeTrial,validateBackup,selectScheduled,convertTrial} from '../core.js';
import {dayEvents,availableSlots} from '../schedule.js';

const trial=(id,name='Same Name',day='2026-10-20',time='15:00',archived=false)=>({
 id,name,date:day,time,duration:45,contact:'Contact: test@example.org',
 remarks:'This person may come back',notes:'Handwritten practice notes',
 archived
});

test('removes one trial by immutable ID, not by name, preserving identical-named trials',()=>{
 const st=defaults();
 st.trials=[trial('first'),trial('second','Same Name','2026-10-27'),trial('third','Another Name','2026-10-28')];
 const removed=removeTrial(st,'first');
 assert.equal(removed.id,'first');
 assert.deepEqual(st.trials.map(t=>t.id),['second','third']);
 assert.equal(st.trials[0].notes,'Handwritten practice notes');
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(st))),st);
});

test('removes archived past trial without disturbing others',()=>{
 const st=defaults();st.trials=[trial('past','Guest','2026-09-01','10:00',true),trial('future','Guest')];
 removeTrial(st,'past');
 assert.equal(st.trials.length,1);
 assert.equal(st.trials[0].id,'future');
 assert.equal(st.trials[0].archived,false);
});

test('deleting trial clears it from schedule and removes its busy time',()=>{
 const st=defaults();
 st.settings.teachingHours[2]={start:'14:00',end:'17:00'};
 st.trials=[trial('cancelled','Potential Student','2026-10-20','15:00')];
 assert.equal(dayEvents(st,'2026-10-20').find(e=>e.trialId==='cancelled').kind,'trial');
 assert.equal(availableSlots(st,'2026-10-20').length,2);
 removeTrial(st,'cancelled');
 assert.equal(dayEvents(st,'2026-10-20').length,0);
 assert.deepEqual(availableSlots(st,'2026-10-20'),[{start:'14:00',end:'17:00',minutes:180}]);
 assert.equal(selectScheduled([],new Date('2026-10-20T14:00:00'),[],st.trials).selected,null);
});

test('deleting a trial never touches notes in student logs, event list or make-up credits',()=>{
 const st=defaults();
 st.students=[{id:'s',name:'Same Name',day:2,time:'15:00',duration:45,remarks:'Permanent',archived:false,makeupBalance:2}];
 st.lessons=[{id:JSON.stringify(['s','2026-10-13','15:00']),studentId:'s',date:'2026-10-13',time:'15:00',duration:45,notes:'DO NOT DELETE'}];
 st.appointments=[{id:'ap',studentId:'s',date:'2026-10-22',time:'15:00',duration:45,label:'Extra lesson'}];
 st.calendarEvents=[{id:'ev',title:'Recording with Same Name',date:'2026-10-23',time:'15:00',duration:90,type:'recording',people:'Same Name',notes:'Record track'}];
 st.trials=[trial('trial','Same Name')];
 const old={students:structuredClone(st.students),lessons:structuredClone(st.lessons),
  appointments:structuredClone(st.appointments),calendarEvents:structuredClone(st.calendarEvents)};
 removeTrial(st,'trial');
 for(const [k,v] of Object.entries(old))assert.deepEqual(st[k],v);
 assert.equal(st.students[0].makeupBalance,2);
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(st))),st);
});

test('nonexistent or converted trial cannot be deleted and data remains unchanged',()=>{
 const st=defaults();st.trials=[trial('one','Guest')];
 const before=JSON.stringify(st);
 assert.throws(()=>removeTrial(st,'nonexistent'),/no longer exists/);
 assert.equal(JSON.stringify(st),before);
 convertTrial(st,'one',{id:'person',name:'Guest',day:2,time:'17:00',duration:45,remarks:'',archived:false,schedule:'weekly',makeupBalance:0},'conversion-1');
 const afterConversion=JSON.stringify(st);
 assert.throws(()=>removeTrial(st,'one'),/no longer exists/);
 assert.equal(JSON.stringify(st),afterConversion);
 assert.equal(st.students.length,1);
});

test('the third Trial record action and Schedule list Delete both require confirmation',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const record=src.slice(src.indexOf('function renderTrial(){'),src.indexOf('function saveTrialNotes(){'));
 const list=src.slice(src.indexOf('function trialScheduleHTML(){'),src.indexOf('function editTrial(t){'));
 const confirm=src.slice(src.indexOf('function confirmDeleteTrial(trial){'),src.indexOf('function editTrial(t){'));
 assert.match(record,/id="trialConvert"/);
 assert.match(record,/id="trialArchive"/);
 assert.match(record,/id="trialDelete"/);
 assert.match(record,/confirmDeleteTrial\(t\)/);
 assert.match(list,/data-trial-delete/);
 assert.match(list,/if\(!await ready\(\)\)return/);
 assert.match(confirm,/Delete trial lesson\?/);
 assert.match(confirm,/Delete trial permanently/);
 assert.match(confirm,/data-close>Keep trial/);
 assert.match(confirm,/removeTrial\(st,trial\.id\)/);
 assert.match(confirm,/trialId=null/);
});

test('version and offline shell cache are bumped for deletion feature',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.equal(pkg.version,'1.9.1');
 assert.match(sw,/PREFIX\+'v16'/);
});
