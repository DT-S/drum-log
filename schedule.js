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
 const cancelled=new Map((state.cancellations||[]).map(c=>[uid(c.studentId,c.date,c.time),c]));
 return [...events.values()].map(e=>{
  // A booking explicitly made during holidays overrides an old cancellation of
  // the otherwise absent recurring occurrence at exactly this time.
  const cancellation=e.studentId&&!(closed&&e.kind!=='regular')?cancelled.get(e.key):null;
  return {...e,cancelled:!!cancellation,reason:cancellation?.reason||null};
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
export function cancelLesson(state,key,reason='cancelled'){
 const target=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!target)throw Error('This lesson is no longer scheduled.');
 if(target.cancelled)throw Error('This lesson is already cancelled.');
 if(!['sick','cancelled','vacation','other'].includes(reason))throw Error('Invalid cancellation reason.');
 state.cancellations.push({studentId:key.studentId,date:key.date,time:key.time,reason});
 return target;
}
export function restoreLesson(state,key){
 const i=state.cancellations.findIndex(c=>c.studentId===key.studentId&&c.date===key.date&&c.time===key.time);
 if(i<0)throw Error('Cancellation not found.');
 const source=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!source)throw Error('The original booking no longer exists.');
 const candidate={...state,cancellations:state.cancellations.filter((_,j)=>j!==i)};
 const conflict=hasCollision(candidate,key.date,key.time,source.duration,source.key);
 if(conflict)throw Error('Cannot restore: '+conflict.name+' is booked at '+conflict.time+'. Remove or move that booking first.');
 state.cancellations.splice(i,1);
}
export function bookReplacement(state,key,newStudentId,reason='cancelled'){
 const source=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
 if(!source)throw Error('Original lesson no longer exists.');
 if(newStudentId===source.studentId)throw Error('Choose a different student, or restore the original lesson.');
 const replacement=state.students.find(s=>s.id===newStudentId&&!s.archived);
 if(!replacement)throw Error('Choose an active student.');
 if(!['sick','cancelled','vacation','other'].includes(reason))throw Error('Invalid cancellation reason.');
 const proposedCancellation={studentId:key.studentId,date:key.date,time:key.time,reason};
 const candidate=source.cancelled?state:{...state,cancellations:[...state.cancellations,proposedCancellation]};
 const clash=hasCollision(candidate,key.date,key.time,source.duration);
 if(clash)throw Error('Booking conflict: '+clash.name+' · '+clash.time+'.');
 if(state.appointments.some(a=>a.studentId===newStudentId&&a.date===key.date&&a.time===key.time))throw Error('Student already has an appointment in this slot.');
 // All validation above precedes mutation; caller also writes both in one IndexedDB transaction.
 const appointment={id:crypto.randomUUID(),studentId:newStudentId,date:key.date,time:key.time,duration:source.duration,label:'Replacement lesson'};
 if(!source.cancelled)state.cancellations.push(proposedCancellation);
 state.appointments.push(appointment);
}
export function bookFreeSlot(state,studentId,date,time,duration){
 if(!validDate(date)||!validTime(time)||!Number.isInteger(duration)||duration<1||duration>1440)throw Error('Invalid lesson time or duration.');
 const person=state.students.find(s=>s.id===studentId&&!s.archived);
 if(!person)throw Error('Select an active student.');
 const start=minutes(time);
 if(!availableSlots(state,date).some(slot=>start>=minutes(slot.start)&&start+duration<=minutes(slot.end)))throw Error('That time is not available. Check teaching hours or existing bookings.');
 const clash=hasCollision(state,date,time,duration);
 if(clash)throw Error('Booking conflict: '+clash.name+' · '+clash.time+'.');
 if(state.cancellations.some(c=>c.studentId===studentId&&c.date===date&&c.time===time))throw Error('This student was cancelled for that time. Restore the lesson instead.');
 state.appointments.push({id:crypto.randomUUID(),studentId,date,time,duration,label:'Make-up lesson'});
}
