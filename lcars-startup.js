// Optional Voyager-style launch gate. The database is fully loaded before
// showing this overlay. Every action is locally scoped and intentionally avoids
// changing student-data, schedule or journal state.
export function createStartupConsole(root){
 const $=selector=>root.querySelector(selector);
 const overlay=$('#lcarsStartup');
 const button=$('#lcarsInitialize');
 const shell=[...root.body.children].filter(el=>el!==overlay&&el.tagName!=='SCRIPT');
 let active=false,activated=false;
 const themes=overlay?[...overlay.querySelectorAll('[data-set-theme]')]:[];
 const dismiss=()=>{
  if(!overlay)return;
  active=false;overlay.hidden=true;overlay.classList.remove('lcars-initializing');
  for(const element of shell)element.inert=false;
 };
 for(const theme of themes){
  theme.addEventListener('click',()=>{
   overlay.dataset.theme=theme.dataset.setTheme;
   for(const choice of themes)choice.setAttribute('aria-pressed',String(choice===theme));
  });
 }
 function show({startAudio=()=>Promise.resolve(false),onEnter=()=>{}}={}){
  if(!overlay||!button||active)return false;
  activated=false;active=true;
  button.disabled=false;
  $('#lcarsInitText').textContent='INITIALIZE DRUM LOG';
  $('#lcarsInitCode').textContent='ENGAGE // 47';
  $('#lcarsStartupNote').textContent='SYSTEM STANDBY // LOCAL DATABASE & AUDIO READY';
  const fill=$('#lcarsBootFill'),bar=$('#lcarsBootBar');
  if(fill)fill.style.width='0%';
  bar?.classList.remove('active');
  overlay.classList.remove('lcars-initializing');
  for(const element of shell)element.inert=true;
  overlay.hidden=false;overlay.dataset.ready='true';
  button.focus({preventScroll:true});
  button.onclick=()=>{
   if(activated||!active)return;
   activated=true;
   button.disabled=true;
   $('#lcarsInitText').textContent='INITIALIZING…';
   $('#lcarsInitCode').textContent='SYNC // 01';
   $('#lcarsStartupNote').textContent='AUDIO LINK & LOCAL DATABASE ONLINE';
   bar?.classList.add('active');
   overlay.classList.add('lcars-initializing');
   if(fill)fill.style.width='35%';
   // Must begin synchronously inside a real click. Awaiting an unrelated
   // promise first loses the user gesture in WebKit/Firefox.
   let audio;
   try{audio=Promise.resolve(startAudio());}
   catch{audio=Promise.resolve(false);}
   const finalize=()=>{
    if(!active)return;
    if(fill)fill.style.width='100%';
    dismiss();
    try{onEnter();}catch{}
   };
   // startAudio is time-bounded itself; this outer deadline is a fail-open
   // guarantee for a future audio backend that accidentally never settles.
   // Starting a decoded buffer succeeds in milliseconds. Without a MINIMUM
   // visible duration the animation immediately disappears even though the
   // original long LCARS sound has only just begun. This was the root cause.
   // Use a deterministic 1.45 s choreography; fail open after 2.35 s even if
   // the audio promise stalls. OS reduced-motion completes immediately.
   const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
   const minimumMs=reduced?0:1450;
   let minimumTimer,deadline;
   const minimum=new Promise(resolve=>{minimumTimer=setTimeout(resolve,minimumMs);});
   Promise.race([
     Promise.allSettled([audio,minimum]),
     new Promise(resolve=>{deadline=setTimeout(resolve,2350);})
   ]).then(finalize).catch(finalize).finally(()=>{
     clearTimeout(minimumTimer);clearTimeout(deadline);
   });
  };
  return true;
 }
 return {show,dismiss};
}
