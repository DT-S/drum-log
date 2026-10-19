import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup,migrateState} from '../core.js';
import {saveAppointment,removeAppointment,bookFreeSlot,cancelLesson,restoreLesson,dayEvents} from '../schedule.js';

const date='2026-10-19';
const person=(id,balance=0)=>({id,name:id,day:1,time:id==='A'?'12:15':'14:00',duration:45,remarks:'',archived:false,schedule:'weekly',makeupBalance:balance});
const appointment=(id='m1',studentId='A',label='Make-up lesson',time='15:00')=>({id,studentId,date,time,duration:45,label});
const key=(studentId='A',time='15:00')=>({studentId,date,time});

test('choosing Make-up lesson spends exactly one credit at scheduling, not at attendance',()=>{
 const s=defaults();s.students=[person('A',2)];
 saveAppointment(s,appointment());
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.appointments[0].redeemedCredit,true);
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
 saveAppointment(s,appointment('m1','A','Make-up lesson','16:00'));
 assert.equal(s.students[0].makeupBalance,1); // Moving it cannot charge again.
 assert.equal(s.appointments[0].time,'16:00');
});

test('teacher cancellation refunds booked make-up, student cancellation forfeits it',()=>{
 const teacher=defaults();teacher.students=[person('A',1)];
 saveAppointment(teacher,appointment());
 assert.equal(teacher.students[0].makeupBalance,0);
 cancelLesson(teacher,key(),'other','teacher');
 assert.equal(teacher.students[0].makeupBalance,1);
 assert.equal(dayEvents(teacher,date).find(e=>e.appointmentId==='m1').cancelled,true);
 assert.throws(()=>cancelLesson(teacher,key(),'other','teacher'),/already cancelled/);
 assert.equal(teacher.students[0].makeupBalance,1);
 restoreLesson(teacher,key());
 assert.equal(teacher.students[0].makeupBalance,0);
 assert.equal(dayEvents(teacher,date).find(e=>e.appointmentId==='m1').cancelled,false);
 const student=defaults();student.students=[person('A',1)];
 saveAppointment(student,appointment());
 cancelLesson(student,key(),'sick','student');
 assert.equal(student.students[0].makeupBalance,0);
 restoreLesson(student,key());
 assert.equal(student.students[0].makeupBalance,0);
});

test('teacher cancelled make-up can be removed without awarding a second credit',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 cancelLesson(s,key(),'sick','teacher');
 assert.equal(s.students[0].makeupBalance,1);
 removeAppointment(s,'m1');
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.appointments.length,0);
 assert.equal(s.cancellations.length,0);
});

test('student-cancelled make-up forfeits credit even if cancelled booking is deleted',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 cancelLesson(s,key(),'sick','student');
 removeAppointment(s,'m1');
 assert.equal(s.students[0].makeupBalance,0);
 assert.equal(s.appointments.length,0);
 assert.equal(s.cancellations.length,0);
});

test('removing still-active booked make-up returns exactly one credit',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 removeAppointment(s,'m1');
 assert.equal(s.students[0].makeupBalance,1);
 assert.deepEqual(s.appointments,[]);
 assert.throws(()=>removeAppointment(s,'m1'),/no longer exists/);
});

test('renaming a live booking to Extra refunds credit; converting Extra to Make-up spends it',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 assert.equal(s.students[0].makeupBalance,0);
 saveAppointment(s,appointment('m1','A','Extra lesson'));
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.appointments[0].redeemedCredit,undefined);
 saveAppointment(s,appointment());
 assert.equal(s.students[0].makeupBalance,0);
 saveAppointment(s,appointment());
 assert.equal(s.students[0].makeupBalance,0);
});

test('rescheduling make-up to a different student returns old credit and requires new student credit',()=>{
 const s=defaults();s.students=[person('A',1),person('B',1)];
 saveAppointment(s,appointment());
 saveAppointment(s,appointment('m1','B','Make-up lesson'));
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.students[1].makeupBalance,0);
 s.students.push(person('C',0));
 const before=JSON.stringify(s);
 assert.throws(()=>saveAppointment(s,appointment('m1','C','Make-up lesson')),/No outstanding make-up/);
 assert.equal(JSON.stringify(s),before);
});

test('booking a credit at zero is rejected before touching any state',()=>{
 const s=defaults();s.students=[person('A',0)];
 const before=JSON.stringify(s);
 assert.throws(()=>saveAppointment(s,appointment()),/No outstanding make-up lesson/);
 assert.equal(JSON.stringify(s),before);
 saveAppointment(s,appointment('extra','A','Extra lesson'));
 assert.equal(s.appointments.length,1);
 assert.equal(s.students[0].makeupBalance,0);
});

test('free-slot booking supports make-up vs extra type, with automatic spend',()=>{
 const s=defaults();s.students=[person('A',2)];s.settings.teachingHours[1]={start:'14:00',end:'18:00'};
 bookFreeSlot(s,'A',date,'16:00',45);
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.appointments[0].label,'Make-up lesson');
 assert.equal(s.appointments[0].redeemedCredit,true);
 bookFreeSlot(s,'A',date,'17:00',45,'Extra lesson');
 assert.equal(s.students[0].makeupBalance,1);
 assert.equal(s.appointments[1].redeemedCredit,undefined);
});

test('pre-existing schema-7 make-up entries do not retroactively debit credits',()=>{
 const old=defaults();old.schemaVersion=7;old.students=[person('A',2)];
 old.appointments=[appointment('legacy')];
 const imported=validateBackup(JSON.parse(JSON.stringify(old)));
 assert.equal(imported.schemaVersion,10);
 assert.equal(imported.appointments[0].redeemedCredit,undefined);
 assert.equal(imported.students[0].makeupBalance,2);
 const migrated=migrateState(JSON.parse(JSON.stringify(old)));
 assert.equal(migrated.schemaVersion,10);
 saveAppointment(migrated,appointment('legacy'));
 assert.equal(migrated.students[0].makeupBalance,2);
 removeAppointment(migrated,'legacy');
 assert.equal(migrated.students[0].makeupBalance,2);
});

test('editing cancelled appointment cannot modify a booked credit until restored',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 cancelLesson(s,key(),'cancelled','teacher');
 const before=JSON.stringify(s);
 assert.throws(()=>saveAppointment(s,appointment('m1','A','Extra lesson')),/Restore this cancelled/);
 assert.equal(JSON.stringify(s),before);
});

test('appointment credit marker validates and roundtrips in schema 8',()=>{
 const s=defaults();s.students=[person('A',1)];
 saveAppointment(s,appointment());
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
 for(const bad of [
  {...s.appointments[0],redeemedCredit:'yes'},
  {...s.appointments[0],label:'Extra lesson',redeemedCredit:true}
 ])assert.throws(()=>validateBackup({...s,appointments:[bad]}),/Invalid backup: appointment record/);
 assert.throws(()=>validateBackup({...s,schemaVersion:11}),/unsupported schema/);
});

test('standard booking type selector and automatic balance explanatory text are displayed',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(src,/name="appointmentType"/);
 assert.match(src,/value="makeup"/);
 assert.match(src,/name="label" id="freeLessonType"/);
 assert.match(src,/saveAppointment\(st,item\)/);
 assert.match(src,/removeAppointment\(st,a\.id\)/);
 assert.match(src,/Booking a make-up lesson immediately uses 1 credit/);
});
