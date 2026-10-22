export const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const defaults=()=>({schemaVersion:10,lessonOverrides:[],students:[],trials:[],appointments:[],calendarEvents:[],cancellations:[],holidays:[],lessons:[],snippets:[['WDH','Review: '],['Timing','Timing: '],['Technique','Technique: '],['Grooves','Grooves: '],['Rudiments','Rudiments: '],['Homework','Homework: ']].map(([label,text],i)=>({id:'snippet-'+i,label,text})),settings:{backupReminder:true,lastBackup:null,soundEnabled:true,soundVolume:0.35,launchScreen:true,theme:'voyager',uiScale:80,teachingHours:[null,null,null,null,null,null,null]}});
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
export function appointment(s,date){const d=new Date(date);d.setHours(...s.time.split(':').map(Number),0,0);return d;}
export const scheduleType=s=>s.schedule??'weekly';
const calendarDay=d=>{const [y,m,day]=d.split('-').map(Number);return Date.UTC(y,m-1,day)/86400000;};
export function isTeachingDay(s,date){
 const type=scheduleType(s);if(type==='flexible')return false;
 if(new Date(date+'T12:00:00').getDay()!==s.day)return false;
 if(type==='biweekly'){const delta=calendarDay(date)-calendarDay(s.anchorDate);return delta>=0&&delta%14===0;}
 return true;
}
export function isHolidayDate(holidays,date){
 return holidays.some(h=>h.startDate<=date&&date<=h.endDate);
}
export function selectScheduled(students,now=new Date(),appointments=[],trials=[],cancellations=[],holidays=[],lessonOverrides=[]){
 const current=[],next=[];
 for(const s of students.filter(s=>!s.archived&&scheduleType(s)!=='flexible')){
  const base=new Date(now);base.setDate(base.getDate()-1);base.setHours(12,0,0,0);
  if(scheduleType(s)==='biweekly'&&localDate(base)<s.anchorDate)base.setTime(+new Date(s.anchorDate+'T12:00:00'));
  // Usually 15 days suffice. Extend through any relevant closures so a long holiday
  // does not make the next regular lesson apparently disappear.
  let horizon=15;
  const baseDay=localDate(base);
  for(let pass=0;pass<=holidays.length;pass++){
   const end=new Date(base);end.setDate(end.getDate()+horizon);
   let extended=false;
   for(const h of holidays){
    if(h.startDate<=localDate(end)&&h.endDate>=baseDay){
     const last=new Date(h.endDate+'T12:00:00');
     const days=Math.round((Date.UTC(last.getFullYear(),last.getMonth(),last.getDate())-
       Date.UTC(base.getFullYear(),base.getMonth(),base.getDate()))/86400000);
     const longer=Math.min(732,days+15);
     if(longer>horizon){horizon=longer;extended=true;}
    }
   }
   if(!extended)break;
  }
  for(let offset=0;offset<=horizon;offset++){
   const day=new Date(base);day.setDate(day.getDate()+offset);if(!isTeachingDay(s,localDate(day))||isHolidayDate(holidays,localDate(day))||lessonOverrides.some(o=>o.studentId===s.id&&o.originalDate===localDate(day)&&o.originalTime===s.time))continue;
   const start=appointment(s,day),end=new Date(+start+s.duration*60000);
   if(start<=now&&now<end)current.push({student:s,start});else if(start>now)next.push({student:s,start});
  }
 }
 for(const change of lessonOverrides){
  const person=students.find(s=>s.id===change.studentId&&!s.archived);
  if(!person)continue;
  const start=new Date(change.date+'T'+change.time+':00'),end=new Date(+start+change.duration*60000);
  const item={student:person,start,override:change};
  if(start<=now&&now<end)current.push(item);else if(start>now)next.push(item);
 }
 for(const extra of appointments){
  const student=students.find(s=>s.id===extra.studentId&&!s.archived);if(!student)continue;
  const start=new Date(extra.date+'T'+extra.time+':00'),end=new Date(+start+extra.duration*60000);
  // Explicit booking takes precedence over an identical recurring occurrence.
  for(const list of [current,next]){const i=list.findIndex(x=>x.student.id===student.id&&+x.start===+start);if(i>=0)list.splice(i,1);}
  const item={student,start,appointment:extra};if(start<=now&&now<end)current.push(item);else if(start>now)next.push(item);
 }
 for(const trial of trials.filter(t=>!t.archived)){
  const start=new Date(trial.date+'T'+trial.time+':00'),end=new Date(+start+trial.duration*60000);
  const item={student:{id:'trial:'+trial.id,name:trial.name},start,trial};
  if(start<=now&&now<end)current.push(item);else if(start>now)next.push(item);
 }
 const isAllowed=x=>{
  const date=localDate(x.start),time=x.appointment?.time||x.override?.time||x.student.time;
  return !cancellations.some(c=>c.studentId===x.student.id&&c.date===date&&c.time===time&&
   (x.appointment?
    // Legacy cancellations without an appointmentId still affect explicit
    // bookings outside holidays (old v5 behavior); within a closure, only a
    // cancellation of this specific booking may suppress it.
    (c.appointmentId?c.appointmentId===x.appointment.id:!isHolidayDate(holidays,date))
    :!c.appointmentId));
 };
 const active=current.filter(isAllowed),future=next.filter(isAllowed);
 const order=(a,b)=>a.start-b.start||a.student.name.localeCompare(b.student.name)||a.student.id.localeCompare(b.student.id);active.sort(order);future.sort(order);
 return {kind:active.length?'current':'next',matches:active,selected:active[0]||future[0]||null};
}
export function todayLesson(s,lessons,now=new Date()){
 const date=localDate(now);
 if(scheduleType(s)==='flexible'){
  const existing=lessons.filter(l=>l.studentId===s.id&&l.date===date).sort((a,b)=>b.time.localeCompare(a.time))[0];
  return {date,time:existing?.time||String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),duration:existing?.duration||s.duration};
 }
 return {date,time:s.time,duration:s.duration};
}
// Additive version upgrade: lesson records are deliberately untouched.
export function migrateState(state){if(state.schemaVersion===1)state.schemaVersion=2;if(state.schemaVersion===2){state.appointments=[];state.schemaVersion=3;}if(state.schemaVersion===3){state.trials=[];state.schemaVersion=4;}if(state.schemaVersion===4){state.cancellations=[];state.settings.teachingHours=[null,null,null,null,null,null,null];state.schemaVersion=5;}if(state.schemaVersion===5){state.holidays=[];state.schemaVersion=6;}if(state.schemaVersion===6){state.schemaVersion=7;}if(state.schemaVersion===7){state.schemaVersion=8;}if(state.schemaVersion===8){state.calendarEvents=[];state.schemaVersion=9;}if(state.schemaVersion===9){state.lessonOverrides=[];state.schemaVersion=10;}if(state.schemaVersion!==10)throw Error('This database needs a newer version of Drum Log.');return state;}
export const lessonKey=(studentId,date,time)=>JSON.stringify([studentId,date,time]);
export const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&localDate(new Date(v+'T12:00:00'))===v;
export const validTime=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validateBackup(raw){
 const fail=m=>{throw Error('Invalid backup: '+m);};const str=(v,max=200000)=>typeof v==='string'&&v.length<=max;
 if(!raw||![1,2,3,4,5,6,7,8,9,10].includes(raw.schemaVersion))fail('unsupported schema version.');
 if(!Array.isArray(raw.students)||!Array.isArray(raw.lessons)||!Array.isArray(raw.snippets))fail('missing data collections.');
 const ids=new Set();for(const s of raw.students){
  if(!s||!str(s.id,100)||!s.id||ids.has(s.id)||!str(s.name,200)||!s.name.trim()||!Number.isInteger(s.duration)||s.duration<1||s.duration>1440||!str(s.remarks)||typeof s.archived!=='boolean'||(s.makeupBalance!==undefined&&(!Number.isSafeInteger(s.makeupBalance)||s.makeupBalance<0||s.makeupBalance>9999)))fail('student record.');
  const type=scheduleType(s);if(!['weekly','biweekly','flexible'].includes(type))fail('schedule type.');
  if(type==='flexible'){if(s.day!==null||s.time!==null)fail('flexible schedule must have no fixed day or time.');}
  else if(!Number.isInteger(s.day)||s.day<0||s.day>6||!validTime(s.time))fail('schedule day or time.');
  if(type==='biweekly'&&(!validDate(s.anchorDate)||new Date(s.anchorDate+'T12:00:00').getDay()!==s.day))fail('fortnightly start date.');
  ids.add(s.id);
 }
 const keys=new Set();for(const l of raw.lessons){if(!l||!ids.has(l.studentId)||!validDate(l.date)||!validTime(l.time)||!Number.isInteger(l.duration)||l.duration<1||l.duration>1440||!str(l.notes)||l.id!==lessonKey(l.studentId,l.date,l.time)||keys.has(l.id))fail('lesson record or duplicate lesson.');keys.add(l.id);}
 const appointments=raw.appointments??(raw.schemaVersion<3?[]:null);
 if(!Array.isArray(appointments))fail('appointments collection.');
 const appointmentIds=new Set(),appointmentSlots=new Set();
 for(const a of appointments){
  if(!a||!str(a.id,100)||!a.id||appointmentIds.has(a.id)||!ids.has(a.studentId)||!validDate(a.date)||!validTime(a.time)||!Number.isInteger(a.duration)||a.duration<1||a.duration>1440||!str(a.label,200)||(a.redeemedCredit!==undefined&&typeof a.redeemedCredit!=='boolean')||(a.redeemedCredit===true&&a.label.trim().toLowerCase()!=='make-up lesson'))fail('appointment record.');
  const slot=lessonKey(a.studentId,a.date,a.time);if(appointmentSlots.has(slot))fail('duplicate appointment.');appointmentIds.add(a.id);appointmentSlots.add(slot);
 }
 const lessonOverrides=raw.lessonOverrides??(raw.schemaVersion<10?[]:null);
 if(!Array.isArray(lessonOverrides)||lessonOverrides.length>10000)fail('lesson overrides collection.');
 const overrideKeys=new Set();
 for(const o of lessonOverrides){
  if(!o||!ids.has(o.studentId)||!validDate(o.originalDate)||!validTime(o.originalTime)||
   !validDate(o.date)||!validTime(o.time)||
   !Number.isInteger(o.duration)||o.duration<1||o.duration>1440)fail('lesson override.');
  const profile=raw.students.find(s=>s.id===o.studentId);
  if(scheduleType(profile)==='flexible')fail('lesson override requires recurring student.');
  const origin=lessonKey(o.studentId,o.originalDate,o.originalTime);
  if(overrideKeys.has(origin))fail('duplicate lesson override.');
  overrideKeys.add(origin);
 }
 const calendarEvents=raw.calendarEvents??(raw.schemaVersion<9?[]:null);
 if(!Array.isArray(calendarEvents)||calendarEvents.length>10000)fail('calendar events collection.');
 const eventIds=new Set();
 for(const e of calendarEvents){
  if(!e||!str(e.id,100)||!e.id||eventIds.has(e.id)||
    !str(e.title,200)||!e.title.trim()||!validDate(e.date)||
    !validTime(e.time)||!Number.isInteger(e.duration)||e.duration<1||e.duration>1440||
    !['recording','jam','other'].includes(e.type)||!str(e.people,2000)||!str(e.notes))fail('calendar event record.');
  eventIds.add(e.id);
 }
 const cancellations=raw.cancellations??(raw.schemaVersion<5?[]:null);
 if(!Array.isArray(cancellations))fail('cancellations collection.');
 const cancellationKeys=new Set();
 for(const c of cancellations){
  if(!c||!ids.has(c.studentId)||!validDate(c.date)||!validTime(c.time)||!['sick','cancelled','vacation','other'].includes(c.reason)||
   (c.cancelledBy!==undefined&&!['teacher','student'].includes(c.cancelledBy))||
   (c.appointmentId!==undefined&&(!str(c.appointmentId,100)||!c.appointmentId)))fail('cancelled lesson.');
  const key=lessonKey(c.studentId,c.date,c.time)+':'+(c.appointmentId||'regular');
  if(cancellationKeys.has(key))fail('duplicate cancellation.');
  cancellationKeys.add(key);
 }
 const holidays=raw.holidays??(raw.schemaVersion<6?[]:null);
 if(!Array.isArray(holidays)||holidays.length>2000)fail('holiday periods.');
 const holidayIds=new Set();
 for(const h of holidays){
  if(!h||!str(h.id,100)||!h.id||holidayIds.has(h.id)||
   !validDate(h.startDate)||!validDate(h.endDate)||h.startDate>h.endDate||
   !str(h.label,200))fail('holiday period.');
  holidayIds.add(h.id);
 }
 const trials=raw.trials??(raw.schemaVersion<4?[]:null);
 if(!Array.isArray(trials))fail('trials collection.');
 const trialIds=new Set();for(const t of trials){if(!t||!str(t.id,100)||!t.id||trialIds.has(t.id)||!str(t.name,200)||!t.name.trim()||!validDate(t.date)||!validTime(t.time)||!Number.isInteger(t.duration)||t.duration<1||t.duration>1440||!str(t.contact,2000)||!str(t.remarks)||!str(t.notes)||typeof t.archived!=='boolean')fail('trial record.');trialIds.add(t.id);}
 const snippets=new Set();for(const s of raw.snippets){if(!s||!str(s.id,100)||!s.id||snippets.has(s.id)||!str(s.label,50)||!s.label.trim()||!str(s.text,10000))fail('text shortcut.');snippets.add(s.id);}
 if(!raw.settings||typeof raw.settings.backupReminder!=='boolean'||!(raw.settings.lastBackup===null||(typeof raw.settings.lastBackup==='string'&&Number.isFinite(Date.parse(raw.settings.lastBackup)))))fail('settings.');
 if(raw.settings.soundEnabled!==undefined&&typeof raw.settings.soundEnabled!=='boolean')fail('sound setting.');
 if(raw.settings.launchScreen!==undefined&&typeof raw.settings.launchScreen!=='boolean')fail('LCARS start screen setting.');
 if(raw.settings.theme!==undefined&&!['voyager','elite','redalert'].includes(raw.settings.theme))fail('LCARS display theme.');
 if(raw.settings.soundVolume!==undefined&&(!Number.isFinite(raw.settings.soundVolume)||raw.settings.soundVolume<0||raw.settings.soundVolume>1))fail('sound volume.');
 if(raw.settings.uiScale!==undefined&&(!Number.isInteger(raw.settings.uiScale)||raw.settings.uiScale<65||raw.settings.uiScale>100||raw.settings.uiScale%5!==0))fail('mobile UI scale.');
 const teachingHours=raw.settings.teachingHours??(raw.schemaVersion<5?[null,null,null,null,null,null,null]:null);
 if(!Array.isArray(teachingHours)||teachingHours.length!==7||!teachingHours.every(h=>h===null||(h&&validTime(h.start)&&validTime(h.end)&&h.start<h.end)))fail('teaching hours.');
 return {schemaVersion:10,lessonOverrides:lessonOverrides.map(({studentId,originalDate,originalTime,date,time,duration})=>({studentId,originalDate,originalTime,date,time,duration})),calendarEvents:calendarEvents.map(({id,title,date,time,duration,type,people,notes})=>({id,title,date,time,duration,type,people,notes})),holidays:holidays.map(({id,startDate,endDate,label})=>({id,startDate,endDate,label})),cancellations:cancellations.map(({studentId,date,time,reason,appointmentId,cancelledBy})=>({studentId,date,time,reason,...(appointmentId?{appointmentId}:{}),...(cancelledBy?{cancelledBy}:{})})),trials:trials.map(({id,name,date,time,duration,contact,remarks,notes,archived})=>({id,name,date,time,duration,contact,remarks,notes,archived})),appointments:appointments.map(({id,studentId,date,time,duration,label,redeemedCredit})=>({id,studentId,date,time,duration,label,...(redeemedCredit?{redeemedCredit:true}:{})})),students:raw.students.map(({id,name,day,time,duration,remarks,archived,schedule,anchorDate,makeupBalance})=>({id,name,day,time,duration,remarks,archived,...(schedule?{schedule}:{}),...(schedule==='biweekly'?{anchorDate}:{}),...(makeupBalance!==undefined?{makeupBalance}:{})})),lessons:raw.lessons.map(({id,studentId,date,time,duration,notes})=>({id,studentId,date,time,duration,notes})),snippets:raw.snippets.map(({id,label,text})=>({id,label,text})),settings:{backupReminder:raw.settings.backupReminder,lastBackup:raw.settings.lastBackup,soundEnabled:raw.settings.soundEnabled??true,soundVolume:raw.settings.soundVolume??0.35,launchScreen:raw.settings.launchScreen??true,theme:raw.settings.theme??'voyager',uiScale:raw.settings.uiScale??80,teachingHours:teachingHours.map(h=>h?{start:h.start,end:h.end}:null)}};
}
export function csv(rows){const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n');}

// Applied inside one IndexedDB transaction: either every conversion record commits, or none do.
export function convertTrial(state,trialId,profile,appointmentId){
 const trial=state.trials.find(t=>t.id===trialId);if(!trial)throw Error('Trial no longer exists. It may already have been converted.');
 if(state.students.some(s=>s.id===profile.id))throw Error('Student identifier already exists.');
 const student={...profile,remarks:[profile.remarks,trial.contact?'Trial contact: '+trial.contact:'',trial.remarks?'Trial remarks: '+trial.remarks:''].filter(Boolean).join('\n\n')};
 const entry={id:lessonKey(student.id,trial.date,trial.time),studentId:student.id,date:trial.date,time:trial.time,duration:trial.duration,notes:trial.notes};
 const next={...state,students:[...state.students,student],lessons:trial.notes?[...state.lessons,entry]:state.lessons,appointments:[...state.appointments,{id:appointmentId,studentId:student.id,date:trial.date,time:trial.time,duration:trial.duration,label:'Trial lesson'}],trials:state.trials.filter(t=>t.id!==trialId)};
 validateBackup(next);Object.assign(state,next);return entry;
}
