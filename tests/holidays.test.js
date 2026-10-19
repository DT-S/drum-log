import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,selectScheduled,isHolidayDate,validateBackup,migrateState,lessonKey} from '../core.js';
import {dayEvents,availableSlots,scheduleWeek,holidaysOnDate,hasCollision,bookFreeSlot,cancelLesson,restoreLesson} from '../schedule.js';

const makeStudent=(id='A',day=3,time='12:15',schedule='weekly',anchorDate)=>({
 id,name:id,day,time,duration:45,remarks:'',archived:false,schedule,
 ...(anchorDate?{anchorDate}:{})
});
const addHoliday=(data,id='h1',startDate='2026-10-21',endDate='2026-11-10',label='Autumn holidays')=>
 data.holidays.push({id,startDate,endDate,label});
const at=(date,time='12:20')=>new Date(date+'T'+time+':00');

test('rolling seven day view starts on selected Wednesday, crosses month and year',()=>{
 const s=defaults();
 let days=scheduleWeek(s,'2026-10-21');
 assert.equal(days.length,7);
 assert.deepEqual(days.map(x=>x.date),[
  '2026-10-21','2026-10-22','2026-10-23','2026-10-24',
  '2026-10-25','2026-10-26','2026-10-27'
 ]);
 assert.equal(days[0].weekday,'Wednesday');
 days=scheduleWeek(s,'2026-12-30');
 assert.equal(days[0].date,'2026-12-30');
 assert.equal(days.at(-1).date,'2027-01-05');
 assert.equal(scheduleWeek(s,'2026-10-28')[0].weekday,'Wednesday');
});

test('holiday start and end dates are inclusive; other dates are unaffected',()=>{
 const s=defaults();s.students.push(makeStudent());
 addHoliday(s);
 assert.equal(isHolidayDate(s.holidays,'2026-10-20'),false);
 assert.equal(isHolidayDate(s.holidays,'2026-10-21'),true);
 assert.equal(isHolidayDate(s.holidays,'2026-11-10'),true);
 assert.equal(isHolidayDate(s.holidays,'2026-11-11'),false);
 assert.equal(dayEvents(s,'2026-10-21').length,0);
 assert.equal(dayEvents(s,'2026-11-11').length,1);
 assert.equal(holidaysOnDate(s,'2026-10-21')[0].label,'Autumn holidays');
});

test('long breaks do not cause automatic next regular lesson to disappear',()=>{
 const s=defaults();s.students.push(makeStudent());
 addHoliday(s,'h1','2026-10-21','2026-11-18');
 const next=selectScheduled(s.students,at('2026-10-21','11:00'),s.appointments,s.trials,s.cancellations,s.holidays);
 assert.equal(next.kind,'next');
 assert.equal(next.selected.student.id,'A');
 assert.equal(next.selected.start.getFullYear(),2026);
 assert.equal(next.selected.start.getMonth(),10);
 assert.equal(next.selected.start.getDate(),25); // Wed Nov 25 is first regular lesson after end Nov 18
});

test('holidays suppress regular weekly and biweekly lessons but preserve manual extras and trials',()=>{
 const s=defaults();
 s.students.push(makeStudent('A'),makeStudent('B',3,'13:00','biweekly','2026-10-21'));
 addHoliday(s,'h1','2026-10-21','2026-11-05');
 s.appointments.push({id:'extra1',studentId:'A',date:'2026-10-21',time:'12:15',duration:45,label:'Make-up lesson'});
 s.trials.push({id:'try1',name:'Guest',date:'2026-10-21',time:'14:00',duration:45,contact:'',remarks:'',notes:'',archived:false});
 const now=at('2026-10-21','12:20');
 const events=dayEvents(s,'2026-10-21');
 assert.equal(events.length,2);
 assert.equal(events.find(e=>e.kind==='regular'),undefined);
 assert.ok(events.some(e=>e.appointmentId==='extra1'));
 assert.ok(events.some(e=>e.trialId==='try1'));
 const selected=selectScheduled(s.students,now,s.appointments,s.trials,s.cancellations,s.holidays);
 assert.equal(selected.selected.appointment.id,'extra1');
 assert.equal(dayEvents(s,'2026-11-11').some(e=>e.kind==='regular'),true);
});

test('holiday does not erase old notes or existing cancellations; removing it restores regular projection',()=>{
 const s=defaults();s.students.push(makeStudent());
 s.lessons.push({id:lessonKey('A','2026-10-21','12:15'),studentId:'A',date:'2026-10-21',time:'12:15',duration:45,notes:'Original lesson record'});
 cancelLesson(s,{studentId:'A',date:'2026-10-21',time:'12:15'},'sick');
 const notes=JSON.stringify(s.lessons),cancels=JSON.stringify(s.cancellations);
 addHoliday(s);
 assert.equal(dayEvents(s,'2026-10-21').length,0);
 assert.equal(JSON.stringify(s.lessons),notes);
 assert.equal(JSON.stringify(s.cancellations),cancels);
 s.holidays=[];
 assert.equal(dayEvents(s,'2026-10-21')[0].cancelled,true);
 assert.equal(s.lessons[0].notes,'Original lesson record');
});

test('closures do not advertise working hours as automatically free, but allow direct extra bookings',()=>{
 const s=defaults();s.students.push(makeStudent());
 s.settings.teachingHours[3]={start:'09:00',end:'18:00'};
 addHoliday(s);
 assert.deepEqual(availableSlots(s,'2026-10-21'),[]);
 // A manual make-up is explicitly booked even though no free slots are advertised.
 s.appointments.push({id:'book1',studentId:'A',date:'2026-10-21',time:'14:15',duration:45,label:'Make-up lesson'});
 const events=dayEvents(s,'2026-10-21');
 assert.equal(events.length,1);
 assert.equal(events[0].time,'14:15');
 assert.equal(hasCollision(s,'2026-10-21','14:30',15).appointmentId,'book1');
 assert.throws(()=>bookFreeSlot(s,'A','2026-10-21','15:00',45),/not available/);
});

test('existing cancellation at a holiday date must not cancel a separately booked replacement',()=>{
 const s=defaults();s.students.push(makeStudent());
 cancelLesson(s,{studentId:'A',date:'2026-10-21',time:'12:15'},'sick');
 addHoliday(s);
 s.appointments.push({id:'manual',studentId:'A',date:'2026-10-21',time:'12:15',duration:45,label:'Manual make-up'});
 assert.equal(dayEvents(s,'2026-10-21')[0].cancelled,false);
 const m=selectScheduled(s.students,at('2026-10-21'),s.appointments,s.trials,s.cancellations,s.holidays);
 assert.equal(m.selected?.appointment?.id,'manual');
});

test('holidays survive JSON roundtrip; schema-5 backups upgrade without any data loss',()=>{
 const s=defaults();s.students.push(makeStudent());
 addHoliday(s);addHoliday(s,'h2','2026-12-24','2027-01-06','Winter break');
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
 const legacy=JSON.parse(JSON.stringify(s));
 legacy.schemaVersion=5;delete legacy.holidays;
 const migrated=validateBackup(legacy);
 assert.equal(migrated.schemaVersion,6);
 assert.deepEqual(migrated.holidays,[]);
 assert.deepEqual(migrated.students,s.students);
 assert.deepEqual(migrated.appointments,s.appointments);
 assert.deepEqual(migrated.lessons,s.lessons);
 const db=migrateState(JSON.parse(JSON.stringify(legacy)));
 assert.equal(db.schemaVersion,6);
 assert.deepEqual(db.holidays,[]);
});

test('multiple closures and biweekly boundaries remain consistent, including DST',()=>{
 const s=defaults();s.students.push(makeStudent('A',3,'12:15','biweekly','2026-10-21'));
 addHoliday(s,'autumn','2026-10-21','2026-10-31');
 addHoliday(s,'autumn2','2026-11-01','2026-11-05');
 assert.deepEqual(dayEvents(s,'2026-10-21'),[]);
 assert.deepEqual(dayEvents(s,'2026-11-04'),[]);
 assert.equal(dayEvents(s,'2026-11-18').length,1);
 assert.equal(scheduleWeek(s,'2026-10-28')[0].date,'2026-10-28');
});

test('invalid holiday ranges, duplicate ids, missing collection and future schema are rejected',()=>{
 const s=defaults();
 addHoliday(s);
 for(const broken of [
  [{id:'bad',startDate:'2026-11-01',endDate:'2026-10-01',label:'Backwards'}],
  [{id:'bad',startDate:'2026-02-30',endDate:'2026-03-03',label:'Impossible'}],
  [{id:'bad',startDate:'2026-10-21',endDate:'2026-10-21',label:4}],
  [s.holidays[0],s.holidays[0]],
 ])assert.throws(()=>validateBackup({...s,holidays:broken}),/Invalid backup/);
 const missing={...s};delete missing.holidays;
 assert.throws(()=>validateBackup(missing),/Invalid backup/);
 assert.throws(()=>validateBackup({...s,schemaVersion:7}),/Invalid backup/);
});

test('explicit holiday appointment can itself be cancelled and restored',()=>{
 const s=defaults();s.students.push(makeStudent());
 addHoliday(s);
 s.appointments.push({id:'book1',studentId:'A',date:'2026-10-21',time:'12:15',duration:45,label:'Make-up lesson'});
 const key={studentId:'A',date:'2026-10-21',time:'12:15'};
 cancelLesson(s,key,'sick');
 assert.equal(dayEvents(s,'2026-10-21')[0].cancelled,true);
 assert.equal(s.cancellations[0].appointmentId,'book1');
 // No appointment is selected while cancelled; next regular is after the holiday.
 assert.equal(selectScheduled(s.students,at('2026-10-21'),s.appointments,s.trials,s.cancellations,s.holidays).selected?.appointment,undefined);
 assert.deepEqual(validateBackup(s),s);
 restoreLesson(s,key);
 assert.equal(dayEvents(s,'2026-10-21')[0].cancelled,false);
 assert.equal(s.cancellations.length,0);
});
test('old regular cancellation and new manual holiday cancellation use independent identities',()=>{
 const s=defaults();s.students.push(makeStudent());
 const key={studentId:'A',date:'2026-10-21',time:'12:15'};
 cancelLesson(s,key,'sick'); // Recurring occurrence.
 addHoliday(s);
 s.appointments.push({id:'new-booking',studentId:'A',date:key.date,time:key.time,duration:45,label:'Make-up'});
 assert.equal(dayEvents(s,key.date)[0].cancelled,false);
 cancelLesson(s,key,'cancelled'); // The manual appointment.
 assert.equal(s.cancellations.length,2);
 assert.equal(dayEvents(s,key.date)[0].cancelled,true);
 assert.deepEqual(validateBackup(s),s);
 restoreLesson(s,key);
 assert.equal(dayEvents(s,key.date)[0].cancelled,false);
 assert.equal(s.cancellations.length,1);
 s.holidays=[];
 assert.equal(dayEvents(s,key.date)[0].cancelled,true); // Original regular cancellation persists.
});
