import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup} from '../core.js';
import {saveLessonOverride} from '../schedule.js';

const student=(id,day,time)=>({
 id,name:'Synthetic '+id,schedule:'weekly',day,time,
 duration:45,remarks:'',archived:false,makeupBalance:2
});
const clone=x=>structuredClone(x);

test('editing one student must not validate unrelated students lesson overrides against a fake partial backup',()=>{
 const actual=defaults();
 actual.students=[student('A',4,'18:15'),student('B',1,'14:00')];
 saveLessonOverride(actual,{studentId:'B',date:'2026-10-19',time:'14:00'},
  {date:'2026-10-19',time:'14:00',duration:90});
 assert.equal(actual.lessonOverrides.length,1);
 const edited={...actual.students[0],makeupBalance:4};
 // This was the real 1.11.1 Edit student bug: the partial fixture retained
 // another student's override but removed that other student from the fixture.
 assert.throws(()=>validateBackup({...actual,students:[edited],lessons:[],
  appointments:[],trials:[],cancellations:[]}),/Invalid backup: lesson override/);
 assert.deepEqual(validateBackup({...defaults(),students:[edited]}).students,[edited]);
 const next=clone(actual);next.students[0]=edited;
 assert.deepEqual(validateBackup(next),next);
 assert.equal(next.lessonOverrides.length,1);
 assert.equal(next.lessonOverrides[0].studentId,'B');
});
test('student editor validates isolated input, real full state, and deletes only subject overrides',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/validateBackup\(\{\.\.\.defaults\(\),students:\[item\]\}\)/);
 assert.doesNotMatch(app,/validateBackup\(\{\.\.\.state,students:\[item\],lessons:\[\]/);
 assert.match(app,/validateBackup\(st\)/);
 assert.match(app,/st\.lessonOverrides=st\.lessonOverrides\.filter\(x=>x\.studentId!==s\.id\)/);
});
test('isolated draft validation still rejects malformed student records',()=>{
 const s=student('A',4,'18:15');
 assert.throws(()=>validateBackup({...defaults(),students:[{...s,makeupBalance:-1}]}),/student record/);
 assert.throws(()=>validateBackup({...defaults(),students:[{...s,day:9}]}),/schedule day or time/);
});
