import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaults,validateBackup,migrateState,selectScheduled,lessonKey} from '../core.js';
import {dayEvents,scheduleWeek,availableSlots,hasCollision,cancelLesson,saveCalendarEvent,removeCalendarEvent,saveAppointment} from '../schedule.js';

const day='2026-10-21';
const p=(id='s1',name='Lena',time='16:00')=>({id,name,day:3,time,duration:45,schedule:'weekly',remarks:'Student notes',archived:false,makeupBalance:3});
const ev=(id='e1',date=day,time='13:00',title='Recording with Lena',type='recording')=>({
 id,title,date,time,duration:90,type,people:'Lena, Max',notes:'Mic check; bring an amp'
});
const json=x=>JSON.parse(JSON.stringify(x));

test('recording, jam and other events work with zero student profiles or trial lessons',()=>{
 const s=defaults();
 saveCalendarEvent(s,ev('one',day,'12:00','Band recording','recording'));
 saveCalendarEvent(s,ev('two','2026-10-22','17:00','Jam','jam'));
 saveCalendarEvent(s,ev('three','2026-10-23','19:00','Private visit','other'));
 assert.equal(s.students.length,0);
 assert.equal(s.trials.length,0);
 assert.equal(s.lessons.length,0);
 assert.equal(s.cancellations.length,0);
 assert.equal(dayEvents(s,day)[0].kind,'calendar');
 assert.equal(dayEvents(s,'2026-10-22')[0].label,'Jam session');
 assert.equal(dayEvents(s,'2026-10-23')[0].label,'Other event');
 assert.deepEqual(validateBackup(json(s)),s);
});

test('repeated guest names and repeated recording titles are separate appointments by ID',()=>{
 const s=defaults();
 saveCalendarEvent(s,ev('e1','2026-10-21','13:00','Recording with Jonas'));
 saveCalendarEvent(s,ev('e2','2026-10-23','13:00','Recording with Jonas'));
 saveCalendarEvent(s,ev('e3','2026-10-25','13:00','Recording with Jonas'));
 assert.equal(s.calendarEvents.length,3);
 assert.deepEqual(s.calendarEvents.map(x=>x.id),['e1','e2','e3']);
 removeCalendarEvent(s,'e2');
 assert.deepEqual(s.calendarEvents.map(x=>x.id),['e1','e3']);
 assert.deepEqual(s.students,[]);
 assert.deepEqual(s.trials,[]);
});

test('standalone events do not become trials, follow-schedule students or makeup credits',()=>{
 const s=defaults();s.students=[p()];
 const before=json(s.students),notes=json(s.lessons),trials=json(s.trials);
 saveCalendarEvent(s,ev('recording',day,'13:00','Visit from Lena'));
 const active=dayEvents(s,day);
 assert.deepEqual(active.map(e=>e.kind),['calendar','regular']);
 assert.equal(active[0].studentId,null);
 assert.equal(active[0].calendarEventId,'recording');
 assert.equal(active[0].people,'Lena, Max');
 assert.deepEqual(s.students,before);
 assert.deepEqual(s.lessons,notes);
 assert.deepEqual(s.trials,trials);
 assert.equal(s.students[0].makeupBalance,3);
 const next=selectScheduled(s.students,new Date('2026-10-21T12:00:00'),s.appointments,s.trials,s.cancellations,s.holidays);
 assert.equal(next.selected.student.id,'s1');
});

test('free-time calculations include independent events including an overnight event from yesterday',()=>{
 const s=defaults();s.settings.teachingHours[3]={start:'12:00',end:'18:00'};
 saveCalendarEvent(s,ev('recording',day,'13:00','Session'));
 assert.deepEqual(availableSlots(s,day),[
  {start:'12:00',end:'13:00',minutes:60},{start:'14:30',end:'18:00',minutes:210}
 ]);
 const s2=defaults();s2.settings.teachingHours[3]={start:'00:00',end:'02:00'};
 saveCalendarEvent(s2,{...ev('overnight','2026-10-20','23:30','Late recording'),duration:120});
 assert.deepEqual(availableSlots(s2,day),[{start:'01:30',end:'02:00',minutes:30}]);
});

test('conflicting external event is rejected without deleting existing appointments',()=>{
 const s=defaults();s.students=[p()];
 const before=JSON.stringify(s);
 assert.throws(()=>saveCalendarEvent(s,ev('conflict',day,'16:15','Too close')),/Schedule conflict/);
 assert.equal(JSON.stringify(s),before);
 saveCalendarEvent(s,ev('safe',day,'18:00','Late jam'));
 const after=JSON.stringify(s);
 assert.throws(()=>saveCalendarEvent(s,ev('bad',day,'18:10','Double booked')),/Schedule conflict/);
 assert.equal(JSON.stringify(s),after);
});

test('edited calendar event keeps its ID and history, rejects collision and can be deleted',()=>{
 const s=defaults();
 saveCalendarEvent(s,ev('same',day,'13:00','One','jam'));
 saveCalendarEvent(s,ev('other',day,'16:00','Two','recording'));
 saveCalendarEvent(s,ev('same',day,'11:00','One revised','other'));
 assert.equal(s.calendarEvents.length,2);
 assert.equal(s.calendarEvents.find(e=>e.id==='same').title,'One revised');
 const before=JSON.stringify(s);
 assert.throws(()=>saveCalendarEvent(s,ev('same',day,'16:20','Clash')),/Schedule conflict/);
 assert.equal(JSON.stringify(s),before);
 removeCalendarEvent(s,'same');
 assert.equal(s.calendarEvents.length,1);
 assert.throws(()=>removeCalendarEvent(s,'same'),/no longer exists/);
});

test('calendar events remain visible during holidays without cancelling or crediting lessons',()=>{
 const s=defaults();s.students=[p()];
 s.holidays=[{id:'break',startDate:'2026-10-19',endDate:'2026-10-31',label:'Holiday'}];
 saveCalendarEvent(s,ev('recording',day,'16:00','Holiday recording'));
 assert.deepEqual(dayEvents(s,day).map(e=>e.kind),['calendar']);
 assert.equal(s.students[0].makeupBalance,3);
 assert.deepEqual(availableSlots(s,day),[]);
 assert.equal(scheduleWeek(s,day)[0].events[0].kind,'calendar');
});

test('trial and an independent event with the same display name do not convert or overwrite one another',()=>{
 const s=defaults();s.trials=[{id:'trial-a',name:'Max',date:day,time:'11:00',duration:45,contact:'',remarks:'',notes:'',archived:false}];
 saveCalendarEvent(s,ev('event-a',day,'13:00','Max'));
 assert.equal(dayEvents(s,day).length,2);
 assert.equal(dayEvents(s,day)[0].kind,'trial');
 assert.equal(dayEvents(s,day)[1].kind,'calendar');
 assert.equal(s.trials[0].id,'trial-a');
 assert.equal(s.calendarEvents[0].id,'event-a');
 assert.equal(s.students.length,0);
});

test('schema-8 backups import with empty independent event list and unchanged existing records',()=>{
 const s=defaults();s.students=[p()];
 s.lessons=[{id:lessonKey('s1',day,'16:00'),studentId:'s1',date:day,time:'16:00',duration:45,notes:'Important old note'}];
 s.schemaVersion=8;delete s.calendarEvents;
 const old=json(s);
 const imported=validateBackup(old);
 assert.equal(imported.schemaVersion,9);
 assert.deepEqual(imported.calendarEvents,[]);
 assert.deepEqual(imported.students,old.students);
 assert.deepEqual(imported.lessons,old.lessons);
 const migrated=migrateState(json(s));
 assert.equal(migrated.schemaVersion,9);
 assert.deepEqual(migrated.calendarEvents,[]);
 assert.deepEqual(migrated.lessons,old.lessons);
});

test('invalid and malformed independent calendar events reject whole backup',()=>{
 const s=defaults();s.calendarEvents=[ev()];
 const invalid=[
  [{...ev(),id:''}],
  [ev(),ev()],
  [{...ev(),date:'2026-02-30'}],
  [{...ev(),time:'24:40'}],
  [{...ev(),duration:0}],
  [{...ev(),type:'trial'}],
  [{...ev(),title:'    '}],
  [{...ev(),people:null}],
  [{...ev(),notes:1}],
 ];
 for(const collection of invalid)assert.throws(()=>validateBackup({...s,calendarEvents:collection}),/Invalid backup: calendar event/);
 const noEvents=json(s);delete noEvents.calendarEvents;
 assert.throws(()=>validateBackup(noEvents),/Invalid backup: calendar events collection/);
 assert.throws(()=>validateBackup({...s,schemaVersion:10}),/unsupported schema/);
});

test('UI offers a studentless event editor without adding another Schedule header button',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../schedule.css',import.meta.url),'utf8');
 assert.match(app,/function editCalendarEvent\(existing=null,presetDate=null\)/);
 assert.match(app,/switchToCalendarEvent/);
 assert.match(app,/calendar-events-register/);
 assert.match(app,/data-calendar-event-edit/);
 assert.match(app,/name="people"/);
 assert.match(app,/name="notes"/);
 assert.match(css,/\.slot-calendar/);
 assert.match(css,/--event-cyan/);
 const start=app.indexOf('class="schedule-actions"');
 assert.ok(start>0);
 const header=app.slice(start,start+380);
 assert.doesNotMatch(header,/addCalendarEvent/);
});

test('new student appointments cannot silently overlap a recording or jam event',()=>{
 const s=defaults();s.students=[p()];
 saveCalendarEvent(s,ev('recording',day,'13:00','Recording session'));
 const prev=JSON.stringify(s);
 assert.throws(()=>saveAppointment(s,{id:'a-new',studentId:'s1',date:day,time:'13:30',duration:45,label:'Extra lesson'}),/Schedule conflict/);
 assert.equal(JSON.stringify(s),prev);
 saveAppointment(s,{id:'a-new',studentId:'s1',date:day,time:'18:00',duration:45,label:'Extra lesson'});
 assert.equal(s.appointments.length,1);
 assert.equal(s.calendarEvents.length,1);
});
test('recording conflict cannot consume a make-up credit when booking fails',()=>{
 const s=defaults();s.students=[p()];
 saveCalendarEvent(s,ev('recording',day,'13:00','Recording session'));
 const prev=JSON.stringify(s);
 assert.throws(()=>saveAppointment(s,{id:'makeup',studentId:'s1',date:day,time:'13:30',duration:45,label:'Make-up lesson'}),/Schedule conflict/);
 assert.equal(JSON.stringify(s),prev);
 assert.equal(s.students[0].makeupBalance,3);
});
