import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup,migrateState,lessonKey} from '../core.js';
import {cancelLesson,restoreLesson,bookReplacement,dayEvents} from '../schedule.js';

const mon='2026-10-19';
const student=(id='A',time='12:15')=>({id,name:id,day:1,time,duration:45,schedule:'weekly',remarks:'',archived:false});
const key=(studentId='A',date=mon,time='12:15')=>({studentId,date,time});

test('only teacher cancellations award a make-up lesson',()=>{
 const s=defaults();s.students=[student()];
 cancelLesson(s,key(),'sick','student');
 assert.equal(s.students[0].makeupBalance??0,0);
 assert.equal(s.cancellations[0].cancelledBy,'student');
 restoreLesson(s,key());
 assert.equal(s.students[0].makeupBalance??0,0);
 cancelLesson(s,key(),'other','teacher');
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(dayEvents(s,mon)[0].cancelledBy,'teacher');
 assert.equal(s.cancellations[0].cancelledBy,'teacher');
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>cancelLesson(s,key(),'other','teacher'),/already cancelled/);
 assert.equal(s.students[0].makeupBalance,1);
});

test('teacher cancelled twice on separate weeks owes exactly two lessons, student cancelled owes zero',()=>{
 const s=defaults();s.students=[student()];
 cancelLesson(s,key(),'cancelled','teacher');
 cancelLesson(s,key('A','2026-10-26'),'cancelled','teacher');
 assert.equal(s.students[0].makeupBalance,2);
 cancelLesson(s,key('A','2026-11-02'),'sick','student');
 assert.equal(s.students[0].makeupBalance,2);
 restoreLesson(s,key('A','2026-11-02'));
 assert.equal(s.students[0].makeupBalance,2);
 restoreLesson(s,key());
 assert.equal(s.students[0].makeupBalance,1);
 restoreLesson(s,key('A','2026-10-26'));
 assert.equal(s.students[0].makeupBalance,0);
});

test('manual balance correction remains editable; restoring after manual zero cannot go negative',()=>{
 const s=defaults();s.students=[{...student(),makeupBalance:3}];
 cancelLesson(s,key(),'vacation','teacher');
 assert.equal(s.students[0].makeupBalance,4);
 s.students[0].makeupBalance=0; // Instructor manually corrected balance.
 restoreLesson(s,key());
 assert.equal(s.students[0].makeupBalance,0);
 assert.deepEqual(s.cancellations,[]);
});

test('atomic replacement by teacher credits original student, not replacement student',()=>{
 const s=defaults();s.students=[student('A'),student('B','16:00')];
 bookReplacement(s,key(),'B','cancelled','teacher');
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.students[1].makeupBalance??0,0);
 assert.equal(s.appointments.length,1);
 assert.equal(s.cancellations[0].cancelledBy,'teacher');
 assert.equal(s.cancellations[0].studentId,'A');
 assert.deepEqual(validateBackup(s),s);
});
test('replacement defaults to student cancellation, including explicit student reason',()=>{
 const s=defaults();s.students=[student('A'),student('B','16:00')];
 bookReplacement(s,key(),'B','sick');
 assert.equal(s.students[0].makeupBalance??0,0);
 assert.equal(s.cancellations[0].cancelledBy,'student');
});
test('invalid initiator, duplicate cancellation and max balance do not modify state',()=>{
 const s=defaults();s.students=[student()];
 const before=JSON.stringify(s);
 assert.throws(()=>cancelLesson(s,key(),'cancelled','robot'),/origin/);
 assert.equal(JSON.stringify(s),before);
 s.students[0].makeupBalance=9999;
 const prior=JSON.stringify(s);
 assert.throws(()=>cancelLesson(s,key(),'cancelled','teacher'),/maximum/);
 assert.equal(JSON.stringify(s),prior);
 cancelLesson(s,key(),'cancelled','student'); // Student cancellation allowed at max balance.
 assert.equal(s.students[0].makeupBalance,9999);
});

test('planning alone is not proof of attendance, but a make-up booking consumes a credit immediately',()=>{
 const s=defaults();s.students=[student()];
 cancelLesson(s,key(),'cancelled','teacher');
 assert.equal(s.students[0].makeupBalance,1);
 // A simple extra booking doesn't use the credit.
 s.appointments.push({id:'extra',studentId:'A',date:'2026-10-20',time:'12:15',duration:45,label:'Extra lesson'});
 assert.equal(s.students[0].makeupBalance,1);
});
test('legacy schema 6 data and cancellations migrate without inventing past teacher credits',()=>{
 const old=defaults();old.schemaVersion=6;old.students=[student()];
 old.cancellations=[{studentId:'A',date:mon,time:'12:15',reason:'cancelled'}];
 assert.equal(old.students[0].makeupBalance,undefined);
 const imported=validateBackup(JSON.parse(JSON.stringify(old)));
 assert.equal(imported.schemaVersion,9);
 assert.equal(imported.students[0].makeupBalance??0,0);
 assert.equal(imported.cancellations[0].cancelledBy??'student','student');
 const migrated=migrateState(JSON.parse(JSON.stringify(old)));
 assert.equal(migrated.schemaVersion,9);
 assert.deepEqual(migrated.lessons,[]);
 assert.equal(migrated.students[0].makeupBalance??0,0);
});

test('backup roundtrip preserves manual credit values and teacher origin; invalid data is rejected',()=>{
 const s=defaults();s.students=[{...student(),makeupBalance:7}];
 cancelLesson(s,key(),'sick','teacher');
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
 for(const value of [-1,1.5,10000,'5',null,NaN,Infinity]){
  assert.throws(()=>validateBackup({...s,students:[{...s.students[0],makeupBalance:value}]}),/Invalid backup: student record/);
 }
 for(const value of ['anyone','',null,42]){
  assert.throws(()=>validateBackup({...s,cancellations:[{...s.cancellations[0],cancelledBy:value}]}),/Invalid backup: cancelled lesson/);
 }
 assert.throws(()=>validateBackup({...s,schemaVersion:10}),/unsupported schema/);
});

test('three mobile terminal caps and cancellation UI affordances are present',()=>{
 const css=readFileSync(new URL('../schedule.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(css,/#schedule \.schedule-actions button:first-child\{border-radius:20px 0 0 20px\}/);
 assert.match(css,/#schedule \.schedule-actions button:not\(:first-child\):not\(:last-child\)\{border-radius:0\}/);
 assert.match(css,/#schedule \.schedule-actions button:last-child\{border-radius:0 20px 20px 0\}/);
 assert.match(css,/#schedule \.schedule-actions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:4px\}/);
 assert.match(app,/name="cancelledBy"/);
 assert.match(app,/Me \/ teacher \(\+1 make-up lesson\)/);
 assert.match(app,/name="makeupBalance" type="number"/);
 assert.match(app,/MAKE-UP LESSONS OWED:/);
 assert.match(app,/MAKE-UP OWED:/);
 assert.match(app,/balanceEdited\?item\.makeupBalance:\(st\.students\[i\]\.makeupBalance\?\?0\)/);
});
