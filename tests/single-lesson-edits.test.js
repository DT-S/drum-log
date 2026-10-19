import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,lessonKey,selectScheduled,validateBackup,migrateState} from '../core.js';
import {dayEvents,scheduleWeek,availableSlots,hasCollision,cancelLesson,restoreLesson,saveLessonOverride,resetLessonOverride} from '../schedule.js';

const monday='2026-10-19';
const key=(id='A',date=monday,time='15:00')=>({studentId:id,date,time});
const student=(id='A',time='15:00',duration=45)=>({id,name:id,day:1,time,duration,remarks:'',archived:false,schedule:'weekly',makeupBalance:3});
const clone=s=>JSON.parse(JSON.stringify(s));

test('one weekly 45-minute lesson becomes 90 minutes, following weeks stay 45 minutes',()=>{
 const s=defaults();s.students=[student()];
 const before=clone(s.students),credits=s.students[0].makeupBalance;
 saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:90});
 const original=dayEvents(s,monday);
 assert.equal(original.length,1);
 assert.equal(original[0].duration,90);
 assert.equal(original[0].isOverride,true);
 assert.equal(dayEvents(s,'2026-10-26')[0].duration,45);
 assert.deepEqual(s.students,before);
 assert.equal(s.students[0].makeupBalance,credits);
 assert.deepEqual(s.cancellations,[]);
 assert.deepEqual(validateBackup(clone(s)),s);
});

test('date and time move hides original occurrence and shows single moved occurrence; later weeks untouched',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 assert.equal(dayEvents(s,monday).length,0);
 const moved=dayEvents(s,'2026-10-20');
 assert.equal(moved.length,1);
 assert.equal(moved[0].time,'18:30');
 assert.equal(moved[0].duration,90);
 assert.equal(moved[0].originalDate,monday);
 assert.equal(moved[0].originalTime,'15:00');
 assert.equal(dayEvents(s,'2026-10-26')[0].duration,45);
 assert.equal(scheduleWeek(s,monday)[1].events[0].name,'A');
 assert.equal(s.cancellations.length,0);
});

test('automatic journal selection recognizes moved lesson and suppresses regular origin',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 const data=selectScheduled(s.students,new Date('2026-10-20T18:45:00'),s.appointments,s.trials,s.cancellations,s.holidays,s.lessonOverrides);
 assert.equal(data.kind,'current');
 assert.equal(data.selected.override.time,'18:30');
 assert.equal(data.selected.override.duration,90);
 assert.equal(data.selected.start.getDate(),20);
 const after=selectScheduled(s.students,new Date('2026-10-19T14:00:00'),s.appointments,s.trials,s.cancellations,s.holidays,s.lessonOverrides);
 assert.equal(after.selected.start.getDate(),20);
});

test('lengthening into an occupied next booking is rejected without modifying state',()=>{
 const s=defaults();s.students=[student('A'),student('B','16:00')];
 const before=JSON.stringify(s);
 assert.throws(()=>saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:90}),/Schedule conflict/);
 assert.equal(JSON.stringify(s),before);
 assert.equal(dayEvents(s,monday)[0].duration,45);
});

test('moving into next recurring session or another-day event is rejected',()=>{
 const s=defaults();s.students=[student()];
 const before=JSON.stringify(s);
 assert.throws(()=>saveLessonOverride(s,key(),{date:'2026-10-26',time:'15:00',duration:45}),/Schedule conflict/);
 assert.equal(JSON.stringify(s),before);
 s.calendarEvents.push({id:'recording',title:'Recording',date:'2026-10-20',time:'19:00',duration:90,type:'recording',people:'',notes:''});
 const before2=JSON.stringify(s);
 assert.throws(()=>saveLessonOverride(s,key(),{date:'2026-10-20',time:'19:15',duration:45}),/Schedule conflict/);
 assert.equal(JSON.stringify(s),before2);
});

test('repeated edits replace same original occurrence, never produce duplicate events or debit credits',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:90});
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 saveLessonOverride(s,key(),{date:'2026-10-22',time:'10:00',duration:60});
 assert.equal(s.lessonOverrides.length,1);
 assert.equal(dayEvents(s,monday).length,0);
 assert.equal(dayEvents(s,'2026-10-20').length,0);
 assert.equal(dayEvents(s,'2026-10-22').length,1);
 assert.equal(s.students[0].makeupBalance,3);
 assert.deepEqual(s.cancellations,[]);
});

test('reset removes exception and restores regular slot without changing journal records or credits',()=>{
 const s=defaults();s.students=[student()];
 const note={id:lessonKey('A',monday,'15:00'),studentId:'A',date:monday,time:'15:00',duration:45,notes:'Keep original lesson notes'};
 s.lessons.push(note);
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 resetLessonOverride(s,key());
 assert.deepEqual(s.lessonOverrides,[]);
 assert.equal(dayEvents(s,monday)[0].time,'15:00');
 assert.equal(dayEvents(s,monday)[0].duration,45);
 assert.equal(dayEvents(s,'2026-10-20').length,0);
 assert.deepEqual(s.lessons,[note]);
 assert.equal(s.students[0].makeupBalance,3);
 assert.deepEqual(validateBackup(clone(s)),s);
});

test('reset is rejected when original schedule time has become occupied',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 s.calendarEvents.push({id:'rec',title:'Band',date:monday,time:'15:00',duration:45,type:'recording',people:'',notes:''});
 const before=JSON.stringify(s);
 assert.throws(()=>resetLessonOverride(s,key()),/Cannot reset/);
 assert.equal(JSON.stringify(s),before);
});

test('adjusted lessons may be cancelled and restored without duplicate events',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 const moved=key('A','2026-10-20','18:30');
 cancelLesson(s,moved,'other','student');
 assert.equal(dayEvents(s,moved.date)[0].cancelled,true);
 assert.equal(s.students[0].makeupBalance,3);
 assert.throws(()=>saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:45}),/Restore the cancelled/);
 assert.throws(()=>resetLessonOverride(s,key()),/Restore the cancelled/);
 restoreLesson(s,moved);
 assert.equal(dayEvents(s,moved.date)[0].cancelled,false);
 resetLessonOverride(s,key());
 assert.equal(dayEvents(s,monday)[0].cancelled,false);
});

test('shifted lesson can also be cancelled by teacher and credited once',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:30',duration:90});
 const moved=key('A','2026-10-20','18:30');
 cancelLesson(s,moved,'cancelled','teacher');
 assert.equal(s.students[0].makeupBalance,4);
 restoreLesson(s,moved);
 assert.equal(s.students[0].makeupBalance,3);
 assert.deepEqual(s.cancellations,[]);
});

test('adjusted lesson occupies free-time slots and crosses into next day',()=>{
 const s=defaults();s.students=[student()];
 s.settings.teachingHours[1]={start:'15:00',end:'18:00'};
 saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:90});
 assert.deepEqual(availableSlots(s,monday),[{start:'16:30',end:'18:00',minutes:90}]);
 resetLessonOverride(s,key());
 saveLessonOverride(s,key(),{date:monday,time:'23:30',duration:90});
 assert.ok(hasCollision(s,'2026-10-20','00:15',30)?.isOverride);
});

test('a holiday does not delete a previously created explicit one-off adjustment',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:'2026-10-20',time:'18:00',duration:90});
 s.holidays.push({id:'break',startDate:'2026-10-19',endDate:'2026-10-27',label:'Holiday'});
 assert.equal(dayEvents(s,'2026-10-20')[0].isOverride,true);
 assert.equal(dayEvents(s,'2026-10-26').length,0);
 assert.equal(s.students[0].makeupBalance,3);
});

test('schema 9 migration and backups retain old notes, appointments, trials, holidays, events',()=>{
 const old=defaults();old.schemaVersion=9;delete old.lessonOverrides;
 old.students=[student()];
 old.lessons=[{id:lessonKey('A',monday,'15:00'),studentId:'A',date:monday,time:'15:00',duration:45,notes:'Untouched'}];
 const before=JSON.stringify(old.lessons);
 const migrated=migrateState(clone(old));
 assert.equal(migrated.schemaVersion,10);
 assert.deepEqual(migrated.lessonOverrides,[]);
 assert.equal(JSON.stringify(migrated.lessons),before);
 assert.deepEqual(validateBackup(clone(old)).lessonOverrides,[]);
 assert.deepEqual(validateBackup(clone(migrated)),migrated);
});

test('reject invalid override records and duplicate origins in backup',()=>{
 const s=defaults();s.students=[student()];
 saveLessonOverride(s,key(),{date:monday,time:'15:00',duration:90});
 for(const bad of [
  {...s.lessonOverrides[0],originalDate:'bad'},
  {...s.lessonOverrides[0],duration:0},
  {...s.lessonOverrides[0],duration:9000},
  {...s.lessonOverrides[0],time:'25:00'},
  {...s.lessonOverrides[0],studentId:'missing'}
 ])assert.throws(()=>validateBackup({...s,lessonOverrides:[bad]}),/Invalid backup: lesson override/);
 assert.throws(()=>validateBackup({...s,lessonOverrides:[s.lessonOverrides[0],s.lessonOverrides[0]]}),/duplicate lesson override/);
 assert.throws(()=>validateBackup({...s,schemaVersion:11}),/unsupported schema/);
});

test('UI one-off editor and journal origin linkage are present and not a cancel-book flow',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(src,/function editSingleLesson\(event\)/);
 assert.match(src,/Save this lesson only/);
 assert.match(src,/Reset to regular schedule/);
 assert.match(src,/data-plan-task="edit"/);
 assert.match(src,/selectedOverride/);
 assert.match(src,/noteKey/);
 assert.match(src,/saveLessonOverride\(s,origin/);
 assert.match(src,/resetLessonOverride\(s,origin/);
 assert.doesNotMatch(src.slice(src.indexOf('function editSingleLesson('),src.indexOf('function editCalendarEvent(')),/cancelLesson\(/);
});
