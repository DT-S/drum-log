// Local, deterministic schedule projection. Notes are never mutated by planning actions.
import {DAYS,localDate,minutes,lessonKey,isTeachingDay,isHolidayDate,validDate,validTime} from './core.js';

const minsToTime=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const addDay=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);};
const uid=(studentId,date,time)=>lessonKey(studentId,date,time);
export function holidaysOnDate(state,date){return (state.holidays||[]).filter(h=>h.startDate<=date&&date<=h.endDate);}

export function dayEvents(state,date){
 if(!validDate(date))throw Error('Invalid date.');
 const events=new Map(),students=state.students.filter(s=>!s.archived);
 const closed=isHolidayDate(state.holidays||[],date);
 for(const student of students){
  if(!closed&&isTeachingDay(student,date)){
   const event={key:uid(student.id,date,student.time),kind:'regular',studentId:student.id,
    name:student.name,date,time:student.time,duration:student.duration,label:'Regular lesson'};
   events.set(event.key,event);
  }
 }
 for(const a of state.appointments){
  if(a.date!==date)continue;
  const s=students.find(x=>x.id===a.studentId);if(!s)continue;
  const kind=a.label==='Trial lesson'?'trial-converted':'extra';
  const event={key:uid(s.id,date,a.time),kind,studentId:s.id,name:s.name,date,
   time:a.time,duration:a.duration,label:a.label||'Extra appointment',appointmentId:a.id};
  events.set(event.key,event); // Explicit appointment overrides an identical recurring slot.
 }
 for(const t of state.trials){
  if(t.archived||t.date!==date)continue;
  const event={key:'trial:'+t.id,kind:'trial',trialId:t.id,studentId:null,
   name:t.name,date,time:t.time,duration:t.duration,label:'Trial lesson'};
  events.set(event.key,event);
 }
 // These events are not lessons. Their ID is independent of names, student IDs,
 // trial conversions, and makeup-credit balances; duplicate participants are fine.
 for(const x of state.calendarEvents||[]){
  if(x.date!==date)continue;
  events.set('event:'+x.id,{key:'event:'+x.id,kind:'calendar',calendarEventId:x.id,
   studentId:null,name:x.title,date,time:x.time,duration:x.duration,
   label:x.type==='recording'?'Recording session':x.type==='jam'?'Jam session':'Other event',
   people:x.people,notes:x.notes});
 }
 return [...events.values()].map(e=>{
  const cancellation=(state.cancellations||[]).find(c=>c.studentId===e.studentId&&
   c.date===e.date&&c.time===e.time&&
   (e.appointmentId?
    (c.appointmentId?c.appointmentId===e.appointmentId:!closed)
    :!c.appointmentId));
  return {...e,cancelled:!!cancellation,reason:cancellation?.reason||null,cancelledBy:cancellation?.cancelledBy||null};
 }).sort((a,b)=>minutes(a.time)-minutes(b.time)||a.name.localeCompare(b.name));
}
export function scheduleWeek(state,date){
 if(!validDate(date))throw Error('Invalid date.');
 // Rolling seven-day window anchored to the selected day, not ISO Monday.
 return Array.from({length:7},(_,i)=>{const day=addDay(date,i);return {date:day,weekday:DAYS[new Date(day+'T12:00:00').getDay()],events:dayEvents(state,day),available:availableSlots(state,day)};});
}
function busyWindows(state,date){
 // Include bookings started yesterday that extend past midnight.
 const events=[...dayEvents(state,date).map(e=>({e,shift:0})),...dayEvents(state,addDay(date,-1)).map(e=>({e,shift:-1440}))];
 return events.filter(({e})=>!e.cancelled).map(({e,shift})=>[minutes(e.time)+shift,minutes(e.time)+shift+e.duration]);
}
function subtractWindows(ranges,busy){
 for(const [start,end] of busy){
  ranges=ranges.flatMap(([a,b])=>b<=start||a>=end?[[a,b]]:
    [[a,Math.min(b,start)],[Math.max(a,end),b]].filter(([x,y])=>y>x));
 }
 return ranges;
}
function joinRanges(ranges){
 const result=[];
 for(const [a,b] of ranges.sort((x,y)=>x[0]-y[0])){
  if(result.length&&result.at(-1)[1]>=a)result.at(-1)[1]=Math.max(result.at(-1)[1],b);
  else result.push([a,b]);
 }
 return result;
}
export function availableSlots(state,date){
 // Holidays suspend ordinary teaching availability, not manually booked lessons.
 // Do not advertise an entire closed day as free for automatic booking.
 if(isHolidayDate(state.holidays||[],date))return [];
 const hours=state.settings.teachingHours?.[new Date(date+'T12:00:00').getDay()]??null;
 // If working hours aren't defined, only explicitly cancelled time is known to be free.
 const ranges=hours?[[minutes(hours.start),minutes(hours.end)]]:dayEvents(state,date).filter(e=>e.cancelled).map(e=>[minutes(e.time),Math.min(1440,minutes(e.time)+e.duration)]);
 const free=joinRanges(subtractWindows(ranges,busyWindows(state,date)));
 return free.filter(([a,b])=>b-a>=5).map(([a,b])=>({start:minsToTime(a),end:minsToTime(b),minutes:b-a}));
}
export function hasCollision(state,date,time,duration,excludeKey=null){
 const start=+new Date(date+'T'+time+':00');
 const end=start+duration*60000;
 for(const day of [addDay(date,-1),date,addDay(date,1)]){
  for(const ev of dayEvents(state,day)){
   if(ev.cancelled||ev.key===excludeKey)continue;
   const from=+new Date(ev.date+'T'+ev.time+':00');
   if(from<end&&start<from+ev.duration*60000)return ev;
  }
 }
 return null;
}
export function saveCalendarEvent(state,item){
 if(!item||!item.id||typeof item.id!=='string'||item.id.length>100||
  typeof item.title!=='string'||!item.title.trim()||item.title.length>200||
  !validDate(item.date)||!validTime(item.time)||
  !Number.isInteger(item.duration)||item.duration<1||item.duration>1440||
  !['recording','jam','other'].includes(item.type)||
  typeof item.people!=='string'||item.people.length>2000||
  typeof item.notes!=='string'||item.notes.length>200000)
  throw Error('Enter a valid event title, category, date, time and duration.');
 const old=(state.calendarEvents||[]).find(e=>e.id===item.id);
 const conflict=hasCollision(state,item.date,item.time,item.duration,old?'event:'+old.id:null);
 if(conflict)throw Error('Schedule conflict: '+conflict.name+' at '+conflict.time+'. Choose another time.');
 const next=(state.calendarEvents||[]).filter(e=>e.id!==item.id);
 next.push({...item,title:item.title.trim()});
 state.calendarEvents=next;
 return next.at(-1);
}
export function removeCalendarEvent(state,id){
 if(!(state.calendarEvents||[]).some(e=>e.id===id))throw Error('This event no longer exists.');
 state.calendarEvents=state.calendarEvents.filter(e=>e.id!==id);
}
export function cancelLesson(state,key,reason='cancelled',cancelledBy='student'){
 const target=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!target)throw Error('This lesson is no longer scheduled.');
 if(target.cancelled)throw Error('This lesson is already cancelled.');
 if(!['sick','cancelled','vacation','other'].includes(reason))throw Error('Invalid cancellation reason.');
 if(!['student','teacher'].includes(cancelledBy))throw Error('Invalid cancellation origin.');
 const person=state.students.find(s=>s.id===key.studentId);
 if(!person)throw Error('Student record no longer exists.');
 if(cancelledBy==='teacher'&&(person.makeupBalance??0)>=9999)throw Error('Make-up credit balance is at its maximum.');
 // Validate before either write. The IndexedDB transaction commits both or neither.
 state.cancellations.push({studentId:key.studentId,date:key.date,time:key.time,reason,cancelledBy,
  ...(target.appointmentId?{appointmentId:target.appointmentId}:{})});
 if(cancelledBy==='teacher')person.makeupBalance=(person.makeupBalance??0)+1;
 return target;
}
export function restoreLesson(state,key){
 const source=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!source)throw Error('The original booking no longer exists.');
 const closed=holidaysOnDate(state,key.date).length>0;
 const i=state.cancellations.findIndex(c=>c.studentId===key.studentId&&c.date===key.date&&c.time===key.time&&
  (source.appointmentId?(c.appointmentId?c.appointmentId===source.appointmentId:!closed):!c.appointmentId));
 if(i<0)throw Error('Cancellation not found.');
 const candidate={...state,cancellations:state.cancellations.filter((_,j)=>j!==i)};
 const conflict=hasCollision(candidate,key.date,key.time,source.duration,source.key);
 if(conflict)throw Error('Cannot restore: '+conflict.name+' is booked at '+conflict.time+'. Remove or move that booking first.');
 const record=state.cancellations[i];
 const person=state.students.find(s=>s.id===record.studentId);
 if(!person)throw Error('Student record no longer exists.');
 state.cancellations.splice(i,1);
 // An intervening manual correction may already have set balance to zero.
 if(record.cancelledBy==='teacher')person.makeupBalance=Math.max(0,(person.makeupBalance??0)-1);
}
export function bookReplacement(state,key,newStudentId,reason='cancelled',cancelledBy='student'){
 const source=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!source)throw Error('Original lesson no longer exists.');
 if(newStudentId===source.studentId)throw Error('Choose a different student, or restore the original lesson.');
 const replacement=state.students.find(s=>s.id===newStudentId&&!s.archived);
 if(!replacement)throw Error('Choose an active student.');
 if(!['sick','cancelled','vacation','other'].includes(reason))throw Error('Invalid cancellation reason.');
 if(!['student','teacher'].includes(cancelledBy))throw Error('Invalid cancellation origin.');
 const proposedCancellation={studentId:key.studentId,date:key.date,time:key.time,reason,cancelledBy,
  ...(source.appointmentId?{appointmentId:source.appointmentId}:{})};
 const candidate=source.cancelled?state:{...state,cancellations:[...state.cancellations,proposedCancellation]};
 const clash=hasCollision(candidate,key.date,key.time,source.duration);
 if(clash)throw Error('Booking conflict: '+clash.name+' · '+clash.time+'.');
 if(state.appointments.some(a=>a.studentId===newStudentId&&a.date===key.date&&a.time===key.time))throw Error('Student already has an appointment in this slot.');
 // All validation above precedes mutation; caller also writes both in one IndexedDB transaction.
 const appointment={id:crypto.randomUUID(),studentId:newStudentId,date:key.date,time:key.time,duration:source.duration,label:'Replacement lesson'};
 if(!source.cancelled)cancelLesson(state,key,reason,cancelledBy);
 state.appointments.push(appointment);
}
// The balance is a commitment ledger: booking spends one owed lesson immediately.
// The exact booking ID records that spending so edits, moves and imports cannot
// accidentally subtract a second credit. Older appointments without the marker
// keep their historical balance when re-saved without a change of type or student.
export const isMakeupLesson=label=>typeof label==='string'&&label.trim().toLowerCase()==='make-up lesson';
const appointmentCancellation=(state,a)=>state.cancellations.find(c=>c.appointmentId===a.id);
export function saveAppointment(state,item){
 const old=state.appointments.find(a=>a.id===item.id);
 if(!old&&state.appointments.some(a=>a.id===item.id))throw Error('Duplicate appointment identifier.');
 if(old&&appointmentCancellation(state,old))throw Error('Restore this cancelled appointment before editing it.');
 const person=state.students.find(s=>s.id===item.studentId&&!s.archived);
 if(!person)throw Error('Select an active student.');
 // Prevent using a newly booked date/time in place of a separately cancelled
 // recurring occurrence, which would otherwise inherit its cancellation.
 if(state.cancellations.some(c=>c.studentId===item.studentId&&c.date===item.date&&c.time===item.time&&!c.appointmentId&&
  !(old&&old.studentId===item.studentId&&old.date===item.date&&old.time===item.time)))
  throw Error('This student was cancelled for that time. Restore the lesson or choose another time.');
 const requested=isMakeupLesson(item.label);
 const oldRedeemed=old?.redeemedCredit===true;
 const changedStudent=!!old&&old.studentId!==item.studentId;
 const newRedeemed=requested&&(oldRedeemed||!old||!isMakeupLesson(old.label)||changedStudent);
 const oldPerson=old&&state.students.find(s=>s.id===old.studentId);
 if(old&&!oldPerson)throw Error('Original student record is missing.');
 let refund=(oldRedeemed&&(!newRedeemed||changedStudent))?1:0;
 let debit=(newRedeemed&&(!oldRedeemed||changedStudent))?1:0;
 const oldBalance=(oldPerson?.makeupBalance??0)+refund;
 const newBalance=(person.makeupBalance??0)+(oldPerson?.id===person.id?refund:0)-debit;
 if(oldBalance>9999||newBalance>9999)throw Error('Make-up balance exceeds its maximum. Adjust the student balance first.');
 if(newBalance<0)throw Error('No outstanding make-up lesson for this student. Change the appointment type to Extra lesson or adjust the balance.');
 const updated={...item,...(newRedeemed?{redeemedCredit:true}:{})};
 const collection=state.appointments.filter(a=>a.id!==item.id).concat(updated);
 // Validate without mutation; the surrounding IndexedDB transaction is also atomic.
 // Imported legacy appointments may contain outdated free-text labels.
 if(collection.some((a,i)=>collection.findIndex(b=>b.studentId===a.studentId&&b.date===a.date&&b.time===a.time)!==i))
  throw Error('This student already has an appointment at the selected date/time.');
 if(oldRedeemed&&(!newRedeemed||changedStudent))oldPerson.makeupBalance=oldBalance;
 if(newRedeemed&&(!oldRedeemed||changedStudent))person.makeupBalance=newBalance;
 state.appointments=collection;
 return updated;
}
export function removeAppointment(state,id){
 const item=state.appointments.find(a=>a.id===id);
 if(!item)throw Error('Appointment no longer exists.');
 const cancelled=!!appointmentCancellation(state,item);
 const person=state.students.find(s=>s.id===item.studentId);
 if(!person)throw Error('Student record no longer exists.');
 // Teacher cancellation has already refunded the credit; student cancellation
 // forfeits it. Only removing an active redeemed appointment refunds.
 if(item.redeemedCredit&&!cancelled){
  if((person.makeupBalance??0)>=9999)throw Error('Make-up credit balance is at its maximum.');
  person.makeupBalance=(person.makeupBalance??0)+1;
 }
 state.cancellations=state.cancellations.filter(c=>c.appointmentId!==item.id);
 state.appointments=state.appointments.filter(a=>a.id!==id);
}
export function bookFreeSlot(state,studentId,date,time,duration,label='Make-up lesson'){
 if(!validDate(date)||!validTime(time)||!Number.isInteger(duration)||duration<1||duration>1440)throw Error('Invalid lesson time or duration.');
 const person=state.students.find(s=>s.id===studentId&&!s.archived);
 if(!person)throw Error('Select an active student.');
 const start=minutes(time);
 if(!availableSlots(state,date).some(slot=>start>=minutes(slot.start)&&start+duration<=minutes(slot.end)))throw Error('That time is not available. Check teaching hours or existing bookings.');
 const clash=hasCollision(state,date,time,duration);
 if(clash)throw Error('Booking conflict: '+clash.name+' · '+clash.time+'.');
 return saveAppointment(state,{id:crypto.randomUUID(),studentId,date,time,duration,label});
}
