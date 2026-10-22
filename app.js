import {createSoundSystem} from './sound.js';
import {createViewMotion,createShellMotion} from './lcars-motion.js';
import {createStartupConsole} from './lcars-startup.js';
import {applyTheme,normalizeTheme} from './lcars-theme.js';
import {installZoomGuard} from './lcars-zoom.js';
import {createUpdateManager} from './lcars-updater.js';
import {mountLcarsSlider} from './lcars-slider.js';
import {validDate,validTime,DAYS,defaults,localDate,selectScheduled,scheduleType,todayLesson,lessonKey,validateBackup,convertTrial,csv} from './core.js';
import {openDB,readState,mutate,replaceState} from './db.js';
import {dayEvents,scheduleWeek,availableSlots,holidaysOnDate,cancelLesson,restoreLesson,bookReplacement,bookFreeSlot,saveAppointment,removeAppointment,isMakeupLesson,saveCalendarEvent,removeCalendarEvent,saveLessonOverride,resetLessonOverride} from './schedule.js';
const sounds=createSoundSystem();sounds.bind();
const viewMotion=createViewMotion(document);
const shellMotion=createShellMotion(document);
const startupConsole=createStartupConsole(document,{getTheme:()=>state?.settings.theme,onThemeChange:theme=>change(s=>{s.settings.theme=normalizeTheme(theme);})});
installZoomGuard(document);
// Purely visual device preference. Existing backup schemas default to 80% on phones.
function applyMobileScale(raw){const value=Number(raw);const percent=Number.isFinite(value)?Math.max(65,Math.min(100,value)):80;document.documentElement.style.setProperty('--mobile-ui-scale',String(percent/100));}
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let plannerDate=localDate(),plannerMode='day',lastRenderedView=null;
let state,trialId=null,studentId=null,date=localDate(),time='15:00',duration=45,view='journal',manual=false,saveQueue=Promise.resolve(),pending=0,saveFailure=false,baseNotes='',search='',filter='active';
const channel=globalThis.BroadcastChannel?new BroadcastChannel('drum-log'):null;
const student=()=>state.students.find(s=>s.id===studentId);
const selectedOverride=()=>state.lessonOverrides?.find(o=>o.studentId===studentId&&o.date===date&&o.time===time);
const noteSlot=()=>{const o=selectedOverride();return {date:o?.originalDate||date,time:o?.originalTime||time};};
const key=()=>lessonKey(studentId,date,time);
const noteKey=()=>lessonKey(studentId,noteSlot().date,noteSlot().time);
const lesson=()=>state.lessons.find(l=>l.id===noteKey());
const niceDate=d=>d;
let dialogErrorTimeout=null;

function clearDialogError(){
 if(dialogErrorTimeout!==null){clearTimeout(dialogErrorTimeout);dialogErrorTimeout=null;}
 $('#modal')?.querySelector('[data-dialog-error]')?.remove();
}
function clearGlobalError(){
 const banner=$('#error');if(!banner)return;
 banner.textContent='';banner.hidden=true;
}
function error(e){
 const message=e?.message||String(e),m=$('#modal');
 sounds.play('invalid');
 if(m?.open){
  // Modal validation belongs to this dialog, not the global page banner.
  clearDialogError();
  const alert=document.createElement('p');alert.dataset.dialogError='';
  alert.setAttribute('role','alert');alert.tabIndex=0;
  alert.title='Tap to dismiss this message';
  alert.textContent=message;alert.onclick=clearDialogError;
  alert.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();clearDialogError();}};
  m.prepend(alert);
  // Closing, fixing a field or clicking dismisses immediately; timer is a fallback.
  dialogErrorTimeout=setTimeout(clearDialogError,10000);
  return;
 }
 const banner=$('#error');banner.textContent=message;banner.hidden=false;
}
// All informational/status banners use this one lifecycle. Clearing the old
// timer prevents an earlier notice from hiding a newer one.
let noticeTimer=null;
const NOTICE_LIFETIME_MS=8500;
function clearNotice(){
 if(noticeTimer!==null){clearTimeout(noticeTimer);noticeTimer=null;}
 const banner=$('#notice');
 if(!banner)return;
 banner.textContent='';banner.hidden=true;banner.title='';banner.tabIndex=-1;
 banner.onclick=null;banner.onkeydown=null;
}
function notice(text,tone='warning'){
 clearNotice();
 if(!text)return;
 const banner=$('#notice');
 if(!banner)return;
 sounds.play(tone);
 banner.textContent=text;banner.hidden=false;
 banner.title='Tap to dismiss this message';banner.tabIndex=0;
 banner.onclick=clearNotice;
 banner.onkeydown=e=>{
  if(e.key==='Enter'||e.key===' '||e.key==='Escape'){
   e.preventDefault();clearNotice();
  }
 };
 noticeTimer=setTimeout(clearNotice,NOTICE_LIFETIME_MS);
}
async function change(fn){state=await mutate(fn);applyTheme(document,state.settings.theme);sounds.configure(state.settings);channel?.postMessage('changed');}
function automatic(){const m=selectScheduled(state.students,new Date(),state.appointments,state.trials,state.cancellations,state.holidays,state.lessonOverrides);manual=false;trialId=null;if(m.selected?.trial){const t=m.selected.trial;trialId=t.id;studentId=null;date=t.date;time=t.time;duration=t.duration;return;}if(m.selected){studentId=m.selected.student.id;date=localDate(m.selected.start);time=m.selected.appointment?.time||m.selected.override?.time||m.selected.student.time;duration=m.selected.appointment?.duration||m.selected.override?.duration||m.selected.student.duration;}else {const flexible=state.students.find(s=>!s.archived&&scheduleType(s)==='flexible');studentId=flexible?.id||null;if(flexible){manual=true;({date,time,duration}=todayLesson(flexible,state.lessons));}}}
async function ready(){await saveQueue;if(saveFailure){error(Error('Your last edit is not saved. Copy the note somewhere safe, then use Retry save before navigating.'));return false;}return true;}
function scheduleSave(){if(trialId){saveTrialNotes();return;}const field=$('#notes');if(!field)return;const slot=noteSlot();const item={id:noteKey(),studentId,date:slot.date,time:slot.time,duration:$('#duration').checkValidity()?Number($('#duration').value):duration,notes:field.value};duration=item.duration;const expected=baseNotes;baseNotes=item.notes;pending++;saveFailure=false;$('#saveStatus').textContent='Saving…';saveQueue=saveQueue.then(async()=>{await change(s=>{const index=s.lessons.findIndex(l=>l.id===item.id);const old=index<0?'':s.lessons[index].notes;if(old!==expected&&old!==item.notes)throw Error('This lesson changed in another tab. Your text is still here. Copy it before reloading to reconcile both versions.');if(!s.students.some(s=>s.id===item.studentId))throw Error('This student was removed in another tab. Copy your note before reloading.');if(index<0)s.lessons.push(item);else s.lessons[index]=item;});}).catch(e=>{saveFailure=true;error(e);}).finally(()=>{pending--;if(!saveFailure&&!pending)$('#error').hidden=true;if($('#saveStatus'))$('#saveStatus').textContent=saveFailure?'NOT SAVED — copy your note':pending?'Saving…':'Saved on this device';});}
function render(){const entering=lastRenderedView!==null&&lastRenderedView!==view;lastRenderedView=view;$('#studentCount').textContent=String(state.students.filter(s=>!s.archived).length).padStart(2,'0');$('#lessonCount').textContent=String(state.lessons.length).padStart(2,'0');for(const el of document.querySelectorAll('.view'))el.hidden=el.id!==view;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));({journal:renderJournal,students:renderStudents,schedule:renderSchedule,settings:renderSettings})[view]();bindMobilePanes();bindDateTimeFields(document);if(entering)viewMotion.play(view);}
async function navigate(next){if(!await ready())return;clearNotice();clearGlobalError();state=await readState();applyTheme(document,state.settings.theme);sounds.configure(state.settings);if(view!==next)sounds.transition();else sounds.play('press');view=next;render();}
function renderJournal(){if(trialId&&state.trials.some(t=>t.id===trialId)){renderTrial();return;}trialId=null;const root=$('#journal'),s=student();if(!s){root.innerHTML='<div class="eyebrow">01 / INSTRUCTION LOG</div><div class="empty"><h2>Student database / empty</h2><p class="muted">Create a student record to initialize automatic lesson selection.</p><div class="toolbar"><button id="firstStudent">Add student</button><button id="firstTrial" class="secondary">Add trial lesson</button></div></div>';$('#firstStudent').onclick=()=>editStudent();$('#firstTrial').onclick=()=>editTrial();return;}
 const match=selectScheduled(state.students,new Date(),state.appointments,state.trials,state.cancellations,state.holidays,state.lessonOverrides),isCurrent=match.matches.some(x=>x.student.id===s.id),l=lesson();duration=selectedOverride()?.duration||l?.duration||duration;baseNotes=l?.notes||'';
 const previous=state.lessons.filter(x=>x.studentId===s.id&&x.date+'T'+x.time<date+'T'+time).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))[0];
 const history=state.lessons.filter(x=>x.studentId===s.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
 root.innerHTML=`<div class="sectionhead"><div><div class="eyebrow">01 / INSTRUCTION LOG</div><h2>${esc(s.name)}</h2><span class="tag">${manual?'Manual selection':isCurrent?'Lesson in progress':'Next scheduled lesson'}${s.archived?' / Archived':''}</span></div><button class="secondary" id="auto">Follow schedule</button></div><div class="makeup-credit-row"><span class="makeup-credit ${(s.makeupBalance??0)>0?'makeup-credit-owed':''}">MAKE-UP LESSONS OWED: ${s.makeupBalance??0}</span></div>${match.matches.length>1?'<p class="warn">Schedule overlap: '+match.matches.map(x=>esc(x.student.name)).join(', ')+'. Choose the student below.</p>':''}<label>STUDENT<select id="studentSelect">${state.students.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.id)}" ${x.id===s.id?'selected':''}>${esc(x.name)}${x.archived?' (archived)':''}</option>`).join('')}</select></label><div class="mobile-pane-tabs" role="group" aria-label="Lesson workspace"><button type="button" data-mobile-pane="notes" aria-pressed="true">Notes</button><button type="button" data-mobile-pane="history" aria-pressed="false">History / details</button></div><div class="journalgrid"><div class="editor-console"><div class="fields"><label>LESSON DATE<input id="date" type="text" data-calendar-date placeholder="YYYY-MM-DD" title="Date: YYYY-MM-DD" maxlength="10" autocomplete="off" value="${date}" required></label><label>START<input id="time" type="text" data-clock-time placeholder="HH:mm" title="24-hour time: HH:mm" maxlength="5" autocomplete="off" value="${time}" required></label><label>MINUTES<input id="duration" type="number" min="1" max="1440" value="${duration}" required></label></div><div class="toolbar"><button class="secondary" id="today">Today / new entry</button><span class="muted">${niceDate(date)}</span></div>${selectedOverride()?`<p class="muted">One-time lesson adjustment. Notes stay linked to the original lesson record (${noteSlot().date} ${noteSlot().time}).</p>`:''}<div class="toolbar shortcuts">${state.snippets.map(x=>`<button data-snippet="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div><label for="notes" class="eyebrow">LESSON NOTES</label><textarea id="notes" class="notes" placeholder="Enter lesson record…" maxlength="200000">${esc(l?.notes||'')}</textarea><div class="savebar"><span id="saveStatus">${l?'Saved on this device':'Ready — saves as you type'}</span><span>LOCAL STORAGE</span></div><div class="toolbar"><button class="secondary" id="retry">Retry save</button></div>${s.remarks?'<p class="muted">Student notes: '+esc(s.remarks)+'</p>':''}</div><div><article class="panel peach"><h3>Previous lesson</h3>${previous?`<p class="muted">${niceDate(previous.date)} · ${previous.time}</p><div class="previous">${esc(previous.notes)||'No notes recorded.'}</div><button id="copyPrevious" class="secondary">Append previous record</button>`:'<p class="muted">No previous lesson on file.</p>'}</article><div class="sectionhead"><h3>Record index</h3><span class="muted">${history.length} entries</span></div><div class="history">${history.map(x=>`<button data-lesson="${esc(x.id)}" class="${x.id===noteKey()?'selected':''}"><span>${niceDate(x.date)}</span><small>${x.time} / ${x.duration}m</small></button>`).join('')||'<p class="muted">No lesson records on file.</p>'}</div></div></div>`;
 $('#notes').oninput=scheduleSave;$('#retry').onclick=()=>{baseNotes=lesson()?.notes||'';scheduleSave();};
 $('#studentSelect').onchange=async e=>{const id=e.target.value;if(!await ready()){e.target.value=studentId;return;}trialId=null;studentId=id;manual=true;({date,time,duration}=todayLesson(student(),state.lessons));render();};
 $('#auto').onclick=async()=>{if(!await ready())return;automatic();render();};$('#today').onclick=async()=>{if(!await ready())return;manual=true;({date,time,duration}=todayLesson(s,state.lessons));render();$('#notes').focus();};
 for(const id of ['date','time'])$('#'+id).onchange=async e=>{if(!e.target.value||!e.target.reportValidity())return;if(!await ready()){e.target.value=id==='date'?date:time;return;}manual=true;if(id==='date')date=e.target.value;else time=e.target.value;render();};
 $('#duration').onchange=e=>{if(!e.target.checkValidity()){e.target.reportValidity();return;}scheduleSave();};
 document.querySelectorAll('[data-snippet]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>insert(state.snippets.find(x=>x.id===b.dataset.snippet).text);});
 if(previous)$('#copyPrevious').onclick=()=>{const n=$('#notes');n.setSelectionRange(n.value.length,n.value.length);insert((n.value?'\n\n':'')+previous.notes);};
 document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=async()=>{if(!await ready())return;const x=state.lessons.find(x=>x.id===b.dataset.lesson);date=x.date;time=x.time;duration=x.duration;manual=true;render();});
}
function bindMobilePanes(){
 if(view!=='journal')return;
 const root=$('#journal');root.dataset.mobilePane='notes';
 root.querySelectorAll('[data-mobile-pane]').forEach(button=>button.onclick=()=>{
  root.dataset.mobilePane=button.dataset.mobilePane;
  root.querySelectorAll('[data-mobile-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  button.classList.remove('lcars-pane-ack');
  void button.offsetWidth;
  if(!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)){
   button.classList.add('lcars-pane-ack');
   button.addEventListener('animationend',()=>button.classList.remove('lcars-pane-ack'),{once:true});
  }
 });
}
function insert(text){const n=$('#notes');n.setRangeText(text,n.selectionStart,n.selectionEnd,'end');n.focus();scheduleSave();}
function studentRows(items){return items.map(s=>`<div class="studentrow"><div><strong>${esc(s.name)}</strong><p class="muted">${scheduleType(s)==='flexible'?'Flexible / no fixed schedule':DAYS[s.day]+' · '+s.time+' · '+(scheduleType(s)==='biweekly'?'Every 2 weeks / from '+niceDate(s.anchorDate):'Weekly')} · ${s.duration} min ${s.archived?' · Archived':''}</p><span class="makeup-credit ${(s.makeupBalance??0)>0?'makeup-credit-owed':''}">MAKE-UP OWED: ${s.makeupBalance??0}</span></div><div class="toolbar"><button data-open="${esc(s.id)}">Open log</button><button class="secondary" data-edit="${esc(s.id)}">Edit</button></div></div>`).join('');}
function bindRows(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{trialId=null;studentId=b.dataset.open;manual=true;({date,time,duration}=todayLesson(student(),state.lessons));view='journal';render();});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editStudent(state.students.find(s=>s.id===b.dataset.edit)));}
function renderStudents(){const items=state.students.filter(s=>(filter==='makeup'?(s.makeupBalance??0)>0:filter==='all'||s.archived===(filter==='archived'))&&s.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(scheduleType(a)==='flexible'?8:(a.day||7))-(scheduleType(b)==='flexible'?8:(b.day||7))||(a.time||'').localeCompare(b.time||'')||a.name.localeCompare(b.name));$('#students').innerHTML=`<div class="sectionhead"><div><div class="eyebrow">02 / STUDENT DIRECTORY</div><h2>Student records</h2><p class="muted">${state.students.filter(s=>!s.archived).length} active profiles · arranged by teaching day</p></div><button id="addStudent">Add student</button></div><div class="searchbar"><input id="search" aria-label="Search students" placeholder="Search student records…" value="${esc(search)}"><select id="filter" aria-label="Profile status"><option value="active">Active students</option><option value="archived">Archived students</option><option value="all">All students</option><option value="makeup">Make-up lessons owed (1+)</option></select></div><div class="list">${studentRows(items)||'<p class="muted">No matching students.</p>'}</div>`;$('#filter').value=filter;$('#filter').onchange=e=>{filter=e.target.value;renderStudents();};$('#search').oninput=e=>{search=e.target.value;const pos=e.target.selectionStart;renderStudents();$('#search').focus();$('#search').setSelectionRange(pos,pos);};$('#addStudent').onclick=()=>editStudent();bindRows();}
function planDateShift(day,n){
 const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);
}

function planDayHTML(day,compact=false){
 const events=dayEvents(state,day),available=availableSlots(state,day),d=new Date(day+'T12:00:00');
 const wd=DAYS[d.getDay()],hours=state.settings.teachingHours?.[d.getDay()],closures=holidaysOnDate(state,day);
 const list=[
  ...events.map(e=>({sort:e.time,kind:'event',event:e})),
  ...available.map(e=>({sort:e.start,kind:'free',free:e}))
 ].sort((a,b)=>a.sort.localeCompare(b.sort)||(a.kind==='event'?-1:1));
 const row=x=>{
  if(x.kind==='free'){
   const slot=x.free;
   return `<div class="plan-row slot-available"><div class="plan-time">${slot.start}–${slot.end}</div><div class="plan-details"><strong>AVAILABLE</strong><small>${slot.minutes} min · Free teaching time</small></div><button type="button" class="secondary" data-free-book="${day}" data-free-start="${slot.start}" data-free-end="${slot.end}">Book</button></div>`;
  }
  const e=x.event,kind=e.kind==='calendar'?'calendar':e.cancelled?'cancelled':e.kind==='trial'||e.kind==='trial-converted'?'trial':e.kind==='extra'?'extra':'regular';
  const details=e.cancelled?'Cancelled · '+e.reason+(e.isOverride?' · adjusted from '+e.originalDate+' '+e.originalTime:''):e.isOverride?'Adjusted lesson · original '+e.originalDate+' '+e.originalTime:e.kind==='calendar'?`${e.label}${e.people?' · '+e.people:''}${e.notes?' · '+e.notes:''}`:e.cancelled?`Cancelled · ${e.reason}`:e.kind==='regular'?'Regular lesson':e.label;
  const keys=`data-plan-date="${e.date}" data-plan-time="${e.time}" data-plan-student="${esc(e.studentId||'')}"`;
  const actions=e.kind==='calendar'
   ? `<button type="button" class="secondary" data-calendar-event-edit="${esc(e.calendarEventId)}">Edit event</button>`
   : e.kind==='trial'
   ? `<button type="button" class="secondary" data-plan-task="trial" data-trial-id="${esc(e.trialId)}">Open</button>`
   : e.cancelled
    ? `<button type="button" class="secondary" ${keys} data-plan-task="restore">Restore</button><button type="button" ${keys} data-plan-task="replace">Replace</button>`
    : `<button type="button" class="secondary" ${keys} data-plan-task="open">Open</button><button type="button" class="secondary" ${keys} data-plan-task="edit">Edit lesson</button><button type="button" class="secondary" ${keys} data-plan-task="cancel">Cancel</button><button type="button" ${keys} data-plan-task="replace">Replace</button>`;
  return `<div class="plan-row slot-${kind}"><div class="plan-time">${e.time}</div><div class="plan-details"><strong>${esc(e.name)}</strong><small>${esc(details)} · ${e.duration} min</small></div><div class="plan-actions">${actions}</div></div>`;
 };
 return `<section class="plan-day ${compact?'plan-compact':''}"><h3>${wd} · ${day}</h3>${closures.length?`<div class="holiday-banner"><strong>NO REGULAR LESSONS · ${closures.map(h=>esc(h.label||'Holiday')).join(', ')}</strong><span>Recurring lessons paused. Extra lessons and trials remain possible.</span><button type="button" class="secondary" data-holiday-book="${day}">Book make-up</button></div>`:''}${!closures.length&&hours?`<p class="muted">Teaching hours ${hours.start}–${hours.end}</p>`:compact?'':'<p class="muted">Set teaching hours under Data systems to display every free gap. Cancellations appear even without hours.</p>'}<div class="plan-list">${list.map(row).join('')||'<p class="muted">No scheduled lessons or events.</p>'}</div></section>`;
}

function renderSchedule(){
 const extras=state.appointments.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const rows=list=>list.map(a=>{
  const s=state.students.find(s=>s.id===a.studentId);
  const wasCancelled=state.cancellations.some(c=>c.studentId===a.studentId&&c.date===a.date&&c.time===a.time);
  return `<div class="studentrow ${a.label==='Trial lesson'?'trialrow':''}"><div><strong>${esc(s?.name||'Unknown student')}</strong><p class="muted">${niceDate(a.date)} · ${a.time} · ${a.duration} min${s?.archived?' · Archived':''}${wasCancelled?' · CANCELLED':''}</p><p>${esc(a.label||'Extra lesson')}</p></div><div class="toolbar"><button data-appointment-open="${esc(a.id)}">Open log</button><button class="secondary" data-appointment-edit="${esc(a.id)}">Edit appointment</button></div></div>`;
 }).join('');
 const period=plannerMode==='week'?scheduleWeek(state,plannerDate).map(d=>planDayHTML(d.date,true)).join(''):planDayHTML(plannerDate);
 const externalEvents=(state.calendarEvents||[]).slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const eventRows=items=>items.map(e=>`<div class="studentrow calendar-event-row"><div><strong>${esc(e.title)}</strong><p class="muted">${e.date} · ${e.time} · ${e.duration} min · ${e.type==='recording'?'Recording':e.type==='jam'?'Jam session':'Other event'}</p>${e.people?`<p class="muted">People: ${esc(e.people)}</p>`:''}${e.notes?`<p class="muted">${esc(e.notes)}</p>`:''}</div><div class="toolbar"><button type="button" class="secondary" data-calendar-event-edit="${esc(e.id)}">Edit event</button></div></div>`).join('');
 const holidayList=(state.holidays||[]).slice().sort((a,b)=>a.startDate.localeCompare(b.startDate));
 const holidayRows=holidayList.map(h=>`<div class="holiday-row"><div><strong>${esc(h.label||'Holiday break')}</strong><p class="muted">${h.startDate} – ${h.endDate} · inclusive</p></div><div class="toolbar"><button type="button" class="secondary" data-holiday-edit="${esc(h.id)}">Edit</button><button type="button" class="secondary" data-holiday-remove="${esc(h.id)}">Remove</button></div></div>`).join('');
 $('#schedule').innerHTML=`<div class="sectionhead schedule-head"><div class="schedule-heading"><div class="eyebrow">03 / SCHEDULE ACCESS</div><h2>Schedule</h2></div><div class="schedule-actions" role="group" aria-label="Schedule actions"><button id="addAppointment" type="button">Add appointment</button><button id="addTrial" type="button">Add trial lesson</button><button id="addHoliday" type="button">Holiday break</button></div></div>
 <div class="plan-controls"><div class="plan-date-nav" role="group" aria-label="Date navigation"><button type="button" id="planPrev" class="plan-arrow plan-arrow-prev" aria-label="Previous ${plannerMode}" title="Previous ${plannerMode}"><svg viewBox="0 0 38 28" aria-hidden="true" focusable="false"><path d="M31 3H22L9 14L22 25H31L18 14Z" fill="currentColor"/><rect x="2" y="8" width="4" height="12" rx="1" fill="currentColor"/><path d="M34 4V24" stroke="currentColor" stroke-width="1.6" opacity=".52"/></svg></button><label class="plan-date-field">DATE<input id="plannerDate" type="text" data-calendar-date maxlength="10" placeholder="YYYY-MM-DD" value="${plannerDate}"></label><button type="button" id="planNext" class="plan-arrow plan-arrow-next" aria-label="Next ${plannerMode}" title="Next ${plannerMode}"><svg viewBox="0 0 38 28" aria-hidden="true" focusable="false"><path d="M7 3H16L29 14L16 25H7L20 14Z" fill="currentColor"/><rect x="32" y="8" width="4" height="12" rx="1" fill="currentColor"/><path d="M4 4V24" stroke="currentColor" stroke-width="1.6" opacity=".52"/></svg></button></div><div class="plan-mode-switch" role="group" aria-label="Schedule display"><button type="button" id="planToday" class="plan-today">Today</button><button type="button" id="planDay" aria-pressed="${plannerMode==='day'}">Day</button><button type="button" id="planWeek" aria-pressed="${plannerMode==='week'}">Week</button></div></div>
 <div class="plan-legend"><span class="plan-key slot-regular">Regular</span><span class="plan-key slot-trial">Trial lesson</span><span class="plan-key slot-extra">Extra / make-up</span><span class="plan-key slot-cancelled">Cancelled</span><span class="plan-key slot-available">Available</span></div>
 <div class="plan-days">${period}</div>
 <details class="calendar-events-register"><summary>Other events · Recording / Jam / More (${externalEvents.length})</summary>
 <p class="muted">Independent calendar events. No student profile, trial-lesson record or make-up credits are created.</p>
 <div class="toolbar"><button type="button" id="addCalendarEventInline" class="secondary">Add other event</button></div>
 <h3 class="dayheading">Upcoming</h3>${eventRows(externalEvents.filter(e=>e.date>=localDate()))||'<p class="muted">No upcoming events.</p>'}
 <details><summary>Past events</summary>${eventRows(externalEvents.filter(e=>e.date<localDate()).reverse())||'<p class="muted">No past events.</p>'}</details>
 </details>
 <details class="holiday-settings"><summary>Holiday breaks / closures (${holidayList.length})</summary>
 <p class="muted">From–to dates are inclusive. Regular weekly and fortnightly lessons are paused; booked extras and trial lessons stay visible. Removing a break restores the underlying recurring schedule.</p>
 <div class="toolbar"><button id="addHolidayInline" type="button" class="secondary">Add holiday break</button></div>
 ${holidayRows||'<p class="muted">No holiday breaks recorded.</p>'}</details>
 <details class="plan-archives"><summary>Full records · upcoming/past bookings · recurring roster</summary>
 ${trialScheduleHTML()}
 <h3 class="dayheading">Extra appointments / upcoming</h3>${rows(extras.filter(a=>a.date>=localDate()))||'<p class="muted">No extra appointments scheduled.</p>'}
 <details><summary>Past extra appointments</summary>${rows(extras.filter(a=>a.date<localDate()).reverse())||'<p class="muted">No past appointments.</p>'}</details>
 <h3 class="dayheading">Recurring timetable</h3>${[1,2,3,4,5,6,0].map(day=>`<h3 class="dayheading">${DAYS[day]}</h3>${studentRows(state.students.filter(s=>!s.archived&&scheduleType(s)!=='flexible'&&s.day===day).sort((a,b)=>a.time.localeCompare(b.time)))||'<p class="muted">No lessons scheduled.</p>'}`).join('')}
 <h3 class="dayheading">Flexible / by appointment</h3>${studentRows(state.students.filter(s=>!s.archived&&scheduleType(s)==='flexible'))||'<p class="muted">No flexible students.</p>'}
 </details>`;
 $('#addAppointment').onclick=()=>editAppointment(null,plannerDate);
 $('#addTrial').onclick=()=>editTrial();
 $('#addCalendarEventInline').onclick=()=>editCalendarEvent(null,plannerDate);
 document.querySelectorAll('[data-calendar-event-edit]').forEach(b=>b.onclick=()=>{const event=(state.calendarEvents||[]).find(e=>e.id===b.dataset.calendarEventEdit);if(event)editCalendarEvent(event);else notice('This event is no longer available.');});
 $('#addHoliday').onclick=()=>editHoliday();
 $('#addHolidayInline').onclick=()=>editHoliday();
 document.querySelectorAll('[data-holiday-edit]').forEach(b=>b.onclick=()=>editHoliday(state.holidays.find(h=>h.id===b.dataset.holidayEdit)));
 document.querySelectorAll('[data-holiday-remove]').forEach(b=>b.onclick=()=>removeHoliday(state.holidays.find(h=>h.id===b.dataset.holidayRemove)));
 document.querySelectorAll('[data-holiday-book]').forEach(b=>b.onclick=()=>editAppointment(null,b.dataset.holidayBook));
 const rebuildPlanner=()=>{renderSchedule();viewMotion.play('schedule');};
 $('#planPrev').onclick=()=>{plannerDate=planDateShift(plannerDate,plannerMode==='week'?-7:-1);rebuildPlanner();};
 $('#planNext').onclick=()=>{plannerDate=planDateShift(plannerDate,plannerMode==='week'?7:1);rebuildPlanner();};
 $('#planToday').onclick=()=>{plannerDate=localDate();rebuildPlanner();};
 $('#planDay').onclick=()=>{plannerMode='day';rebuildPlanner();};
 $('#planWeek').onclick=()=>{plannerMode='week';rebuildPlanner();};
 $('#plannerDate').onchange=e=>{if(!e.target.value||!e.target.reportValidity())return;plannerDate=e.target.value;rebuildPlanner();};
 bindTrials();bindRows();
 document.querySelectorAll('[data-appointment-edit]').forEach(b=>b.onclick=()=>editAppointment(state.appointments.find(a=>a.id===b.dataset.appointmentEdit)));
 document.querySelectorAll('[data-appointment-open]').forEach(b=>b.onclick=()=>{const a=state.appointments.find(a=>a.id===b.dataset.appointmentOpen);trialId=null;studentId=a.studentId;date=a.date;time=a.time;duration=a.duration;manual=true;view='journal';render();});
 bindPlanActions();
 bindDateTimeFields($('#schedule'));
}

function bindPlanActions(){
 document.querySelectorAll('[data-plan-task]').forEach(b=>b.onclick=async()=>{
  if(!await ready())return;
  const task=b.dataset.planTask;
  if(task==='trial'){
   trialId=b.dataset.trialId;studentId=null;manual=true;view='journal';render();return;
  }
  const key={studentId:b.dataset.planStudent,date:b.dataset.planDate,time:b.dataset.planTime};
  const event=dayEvents(state,key.date).find(e=>e.studentId===key.studentId&&e.time===key.time);
  if(!event){notice('This booking changed. Reload the schedule.');return;}
  if(task==='open'){studentId=key.studentId;trialId=null;date=key.date;time=key.time;duration=event.duration;manual=true;view='journal';render();return;}
  if(task==='edit'){
   if(event.kind==='regular'){editSingleLesson(event);}
   else if(event.appointmentId){editAppointment(state.appointments.find(a=>a.id===event.appointmentId));}
   else notice('Edit this booking in its original record.');
   return;
  }
  if(task==='cancel'){
   dialog(`<form><h2>Cancel one lesson</h2><p>${esc(event.name)} · ${key.date} ${key.time}. Next week stays booked. Existing lesson notes are preserved.</p><label>CANCELLED BY<select name="cancelledBy" required><option value="student" selected>Student cancelled (no credit)</option><option value="teacher">Me / teacher (+1 make-up lesson)</option></select></label><label>REASON<select name="reason"><option value="sick">Sick</option><option value="cancelled" selected>Cancelled</option><option value="vacation">Vacation</option><option value="other">Other</option></select></label><p class="muted">Only a teacher cancellation adds one make-up lesson owed to this student. Student cancellations do not change the balance.</p><div class="toolbar"><button type="submit">Cancel this date only</button><button type="button" class="secondary" data-close>Keep lesson</button></div></form>`,async f=>{
    await change(s=>{cancelLesson(s,key,f.get('reason'),f.get('cancelledBy'));validateBackup(s);});
    if(!manual)automatic();
   });return;
  }
  if(task==='restore'){
   dialog(`<form><h2>Restore lesson</h2><p>Restore ${esc(event.name)} on ${key.date} at ${key.time}? Conflicting bookings cannot be restored over another student.</p><div class="toolbar"><button type="submit">Restore lesson</button><button type="button" class="secondary" data-close>Keep cancelled</button></div></form>`,async()=>{
    await change(s=>{restoreLesson(s,key);validateBackup(s);});
    if(!manual)automatic();
   });return;
  }
  if(task==='replace'){
   const students=state.students.filter(s=>!s.archived&&s.id!==key.studentId);
   if(!students.length){notice('Add another active student before replacing a lesson.');return;}
   dialog(`<form><h2>Replace student</h2><p>${esc(event.name)} · ${key.date} ${key.time} · ${event.duration} min. Cancels only this one lesson and books a replacement.</p><label>REPLACEMENT STUDENT<select name="studentId">${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><label>ORIGINAL LESSON CANCELLED BY<select name="cancelledBy" required><option value="student" selected>Student cancelled (no credit)</option><option value="teacher">Me / teacher (+1 make-up lesson)</option></select></label><label>REASON FOR ORIGINAL CANCELLATION<select name="reason"><option value="sick">Sick</option><option value="cancelled" selected>Cancelled</option><option value="vacation">Vacation</option><option value="other">Other</option></select></label><p class="muted">Both changes happen in one transaction. Conflicting bookings are rejected. All past lesson notes remain untouched.</p><div class="toolbar"><button type="submit">Replace at this time</button><button type="button" class="secondary" data-close>Back</button></div></form>`,async f=>{
    await change(s=>{bookReplacement(s,key,f.get('studentId'),f.get('reason'),f.get('cancelledBy'));validateBackup(s);});
    if(!manual)automatic();
   });
  }
 });
 document.querySelectorAll('[data-free-book]').forEach(b=>b.onclick=async()=>{
  if(!await ready())return;
  const active=state.students.filter(s=>!s.archived);
  if(!active.length){notice('Add an active student to book an available slot.');return;}
  const date=b.dataset.freeBook,start=b.dataset.freeStart,end=b.dataset.freeEnd,first=active[0];
  const length=(Number(end.slice(0,2))*60+Number(end.slice(3)))-(Number(start.slice(0,2))*60+Number(start.slice(3)));
  dialog(`<form><h2>Book free slot</h2><p>${date} · ${start}–${end} (${length} min available).</p><label>STUDENT<select name="studentId" id="freeStudent">${active.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><div class="fields"><label>START<input name="time" type="text" data-clock-time maxlength="5" value="${start}" required></label><label>MINUTES<input name="duration" type="number" min="1" max="${Math.min(length,1440)}" value="${Math.min(first.duration,length)}" required></label></div><label>LESSON TYPE<select name="label" id="freeLessonType"><option value="Make-up lesson" ${(first.makeupBalance??0)>0?'selected':''}>Make-up lesson (redeem 1 credit now)</option><option value="Extra lesson" ${(first.makeupBalance??0)===0?'selected':''}>Extra lesson (no credit used)</option></select></label><p id="freeCreditStatus" class="muted">Make-up balance: ${first.makeupBalance??0}. Booking a make-up lesson immediately uses 1 credit. Teacher cancellations refund it; student cancellations do not.</p><div class="toolbar"><button type="submit">Book lesson</button><button type="button" class="secondary" data-close>Back</button></div></form>`,async f=>{
   await change(s=>{bookFreeSlot(s,f.get('studentId'),date,f.get('time'),Number(f.get('duration')),f.get('label'));validateBackup(s);});
   if(!manual)automatic();
  });
  $('#freeStudent').onchange=e=>{
   const person=active.find(s=>s.id===e.target.value);
   $('#modal input[name="duration"]').value=Math.min(person.duration,length);
   $('#freeLessonType').value=(person.makeupBalance??0)>0?'Make-up lesson':'Extra lesson';
   $('#freeCreditStatus').textContent='Make-up balance: '+(person.makeupBalance??0)+'. Booking a make-up lesson immediately uses 1 credit. Teacher cancellations refund it; student cancellations do not.';
  };
 });
}
function editHoliday(holiday=null){
 const current=holiday||{startDate:plannerDate,endDate:plannerDate,label:'Holidays'};
 dialog(`<form><h2>${holiday?'Edit holiday break':'Add holiday break'}</h2>
 <label>LABEL<input name="label" maxlength="200" value="${esc(current.label)}" placeholder="Holidays / School closed"></label>
 <div class="fields holiday-date-fields"><label>FROM (INCLUSIVE)<input type="text" name="startDate" data-calendar-date maxlength="10" placeholder="YYYY-MM-DD" value="${current.startDate}" required></label>
 <label>TO (INCLUSIVE)<input type="text" name="endDate" data-calendar-date maxlength="10" placeholder="YYYY-MM-DD" value="${current.endDate}" required></label></div>
 <p class="muted">Regular weekly and fortnightly lessons are paused for every day in this range. Extra bookings, trials and existing lesson records stay untouched. You can still add an explicit make-up appointment.</p>
 <div class="toolbar"><button type="submit">Save holiday break</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`,async fields=>{
  const item={id:holiday?.id||crypto.randomUUID(),label:fields.get('label').trim(),
   startDate:fields.get('startDate'),endDate:fields.get('endDate')};
  if(!validDate(item.startDate)||!validDate(item.endDate)||item.startDate>item.endDate)throw Error('Holiday end date must be on or after the start date.');
  await change(s=>{
   if(holiday&&!s.holidays.some(h=>h.id===holiday.id))throw Error('This holiday break no longer exists. Reload the schedule.');
   s.holidays=[...s.holidays.filter(h=>h.id!==item.id),item];validateBackup(s);
  });
  if(!manual)automatic();
 });
}
function removeHoliday(holiday){
 if(!holiday)return;
 dialog(`<form><h2>Remove holiday break</h2>
 <p>Remove ${esc(holiday.label||'Holiday break')} · ${holiday.startDate} through ${holiday.endDate}?
 Regular lessons will return on their scheduled dates. Extra bookings, trials and past notes stay unchanged.</p>
 <div class="toolbar"><button type="submit" class="danger">Remove holiday break</button><button type="button" class="secondary" data-close>Keep</button></div></form>`,async()=>{
  await change(s=>{if(!s.holidays.some(h=>h.id===holiday.id))throw Error('Holiday break no longer exists.');s.holidays=s.holidays.filter(h=>h.id!==holiday.id);validateBackup(s);});
  if(!manual)automatic();
 });
}
function editSingleLesson(event){
 const origin={studentId:event.studentId,date:event.originalDate||event.date,
  time:event.originalTime||event.time};
 const previouslyAdjusted=!!event.isOverride;
 dialog(`<form><h2>Edit one lesson</h2>
 <p>${esc(event.name)} · Regular slot ${origin.date} ${origin.time}. Only this occurrence changes. Other weeks and outstanding make-up credits stay untouched.</p>
 <label>DATE<input name="date" type="text" data-calendar-date maxlength="10" placeholder="YYYY-MM-DD" value="${event.date}" required></label>
 <div class="fields"><label>START<input name="time" type="text" data-clock-time maxlength="5" placeholder="HH:mm" value="${event.time}" required></label>
 <label>MINUTES<input name="duration" type="number" min="1" max="1440" value="${event.duration}" required></label></div>
 <p class="muted">For a double lesson, enter 90 minutes (or your usual double length). Another booking at the destination will block this change. Existing journal notes stay linked to the original lesson record.</p>
 <div class="toolbar"><button type="submit">Save this lesson only</button><button type="button" class="secondary" data-close>Back</button>${previouslyAdjusted?'<button type="button" class="secondary" id="resetSingleLesson">Reset to regular schedule</button>':''}</div></form>`,
 async f=>{
  await change(s=>{saveLessonOverride(s,origin,{date:f.get('date'),time:f.get('time'),duration:Number(f.get('duration'))});validateBackup(s);});
  if(!manual)automatic();
 });
 if(previouslyAdjusted)$('#resetSingleLesson').onclick=()=>{
  $('#modal').close();
  dialog(`<form><h2>Reset one lesson?</h2><p>Return ${esc(event.name)} on ${origin.date} at ${origin.time} to the student's current regular duration? The student schedule, makeup credits and notes remain unchanged.</p>
  <div class="toolbar"><button type="submit">Reset this date</button><button type="button" class="secondary" data-close>Keep adjustment</button></div></form>`,
  async()=>{await change(s=>{resetLessonOverride(s,origin);validateBackup(s);});if(!manual)automatic();});
 };
}
function editCalendarEvent(existing=null,presetDate=null){
 const x=existing||{title:'',type:'recording',date:presetDate||plannerDate,time:'15:00',duration:60,people:'',notes:''};
 dialog(`<form><h2>${existing?'Edit event':'Add other event'}</h2>
 <p class="muted">Recording, jam sessions and other appointments without a student record. Repeated names are allowed. No trial conversion or make-up credits.</p>
 <label>TITLE<input name="title" value="${esc(x.title)}" maxlength="200" placeholder="Recording session / Band rehearsal" required autofocus></label>
 <label>TYPE<select name="type"><option value="recording" ${x.type==='recording'?'selected':''}>Recording session</option><option value="jam" ${x.type==='jam'?'selected':''}>Jam / Making music together</option><option value="other" ${x.type==='other'?'selected':''}>Other event</option></select></label>
 <label>DATE<input name="date" type="text" data-calendar-date maxlength="10" placeholder="YYYY-MM-DD" value="${x.date}" required></label>
 <div class="fields holiday-date-fields"><label>START<input name="time" type="text" data-clock-time maxlength="5" placeholder="HH:mm" value="${x.time}" required></label><label>MINUTES<input name="duration" type="number" min="1" max="1440" value="${x.duration}" required></label></div>
 <label>WHO'S COMING (OPTIONAL)<input name="people" value="${esc(x.people)}" maxlength="2000" placeholder="Names / band"></label>
 <label>NOTES (OPTIONAL)<textarea name="notes" maxlength="200000" rows="3">${esc(x.notes)}</textarea></label>
 <p class="muted">Events appear in the Schedule and block availability. Conflicting appointments are rejected before saving. Holidays do not remove them.</p>
 <div class="toolbar"><button type="submit">Save event</button><button type="button" class="secondary" data-close>Back</button>${existing?'<button type="button" class="danger" id="removeCalendarEvent">Delete event</button>':''}</div></form>`,async fields=>{
  const item={id:existing?.id||crypto.randomUUID(),title:fields.get('title').trim(),type:fields.get('type'),
   date:fields.get('date'),time:fields.get('time'),duration:Number(fields.get('duration')),
   people:fields.get('people').trim(),notes:fields.get('notes')};
  await change(st=>{if(existing&&!(st.calendarEvents||[]).some(e=>e.id===existing.id))throw Error('Event no longer exists.');saveCalendarEvent(st,item);validateBackup(st);});
 });
 if(existing)$('#removeCalendarEvent').onclick=()=>{
  $('#modal').close();
  dialog(`<form><h2>Delete event?</h2><p>Remove ${esc(existing.title)} on ${existing.date} at ${existing.time}? No lesson records are affected.</p>
   <div class="toolbar"><button type="submit" class="danger">Delete event</button><button type="button" class="secondary" data-close>Keep event</button></div></form>`,
  async()=>{await change(st=>{removeCalendarEvent(st,existing.id);validateBackup(st);});});
 };
}
function editAppointment(a,presetDate=null){
 if(!state.students.length){editCalendarEvent(null,presetDate);return;}
 const x=a||{studentId:studentId||state.students.find(s=>!s.archived)?.id||state.students[0].id,date:presetDate||localDate(),time:'15:00',duration:45,label:''};
 dialog(`<form><h2>${a?'Edit appointment':'Extra appointment'}</h2>${a?'':'<div class="toolbar"><button type="button" class="secondary" id="switchToCalendarEvent">Recording / Jam / Other (no student)</button></div>'}<label>STUDENT<select name="studentId" id="appointmentStudent">${state.students.map(s=>`<option value="${esc(s.id)}" ${s.id===x.studentId?'selected':''}>${esc(s.name)}${s.archived?' (archived)':''}</option>`).join('')}</select></label><label>DATE<input name="date" type="text" data-calendar-date placeholder="YYYY-MM-DD" title="Date: YYYY-MM-DD" maxlength="10" autocomplete="off" value="${x.date}" required></label><div class="fields"><label>START<input name="time" type="text" data-clock-time placeholder="HH:mm" title="24-hour time: HH:mm" maxlength="5" autocomplete="off" value="${x.time}" required></label><label>MINUTES<input id="appointmentDuration" name="duration" type="number" min="1" max="1440" value="${a?x.duration:state.students.find(s=>s.id===x.studentId).duration}" required></label></div><label>LESSON TYPE<select id="appointmentType" name="appointmentType"><option value="extra" ${!x.label||x.label==='Extra lesson'?'selected':''}>Extra lesson (no credit)</option><option value="makeup" ${isMakeupLesson(x.label)?'selected':''}>Make-up lesson (redeem 1 credit when booked)</option><option value="custom" ${x.label&&x.label!=='Extra lesson'&&!isMakeupLesson(x.label)?'selected':''}>Other / custom label</option></select></label><label id="customAppointmentLabel">CUSTOM LABEL<input id="appointmentLabel" name="customLabel" maxlength="200" value="${esc(x.label||'')}" placeholder="Optional description"></label><p class="muted">Make-up lessons consume 1 owed credit immediately when booked, not after attendance. Teacher cancellations return it; student cancellations do not. Changing an active booking or removing it before cancellation returns the credit.</p><div class="toolbar"><button type="submit">Save appointment</button><button type="button" class="secondary" data-close>Cancel</button>${a?'<button type="button" class="danger" id="removeAppointment">Remove appointment</button>':''}</div></form>`,async f=>{
  const type=f.get('appointmentType');
  const label=type==='makeup'?'Make-up lesson':type==='extra'?'Extra lesson':f.get('customLabel').trim();
  const item={id:a?.id||crypto.randomUUID(),studentId:f.get('studentId'),date:f.get('date'),time:f.get('time'),duration:Number(f.get('duration')),label};
  await change(st=>{saveAppointment(st,item);validateBackup(st);});
 });
 if(!a)$('#switchToCalendarEvent').onclick=()=>{$('#modal').close();editCalendarEvent(null,presetDate);};
 const showLabel=()=>{const custom=$('#appointmentType').value==='custom';$('#customAppointmentLabel').hidden=!custom;$('#appointmentLabel').disabled=!custom;};
 $('#appointmentType').onchange=showLabel;showLabel();
 $('#appointmentStudent').onchange=e=>{$('#appointmentDuration').value=state.students.find(s=>s.id===e.target.value).duration;};
 if(a)$('#removeAppointment').onclick=()=>{$('#modal').close();dialog(`<form><h2>Remove appointment</h2><p>Remove this appointment on ${niceDate(a.date)} at ${a.time}? Existing lesson notes remain available in the journal.</p><div class="toolbar"><button class="danger" type="submit">Remove appointment</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`,async()=>{await change(st=>{removeAppointment(st,a.id);validateBackup(st);});});};
}
function dialog(html,onSubmit){
 const m=$('#modal');clearDialogError();clearNotice();clearGlobalError();
 m.innerHTML=html;bindDateTimeFields(m);m.showModal();
 // Reassigned (not accumulated) each time. Escape, Cancel and successful
 // submit all fire 'close', and editing any field clears stale validation.
 m.onclose=clearDialogError;
 m.oninput=clearDialogError;
 m.onchange=clearDialogError;
 if(m.querySelector('.danger'))sounds.play('warning');
 m.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>m.close());
 const f=m.querySelector('form');
 if(f)f.onsubmit=async e=>{
  e.preventDefault();if(!f.reportValidity())return;
  const button=f.querySelector('[type=submit]');if(button)button.disabled=true;
  try{await onSubmit(new FormData(f));sounds.play('accept');m.close();clearGlobalError();render();}
  catch(e){error(e);}
  finally{if(button)button.disabled=false;}
 };
}
function editStudent(s,trial=null){
 const x=s||(trial?{name:trial.name,day:new Date(trial.date+'T12:00:00').getDay(),time:trial.time,duration:trial.duration,remarks:'',archived:false}:{name:'',day:1,time:'15:00',duration:45,remarks:'',archived:false});
 dialog(`<form><h2>${trial?'Convert trial to student':s?'Edit student':'New student'}</h2><label>NAME<input name="name" value="${esc(x.name)}" maxlength="200" required autofocus></label>
 <label>LESSON SCHEDULE<select name="schedule" id="scheduleType"><option value="weekly" ${scheduleType(x)==='weekly'?'selected':''}>Weekly</option><option value="biweekly" ${scheduleType(x)==='biweekly'?'selected':''}>Every 2 weeks</option><option value="flexible" ${scheduleType(x)==='flexible'?'selected':''}>Flexible / no fixed schedule</option></select></label>
 <label id="weekdayField">TEACHING DAY<select name="day">${[1,2,3,4,5,6,0].map(d=>`<option value="${d}" ${d===x.day?'selected':''}>${DAYS[d]}</option>`).join('')}</select></label>
 <label id="anchorField">FIRST LESSON / CYCLE START<input name="anchorDate" type="text" data-calendar-date placeholder="YYYY-MM-DD" title="Date: YYYY-MM-DD" maxlength="10" autocomplete="off" value="${esc(x.anchorDate||localDate())}"></label>
 <p id="scheduleHelp" class="muted"></p><div class="fields"><label id="startField">START<input name="time" type="text" data-clock-time placeholder="HH:mm" title="24-hour time: HH:mm" maxlength="5" autocomplete="off" value="${x.time||'15:00'}"></label><label>MINUTES<input name="duration" type="number" min="1" max="1440" value="${x.duration}" required></label></div>
 <p class="muted">Schedule changes apply to future selection only. Existing lesson dates, start times and durations remain unchanged.</p>
 <label>MAKE-UP LESSONS OWED<input name="makeupBalance" type="number" min="0" max="9999" step="1" value="${x.makeupBalance??0}" required></label><p class="muted">Teacher cancellations add +1; student cancellations add nothing. Booking a make-up lesson immediately uses 1 owed credit. If you cancel it, the credit returns; if the student cancels it, it stays spent. You can still correct this number manually.</p><label>STUDENT NOTES<textarea name="remarks" maxlength="200000">${esc(x.remarks)}</textarea></label>${s?`<label class="check"><input type="checkbox" name="archived" ${x.archived?'checked':''}>Archived (keep all lessons)</label>`:''}<div class="toolbar"><button type="submit">Save student</button><button type="button" class="secondary" data-close>Cancel</button>${s?'<button type="button" class="danger" id="deleteStudent">Delete</button>':''}</div></form>`,async f=>{
 const type=f.get('schedule'),anchorDate=f.get('anchorDate');
 const item={id:s?.id||crypto.randomUUID(),name:f.get('name').trim(),schedule:type,day:type==='flexible'?null:type==='biweekly'?new Date(anchorDate+'T12:00:00').getDay():Number(f.get('day')),time:type==='flexible'?null:f.get('time'),duration:Number(f.get('duration')),remarks:f.get('remarks'),makeupBalance:Number(f.get('makeupBalance')),archived:f.has('archived'),...(type==='biweekly'?{anchorDate}:{})};
 if(!item.name)throw Error('Please enter a name.');
 // Validate the draft in isolation: the real state may contain overrides for
 // other students. A one-student fixture must not inherit those references.
 validateBackup({...defaults(),students:[item]});
 if(trial){let entry;await change(st=>{entry=convertTrial(st,trial.id,item,crypto.randomUUID());});trialId=null;studentId=item.id;date=entry.date;time=entry.time;duration=entry.duration;manual=true;view='journal';}else{
 const balanceEdited=!!s&&item.makeupBalance!==(s.makeupBalance??0);
 await change(st=>{const i=st.students.findIndex(y=>y.id===item.id);
  if(s&&i<0)throw Error('Student record no longer exists.');
  if(i<0)st.students.push(item);
  else st.students[i]={...item,makeupBalance:balanceEdited?item.makeupBalance:(st.students[i].makeupBalance??0)};
  validateBackup(st);
 });
 if(!studentId&&!trialId)automatic();
}
 });
 const updateScheduleFields=()=>{const type=$('#scheduleType').value;for(const [id,show] of [['weekdayField',type==='weekly'],['anchorField',type==='biweekly'],['startField',type!=='flexible']]){const field=$('#'+id);field.hidden=!show;const input=field.querySelector('input,select');input.disabled=!show;input.required=show;}$('#scheduleHelp').textContent=type==='biweekly'?'The first lesson date sets the weekday and alternating weeks. No automatic lessons before this date.':type==='flexible'?'No automatic weekly selection. Open the student log and choose the actual lesson date and time.':'Repeats on the selected weekday each week.';};
 $('#scheduleType').onchange=updateScheduleFields;updateScheduleFields();
 if(s)$('#deleteStudent').onclick=async()=>{$('#modal').close();dialog(`<form><h2>Delete student record</h2><p>Permanently delete <strong>${esc(s.name)}</strong> and all associated lesson records? This cannot be undone. Export a backup before proceeding.</p><label class="check"><input type="checkbox" required>Confirm permanent deletion</label><div class="toolbar"><button type="submit" class="danger">Delete record</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`,async()=>{await change(st=>{st.students=st.students.filter(x=>x.id!==s.id);st.lessons=st.lessons.filter(x=>x.studentId!==s.id);st.appointments=st.appointments.filter(x=>x.studentId!==s.id);st.cancellations=st.cancellations.filter(x=>x.studentId!==s.id);st.lessonOverrides=st.lessonOverrides.filter(x=>x.studentId!==s.id);});if(studentId===s.id)automatic();});};}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportBackup(){if(!await ready())return;state=await readState();const stamp=new Date().toISOString();const out={...state,settings:{...state.settings,lastBackup:stamp},exportedAt:stamp,application:'Drum Log'};download('drum-log-backup-'+localDate()+'.json',JSON.stringify(out,null,2),'application/json');await change(s=>s.settings.lastBackup=stamp);notice('Backup download started. Keep the file somewhere safe and verify it was saved.','accept');if(view==='settings')renderSettings();}
function teachingHoursHTML(){
 const hours=state.settings.teachingHours||Array(7).fill(null);
 return `<article class="panel"><h3>Teaching hours / availability</h3><p class="muted">Optional. Set actual working windows for each weekday. Empty days are not considered bookable, except for explicitly cancelled lessons. This is not a public booking calendar.</p><form id="teachingHoursForm">
 ${[1,2,3,4,5,6,0].map(day=>{const h=hours[day];return `<div class="teaching-hours-row"><label class="check"><input type="checkbox" name="enabled${day}" data-hours-toggle="${day}" ${h?'checked':''}>${DAYS[day]}</label><label>From<input type="text" name="start${day}" data-clock-time maxlength="5" placeholder="HH:mm" value="${h?.start||'09:00'}" ${h?'':'disabled'} required></label><label>To<input type="text" name="end${day}" data-clock-time maxlength="5" placeholder="HH:mm" value="${h?.end||'18:00'}" ${h?'':'disabled'} required></label></div>`}).join('')}
 <div class="toolbar"><button type="submit">Save teaching hours</button></div><p class="muted">Times can be adjusted independently for each day. Existing lessons outside those hours stay in the schedule.</p></form></article>`;
}
function renderSettings(){$('#settings').innerHTML=`<div class="sectionhead"><div><div class="eyebrow">04 / SYSTEM OPERATIONS</div><h2>Data systems</h2><p class="muted">Local database / manual transfer only</p></div></div><div class="settingsgrid"><div><article class="panel"><h3>LCARS Display Theme</h3><label for="appTheme">Active console palette</label><select id="appTheme"><option value="voyager" ${normalizeTheme(state.settings.theme)==='voyager'?'selected':''}>USS Voyager</option><option value="elite" ${state.settings.theme==='elite'?'selected':''}>Elite Force</option><option value="redalert" ${state.settings.theme==='redalert'?'selected':''}>Red Alert</option></select><p class="muted">Applies immediately to the entire console and is stored with your backup. You can also change it at launch.</p></article><article class="panel"><h3>Audio interface</h3><label class="check"><input id="soundEnabled" type="checkbox" ${state.settings.soundEnabled!==false?'checked':''}>Enable LCARS sounds</label><label class="check"><input id="launchScreen" type="checkbox" ${state.settings.launchScreen!==false?'checked':''}>Show INITIALIZE DRUM LOG on startup</label><p class="muted">On by default. Disable to open the teaching console directly. The initialize button enables launch audio where browsers permit it.</p><label for="soundVolume">Output level <output id="volumeValue">${Math.round((state.settings.soundVolume??0.35)*100)}%</output></label><input id="soundVolume" type="range" min="0" max="100" step="1" value="${Math.round((state.settings.soundVolume??0.35)*100)}"><button id="testSound" class="secondary">Test sound</button><p id="audioStatus" class="muted" role="status">${esc(sounds.status())}</p><p class="muted">Hover / touch · commands · confirmations · alerts. Audio activates after your first tap or key press.</p></article><article class="panel"><h3>Mobile display</h3><p class="muted">Compact one-window layout on phones only. Tablet and desktop stay at normal size. Scroll inside lists or history when necessary.</p><label for="mobileScale">Phone UI size <output id="mobileScaleValue">${state.settings.uiScale??80}%</output></label><input id="mobileScale" type="range" min="65" max="100" step="5" value="${state.settings.uiScale??80}"><p class="muted">Recommended: 75–80%. Text entry stays readable to prevent iPhone Safari zooming when the keyboard opens.</p></article>${teachingHoursHTML()}<article class="panel peach"><h3>Archive / transfer</h3><p class="muted">A full JSON backup restores students, lessons, shortcuts and settings. Devices keep separate databases.</p><div class="toolbar"><button id="exportJSON">Export JSON backup</button><button class="secondary" id="importJSON">Import backup</button></div><p class="muted">Last backup download: ${state.settings.lastBackup?formatTimestamp(new Date(state.settings.lastBackup)):'Not yet'}</p><label class="check"><input id="reminder" type="checkbox" ${state.settings.backupReminder?'checked':''}>Remind me to back up every 7 days</label><h3>CSV data export</h3><p class="muted">UTF-8 CSV · semicolon separated · Excel / LibreOffice</p><div class="toolbar"><button class="secondary" id="csvLessons">Export lessons CSV</button><button class="secondary" id="csvStudents">Export students CSV</button><button class="secondary" id="csvAppointments">Export appointments CSV</button><button class="secondary" id="csvTrials">Export trials CSV</button></div><input id="importFile" type="file" accept=".json,application/json" hidden></article><article class="panel"><h3>Storage status</h3><p id="storageInfo" class="muted">Checking storage…</p><button class="secondary" id="persist">Request persistent storage</button><p class="muted">Browser storage is not a backup. Clearing site data can delete everything. Use your device passcode and disk encryption for access protection. This app does not encrypt local records or exported files.</p><h3>Offline deployment</h3><p class="muted">Host these files over HTTPS. On iPhone, open in Safari → Share → Add to Home Screen. Open the installed app once online and wait for “Offline ready”. Then test in airplane mode. On Firefox, bookmark the app; a desktop installation is optional.</p><p id="offlineInfo" class="muted" role="status"></p><button id="updateCheck" class="secondary" type="button">Check for updates</button><p class="muted">Updates change app files only, never student records. Save notes and close other Drum Log tabs before installing. No automatic reload.</p></article></div><article class="panel"><h3>Text commands</h3><p class="muted">Cursor insertion / configurable text commands</p><div id="snippetList">${state.snippets.map((x,i)=>`<div class="snippetrow"><strong>${esc(x.label)}</strong><button class="secondary" data-up="${esc(x.id)}" aria-label="Move ${esc(x.label)} up" ${i===0?'disabled':''}>↑</button><button class="secondary" data-down="${esc(x.id)}" aria-label="Move ${esc(x.label)} down" ${i===state.snippets.length-1?'disabled':''}>↓</button><button class="secondary" data-snippet-edit="${esc(x.id)}">Edit</button></div>`).join('')}</div><button id="addSnippet">Add shortcut</button></article></div>`;
 $('#appTheme').onchange=async e=>{const chosen=normalizeTheme(e.target.value);try{await change(s=>{s.settings.theme=chosen;});sounds.play('press');}catch(ex){applyTheme(document,state.settings.theme);error(ex);}};
 $('#launchScreen').onchange=async e=>{
  const newValue=e.target.checked;
  try{await change(s=>{s.settings.launchScreen=newValue;});}
  catch(ex){e.target.checked=!newValue;error(ex);}
 };
 $('#soundEnabled').onchange=async e=>{const enabled=e.target.checked;sounds.configure({...state.settings,soundEnabled:enabled});if(enabled){sounds.unlock();sounds.play('accept');}await change(s=>s.settings.soundEnabled=enabled);};
 $('#soundVolume').oninput=e=>{const v=Number(e.target.value)/100;$('#volumeValue').textContent=Math.round(v*100)+'%';sounds.configure({...state.settings,soundVolume:v});};
 $('#soundVolume').onchange=async e=>{const v=Number(e.target.value)/100;await change(s=>s.settings.soundVolume=v);sounds.play('hover');};
 $('#mobileScale').oninput=e=>{const value=Number(e.target.value);$('#mobileScaleValue').textContent=value+'%';applyMobileScale(value);};
 $('#mobileScale').onchange=async e=>{const value=Number(e.target.value);try{await change(s=>{s.settings.uiScale=value;});}catch(ex){applyMobileScale(state.settings.uiScale);error(ex);}};
 // Visually identical to Rhythm PADD: native range inputs are MOVED into
 // their segmented shells, so keyboard, touch and save handlers stay intact.
 for(const {id,title,kind,code} of [
  {id:'soundVolume',title:'SOUND / VOLUME',kind:'percent',code:'47-A7'},
  {id:'mobileScale',title:'MOBILE / SIZE',kind:'scale',code:'47-U1'}
 ]){
  const input=$('#'+id),mount=document.createElement('div');
  mount.className='lcars-slider-mount';
  input.before(mount);mount.append(input);
  mountLcarsSlider(input,{kind,title,code});
 }

 const hoursForm=$('#teachingHoursForm');
 hoursForm.querySelectorAll('[data-hours-toggle]').forEach(box=>box.onchange=()=>{
  const day=box.dataset.hoursToggle;
  hoursForm.elements.namedItem('start'+day).disabled=!box.checked;
  hoursForm.elements.namedItem('end'+day).disabled=!box.checked;
 });
 hoursForm.onsubmit=async event=>{
  event.preventDefault();
  if(!hoursForm.reportValidity())return;
  const data=new FormData(hoursForm);
  const hours=Array.from({length:7},(_,day)=>data.has('enabled'+day)?{start:data.get('start'+day),end:data.get('end'+day)}:null);
  if(hours.some(h=>h&&(!validTime(h.start)||!validTime(h.end)||h.start>=h.end))){error(Error('Teaching hours must end after they start, within the same day.'));return;}
  try{
   await change(st=>{st.settings.teachingHours=hours;validateBackup(st);});
   notice('Teaching hours saved. Available slots are now calculated from these times.','accept');
   renderSettings();
  }catch(e){error(e);}
 };
 $('#testSound').onclick=async()=>{const message=await sounds.test();if($('#audioStatus'))$('#audioStatus').textContent=message;};
 $('#exportJSON').onclick=()=>exportBackup().catch(error);$('#importJSON').onclick=()=>$('#importFile').click();$('#importFile').onchange=e=>previewImport(e.target.files[0]);$('#reminder').onchange=e=>change(s=>s.settings.backupReminder=e.target.checked).catch(error);
 $('#csvLessons').onclick=async()=>{state=await readState();download('drum-log-lessons.csv',csv([['Date','Time','Student','Duration (minutes)','Lesson note'],...state.lessons.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(l=>[l.date.split('-').reverse().join('.'),l.time,state.students.find(s=>s.id===l.studentId)?.name||'',l.duration,l.notes])]),'text/csv;charset=utf-8');};
 $('#csvTrials').onclick=()=>download('drum-log-trials.csv',csv([['Name','Date','Time','Duration (minutes)','Contact','Remarks','Notes','Archived'],...state.trials.map(t=>[t.name,t.date.split('-').reverse().join('.'),t.time,t.duration,t.contact,t.remarks,t.notes,t.archived?'Yes':'No'])]),'text/csv;charset=utf-8');
 $('#csvAppointments').onclick=()=>download('drum-log-appointments.csv',csv([['Date','Time','Student','Duration (minutes)','Label'],...state.appointments.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(a=>[a.date.split('-').reverse().join('.'),a.time,state.students.find(s=>s.id===a.studentId)?.name||'',a.duration,a.label])]),'text/csv;charset=utf-8');
 $('#csvStudents').onclick=()=>download('drum-log-students.csv',csv([['Name','Schedule','Cycle start','Day','Time','Duration (minutes)','Remarks','Archived'],...state.students.map(s=>[s.name,scheduleType(s),s.anchorDate||'',scheduleType(s)==='flexible'?'':DAYS[s.day],s.time||'',s.duration,s.remarks,s.archived?'Yes':'No'])]),'text/csv;charset=utf-8');
 $('#persist').onclick=async()=>{try{const yes=await navigator.storage?.persist?.();notice(yes?'Persistent storage granted. Keep making backups.':'Persistent storage was not granted by this browser. Keep regular backups.',yes?'accept':'warning');storageInfo();}catch(e){error(e);}};
 $('#addSnippet').onclick=()=>editSnippet();document.querySelectorAll('[data-snippet-edit]').forEach(b=>b.onclick=()=>editSnippet(state.snippets.find(x=>x.id===b.dataset.snippetEdit)));
 for(const direction of ['up','down'])document.querySelectorAll('[data-'+direction+']').forEach(b=>b.onclick=async()=>{await change(s=>{const i=s.snippets.findIndex(x=>x.id===b.dataset[direction]),j=i+(direction==='up'?-1:1);if(i>=0&&j>=0&&j<s.snippets.length)[s.snippets[i],s.snippets[j]]=[s.snippets[j],s.snippets[i]];});renderSettings();});storageInfo();updater.mount($('#updateCheck'),$('#offlineInfo'));
}
async function storageInfo(){try{const persistent=await navigator.storage?.persisted?.(),estimate=await navigator.storage?.estimate?.();if($('#storageInfo'))$('#storageInfo').textContent=`Persistence: ${persistent?'granted':'not granted / browser managed'}. ${estimate?.usage!==undefined?'Used: '+(estimate.usage/1024/1024).toFixed(2)+' MB.':''}`;}catch{if($('#storageInfo'))$('#storageInfo').textContent='Storage estimate unavailable.';}}
function editSnippet(x){dialog(`<form><h2>${x?'Edit shortcut':'New shortcut'}</h2><label>BUTTON LABEL<input name="label" maxlength="50" value="${esc(x?.label||'')}" required></label><label>TEXT TO INSERT<textarea name="text" rows="6" maxlength="10000" required>${esc(x?.text||'')}</textarea></label><div class="toolbar"><button type="submit">Save shortcut</button><button type="button" class="secondary" data-close>Cancel</button>${x?'<button type="button" class="danger" id="deleteSnippet">Delete</button>':''}</div></form>`,async f=>{const item={id:x?.id||crypto.randomUUID(),label:f.get('label').trim(),text:f.get('text')};if(!item.label)throw Error('Enter a button label.');await change(s=>{const i=s.snippets.findIndex(y=>y.id===item.id);if(i<0)s.snippets.push(item);else s.snippets[i]=item;});});if(x)$('#deleteSnippet').onclick=async()=>{await change(s=>s.snippets=s.snippets.filter(y=>y.id!==x.id));$('#modal').close();renderSettings();};}
async function previewImport(file){if(!file)return;try{if(file.size>20*1024*1024)throw Error('Backup exceeds the 20 MB import limit.');const next=validateBackup(JSON.parse(await file.text()));dialog(`<form><h2>Review backup import</h2><p>This replaces the complete database on this device. It does not merge devices.</p><p><strong>${next.students.length} students · ${next.lessons.length} lessons · ${next.appointments.length} appointments · ${next.trials.length} trials · ${next.snippets.length} shortcuts</strong></p><p>Currently on this device: ${state.students.length} students and ${state.lessons.length} lessons, plus ${state.appointments.length} appointments and ${state.trials.length} trials.</p><button type="button" class="secondary" id="safetyBackup">Download current backup first</button><label class="check"><input type="checkbox" required>I understand that existing data will be replaced.</label><label>TYPE REPLACE TO CONFIRM<input name="confirmation" pattern="REPLACE" required autocomplete="off"></label><div class="toolbar"><button class="danger" type="submit">Replace data</button><button class="secondary" type="button" data-close>Cancel</button></div></form>`,async()=>{if(!await ready())throw Error('Save pending edits first.');state=await replaceState(next);channel?.postMessage('changed');automatic();sounds.configure(state.settings);applyTheme(document,state.settings.theme);applyMobileScale(state.settings.uiScale);notice('Backup restored successfully.','accept');});$('#safetyBackup').onclick=()=>exportBackup().catch(error);}catch(e){error(e);}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
$('#error').title='Tap to dismiss this error';
$('#error').tabIndex=0;
$('#error').onclick=clearGlobalError;
$('#error').onkeydown=e=>{if(e.key==='Enter'||e.key===' '||e.key==='Escape'){e.preventDefault();clearGlobalError();}};
window.addEventListener('unhandledrejection',e=>{error(e.reason||Error('An operation failed.'));});
window.addEventListener('beforeunload',e=>{if(pending||saveFailure){e.preventDefault();e.returnValue='';}});
channel&&(channel.onmessage=()=>{notice('Data changed in another tab. Finish this note before navigating. Avoid editing the same lesson in two tabs.');});
function tick(){$('#clock').textContent=new Date().toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).toUpperCase();}tick();setInterval(tick,30000);
const updater=createUpdateManager({serviceWorker:navigator.serviceWorker,online:()=>navigator.onLine,
 canProceed:async()=>!$('#modal')?.open&&!pending&&!saveFailure&&await ready(),
 reload:()=>location.reload(),onStatus:message=>{
  const e=$('#offlineInfo');if(e)e.textContent=message;
  if(message.startsWith('New LCARS system installed'))sounds.play('update');
 }});
async function offline(){
 if(!('serviceWorker'in navigator)||!isSecureContext){
  $('#storageStatus').textContent='OFFLINE UNAVAILABLE — USE HTTPS OR LOCALHOST';
  return;
 }
 try{
  await updater.register();
  $('#storageStatus').textContent='OFFLINE READY / DATA ON THIS DEVICE';
 }catch(e){
  $('#storageStatus').textContent='OFFLINE SETUP FAILED — REOPEN ONLINE';error(e);
 }
}
try{await openDB();state=await readState();sounds.configure(state.settings);applyTheme(document,state.settings.theme);applyMobileScale(state.settings.uiScale);automatic();render();
  if(state.settings.launchScreen!==false){
   startupConsole.show({
    startAudio:()=>sounds.startLaunch(),
    onEnter:()=>{shellMotion.play();viewMotion.play(view,{boot:true});}
   });
  }else {shellMotion.play();viewMotion.play(view,{boot:true});}
  if(state.settings.backupReminder&&(state.students.length||state.trials.length)&&(!state.settings.lastBackup||Date.now()-Date.parse(state.settings.lastBackup)>7*86400000))notice('Backup interval exceeded. Open Data systems to export a JSON backup.');offline();}catch(e){error(Error('Cannot open local storage. '+e.message));}

function trialScheduleHTML(){
 const list=state.trials.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const upcoming=t=>!t.archived&&+new Date(t.date+'T'+t.time+':00')+t.duration*60000>Date.now();
 const rows=items=>items.map(t=>`<div class="studentrow trialrow"><div><strong>${esc(t.name)}</strong><p class="muted">TRIAL · ${niceDate(t.date)} · ${t.time} · ${t.duration} min${t.archived?' · Archived':''}</p></div><div class="toolbar"><button data-trial-open="${esc(t.id)}">Open trial</button><button class="secondary" data-trial-edit="${esc(t.id)}">Edit</button></div></div>`).join('');
 return `<h3 class="dayheading">Trial lessons / upcoming</h3>${rows(list.filter(upcoming))||'<p class="muted">No upcoming trial lessons.</p>'}<details><summary>Past trials / archive (${list.filter(t=>!upcoming(t)).length})</summary>${rows(list.filter(t=>!upcoming(t)).reverse())||'<p class="muted">No past trials.</p>'}</details>`;
}
function bindTrials(){
 document.querySelectorAll('[data-trial-open]').forEach(b=>b.onclick=async()=>{if(!await ready())return;trialId=b.dataset.trialOpen;studentId=null;manual=true;view='journal';render();});
 document.querySelectorAll('[data-trial-edit]').forEach(b=>b.onclick=()=>editTrial(state.trials.find(t=>t.id===b.dataset.trialEdit)));
}
function editTrial(t){
 const x=t||{name:'',date:localDate(),time:'15:00',duration:45,contact:'',remarks:''};
 dialog(`<form><h2>${t?'Edit trial lesson':'Add trial lesson'}</h2><label>NAME<input name="name" value="${esc(x.name)}" maxlength="200" required autofocus></label><label>DATE<input type="text" data-calendar-date placeholder="YYYY-MM-DD" title="Date: YYYY-MM-DD" maxlength="10" autocomplete="off" name="date" value="${x.date}" required></label><div class="fields"><label>START<input type="text" data-clock-time placeholder="HH:mm" title="24-hour time: HH:mm" maxlength="5" autocomplete="off" name="time" value="${x.time}" required></label><label>MINUTES<input type="number" name="duration" value="${x.duration}" min="1" max="1440" required></label></div><label>CONTACT / OPTIONAL<input name="contact" maxlength="2000" value="${esc(x.contact)}" placeholder="Phone / email / parent contact"></label><label>REMARKS / OPTIONAL<textarea name="remarks" maxlength="200000">${esc(x.remarks)}</textarea></label><p class="muted">No student profile is created. Past trials remain in the archive until you choose to convert them.</p><div class="toolbar"><button type="submit">Save trial</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`,async f=>{
  const item={id:t?.id||crypto.randomUUID(),name:f.get('name').trim(),date:f.get('date'),time:f.get('time'),duration:Number(f.get('duration')),contact:f.get('contact').trim(),remarks:f.get('remarks')};
  await change(st=>{const existing=st.trials.find(x=>x.id===item.id);if(t&&!existing)throw Error('This trial no longer exists. Reload the schedule.');const trials=st.trials.filter(x=>x.id!==item.id);trials.push({...item,notes:existing?.notes||'',archived:existing?.archived||false});validateBackup({...st,trials});st.trials=trials;});
  if(!t){trialId=item.id;studentId=null;manual=true;view='journal';}
 });
}
function renderTrial(){
 const t=state.trials.find(t=>t.id===trialId);if(!t){trialId=null;renderJournal();return;}baseNotes=t.notes;
 const selection=selectScheduled(state.students,new Date(),state.appointments,state.trials,state.cancellations,state.holidays);
 const current=selection.matches.some(x=>x.trial?.id===t.id);
 $('#journal').innerHTML=`<div class="sectionhead"><div><div class="eyebrow">01 / TRIAL LESSON</div><h2>${esc(t.name)}</h2><span class="tag">${t.archived?'Archived trial':manual?'Trial / manual selection':current?'Trial in progress':'Next scheduled trial'}</span></div><button class="secondary" id="trialFollow">Follow schedule</button></div>${selection.matches.length>1?'<p class="warn">Schedule overlap: '+selection.matches.map(x=>esc(x.student.name)).join(', ')+'. Use Schedule to choose the correct record.</p>':''}<div class="mobile-pane-tabs" role="group" aria-label="Lesson workspace"><button type="button" data-mobile-pane="notes" aria-pressed="true">Notes</button><button type="button" data-mobile-pane="history" aria-pressed="false">History / details</button></div><div class="journalgrid"><div class="editor-console"><h3>${niceDate(t.date)} · ${t.time} · ${t.duration} min</h3><div class="toolbar"><button class="secondary" id="trialEdit">Edit trial details</button><button class="secondary" id="trialSchedule">Schedule</button></div><div class="toolbar shortcuts">${state.snippets.map(x=>`<button data-snippet="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div><label for="notes">TRIAL NOTES</label><textarea id="notes" class="notes" maxlength="200000" placeholder="Experience, exercises, first impressions…">${esc(t.notes)}</textarea><div class="savebar"><span id="saveStatus">Saved on this device</span><span>TRIAL RECORD</span></div><button class="secondary" id="retry">Retry save</button></div><div><article class="panel peach"><h3>Trial record</h3><p class="muted">${t.contact?'Contact: '+esc(t.contact):'No contact details recorded.'}</p><div class="previous">${esc(t.remarks)}</div><p class="muted">Convert this trial when the student joins. Contact details, remarks and lesson notes will be transferred.</p><div class="toolbar"><button id="trialConvert">Convert to student</button><button class="secondary" id="trialArchive">${t.archived?'Restore trial':'Archive trial'}</button></div></article></div></div>`;
 $('#notes').oninput=saveTrialNotes;
 $('#retry').onclick=()=>{baseNotes=state.trials.find(x=>x.id===trialId)?.notes||'';saveTrialNotes();};
 $('#trialEdit').onclick=async()=>{if(await ready())editTrial(state.trials.find(x=>x.id===trialId));};
 $('#trialConvert').onclick=async()=>{if(await ready())editStudent(null,state.trials.find(x=>x.id===trialId));};
 $('#trialArchive').onclick=async()=>{if(!await ready())return;await change(st=>{const trial=st.trials.find(x=>x.id===t.id);if(!trial)throw Error('Trial no longer exists.');trial.archived=!trial.archived;});sounds.play('accept');trialId=null;studentId=null;view='schedule';render();};
 $('#trialSchedule').onclick=()=>navigate('schedule');$('#trialFollow').onclick=async()=>{if(!await ready())return;automatic();render();};
 document.querySelectorAll('[data-snippet]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>insert(state.snippets.find(x=>x.id===b.dataset.snippet).text);});
}
function saveTrialNotes(){
 const id=trialId,notes=$('#notes').value,expected=baseNotes;baseNotes=notes;pending++;saveFailure=false;$('#saveStatus').textContent='Saving…';
 saveQueue=saveQueue.then(()=>change(st=>{const t=st.trials.find(x=>x.id===id);if(!t)throw Error('Trial was removed or converted in another tab. Copy your note before reloading.');if(t.notes!==expected&&t.notes!==notes)throw Error('Trial notes changed in another tab. Copy your note before reloading.');t.notes=notes;})).catch(e=>{saveFailure=true;error(e);}).finally(()=>{pending--;if(!saveFailure&&!pending)$('#error').hidden=true;if($('#saveStatus'))$('#saveStatus').textContent=saveFailure?'NOT SAVED — copy your note':pending?'Saving…':'Saved on this device';});
}

// Plain fields deliberately avoid OS-dependent date order and AM/PM controls.
function bindDateTimeFields(root){
 for(const field of root.querySelectorAll('[data-calendar-date],[data-clock-time]')){
  if(field.dataset.formatBound)continue;
  field.dataset.formatBound='true';
  const isDate=field.hasAttribute('data-calendar-date');
  const validate=()=>field.setCustomValidity(!field.value||(isDate?validDate(field.value):validTime(field.value))?'':isDate?'Enter a valid date as YYYY-MM-DD.':'Enter a 24-hour time as HH:mm (00:00–23:59).');
  field.addEventListener('input',validate);
  field.addEventListener('change',validate);
  validate();
 }
}
function formatTimestamp(d){
 return localDate(d)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
