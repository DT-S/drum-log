import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,selectScheduled,validateBackup,migrateState,lessonKey} from '../core.js';
import {dayEvents,scheduleWeek,availableSlots,cancelLesson,restoreLesson,bookReplacement,bookFreeSlot,hasCollision} from '../schedule.js';

const student=(id,day=1,time='12:15',duration=45,schedule='weekly',anchorDate=undefined)=>({id,name:id,day,time,duration,remarks:'',archived:false,schedule,...(anchorDate?{anchorDate}:{})});
const key=(id,date='2026-10-19',time='12:15')=>({studentId:id,date,time});
const monday='2026-10-19';

test('single-date cancellation preserves repeating schedule and lesson history',()=>{
 const s=defaults();s.students.push(student('A'));s.lessons.push({id:lessonKey('A',monday,'12:15'),studentId:'A',date:monday,time:'12:15',duration:45,notes:'Prior notes unchanged'});
 cancelLesson(s,key('A'),'sick');
 assert.equal(dayEvents(s,monday)[0].cancelled,true);
 assert.equal(dayEvents(s,'2026-10-26')[0].cancelled,false);
 assert.equal(s.lessons[0].notes,'Prior notes unchanged');
 assert.equal(selectScheduled(s.students,new Date('2026-10-19T12:30:00'),s.appointments,s.trials,s.cancellations).selected.start.getDate(),26);
 assert.equal(validateBackup(JSON.parse(JSON.stringify(s))).cancellations[0].reason,'sick');
 assert.throws(()=>cancelLesson(s,key('A'),'sick'),/already cancelled/);
 restoreLesson(s,key('A'));
 assert.equal(dayEvents(s,monday)[0].cancelled,false);
});

test('replace A with B creates one dated appointment and keeps A next week',()=>{
 const s=defaults();s.students.push(student('A'),student('B',2,'14:00'));
 const notes=JSON.stringify(s.lessons);
 bookReplacement(s,key('A'),'B','sick');
 assert.equal(s.cancellations.length,1);
 assert.equal(s.appointments.length,1);
 assert.equal(s.appointments[0].duration,45);
 assert.equal(s.appointments[0].label,'Replacement lesson');
 assert.equal(JSON.stringify(s.lessons),notes);
 const day=dayEvents(s,monday);
 assert.equal(day.find(e=>e.studentId==='A').cancelled,true);
 assert.equal(day.find(e=>e.studentId==='B').cancelled,false);
 assert.equal(dayEvents(s,'2026-10-26').find(e=>e.studentId==='A').cancelled,false);
 assert.deepEqual(validateBackup(s),s);
});

test('overlap rejects replacement without changing the original state',()=>{
 const s=defaults();s.students.push(student('A'),student('B',1,'12:45'));
 const before=JSON.stringify(s);
 assert.throws(()=>bookReplacement(s,key('A'),'B'),/Booking conflict/);
 assert.equal(JSON.stringify(s),before);
});
test('cannot restore an occupied cancellation',()=>{
 const s=defaults();s.students.push(student('A'),student('B',3,'12:15'));
 bookReplacement(s,key('A'),'B');
 assert.throws(()=>restoreLesson(s,key('A')),/Cannot restore/);
 assert.equal(s.cancellations.length,1);
});

test('free slots reflect working hours, cancelled lessons and one-off appointments',()=>{
 const s=defaults();s.students.push(student('A'));
 assert.deepEqual(availableSlots(s,monday),[]);
 cancelLesson(s,key('A'));
 assert.deepEqual(availableSlots(s,monday),[{start:'12:15',end:'13:00',minutes:45}]);
 s.settings.teachingHours[1]={start:'12:00',end:'14:00'};
 let free=availableSlots(s,monday);
 assert.deepEqual(free,[{start:'12:00',end:'14:00',minutes:120}]);
 bookFreeSlot(s,'A',monday,'13:00',30,'Extra lesson');
 free=availableSlots(s,monday);
 assert.deepEqual(free,[{start:'12:00',end:'13:00',minutes:60},{start:'13:30',end:'14:00',minutes:30}]);
 assert.throws(()=>bookFreeSlot(s,'A',monday,'13:15',45),/not available/);
});
test('without configured hours, cancellation is offered only for unoccupied time',()=>{
 const s=defaults();s.students.push(student('A'),student('B',3,'15:00'));
 cancelLesson(s,key('A'));
 bookReplacement(s,key('A'),'B');
 assert.deepEqual(availableSlots(s,monday),[]);
});
test('biweekly schedule is only projected in its own weeks',()=>{
 const s=defaults();s.students.push(student('A',1,'12:15',45,'biweekly',monday));
 assert.equal(dayEvents(s,monday).length,1);
 assert.equal(dayEvents(s,'2026-10-26').length,0);
 assert.equal(dayEvents(s,'2026-11-02').length,1);
 assert.equal(scheduleWeek(s,monday)[0].date,monday);
 assert.equal(scheduleWeek(s,'2026-10-21')[0].weekday,'Wednesday');
 assert.equal(scheduleWeek(s,'2026-10-21')[6].date,'2026-10-27');
});
test('trial booking is red-category regardless of other events',()=>{
 const s=defaults();
 s.trials.push({id:'trial1',name:'Guest',date:monday,time:'13:00',duration:45,contact:'',remarks:'',notes:'',archived:false});
 assert.equal(dayEvents(s,monday)[0].kind,'trial');
 s.students.push(student('A'));
 assert.equal(dayEvents(s,monday).find(e=>e.kind==='trial').name,'Guest');
});
test('cross-midnight events cannot be double-booked',()=>{
 const s=defaults();s.students.push(student('Late',0,'23:45',45),student('B',3,'12:15'));
 s.appointments.push({id:'late',studentId:'Late',date:'2026-10-18',time:'23:45',duration:45,label:'Extra'});
 assert.equal(hasCollision(s,monday,'00:15',15).studentId,'Late');
});
test('schema 4 migrates additively, including backups and teaching hours',()=>{
 const old=defaults();
 old.schemaVersion=4;delete old.cancellations;delete old.settings.teachingHours;
 old.students.push(student('A'));
 const migrated=migrateState(old);
 assert.equal(migrated.schemaVersion,8);
 assert.deepEqual(migrated.cancellations,[]);
 assert.equal(migrated.settings.teachingHours.length,7);
 assert.equal(validateBackup(JSON.parse(JSON.stringify(migrated))).schemaVersion,8);
 const file=JSON.parse(JSON.stringify(migrated));file.schemaVersion=4;delete file.cancellations;delete file.settings.teachingHours;
 assert.deepEqual(validateBackup(file),migrated);
});
test('bad cancellation and teaching-hour values are rejected',()=>{
 const s=defaults();s.students.push(student('A'));
 for(const c of [
  [{studentId:'missing',date:monday,time:'12:15',reason:'sick'}],
  [{studentId:'A',date:'2026-02-30',time:'12:15',reason:'sick'}],
  [{studentId:'A',date:monday,time:'12:15',reason:'unrecognized'}],
  [{studentId:'A',date:monday,time:'12:15',reason:'sick'},{studentId:'A',date:monday,time:'12:15',reason:'sick'}]
 ])assert.throws(()=>validateBackup({...s,cancellations:c}),/Invalid backup/);
 for(const bad of [[{start:'13:00',end:'12:00'},...Array(6).fill(null)],[{start:'bad',end:'13:00'},...Array(6).fill(null)],Array(6).fill(null)])
  assert.throws(()=>validateBackup({...s,settings:{...s.settings,teachingHours:bad}}),/Invalid backup: teaching hours/);
});
test('no legacy notes are removed when student changes schedule',()=>{
 const s=defaults();s.students.push(student('A'));
 s.lessons.push({id:lessonKey('A',monday,'12:15'),studentId:'A',date:monday,time:'12:15',duration:45,notes:'history'});
 cancelLesson(s,key('A'));
 s.students[0].time='14:00';
 assert.equal(s.lessons[0].notes,'history');
 assert.deepEqual(validateBackup(s).lessons,s.lessons);
});
