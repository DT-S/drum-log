// LCARS launcher is a gate, never a second boot animation.
// A trusted click starts the long sample and immediately hands the screen to
// the main-console assembly. No waiting for an audio promise or progress bar.
export function createStartupConsole(root){
 const $=selector=>root.querySelector(selector);
 const overlay=$('#lcarsStartup'),button=$('#lcarsInitialize');
 const shell=[...root.body.children].filter(el=>el!==overlay&&el.tagName!=='SCRIPT');
 let active=false,activated=false;
 const themes=overlay?[...overlay.querySelectorAll('[data-set-theme]')]:[];
 const dismiss=()=>{
  if(!overlay)return;
  active=false;
  overlay.hidden=true;
  overlay.classList.remove('lcars-initializing');
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
  activated=false;active=true;button.disabled=false;
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
   activated=true;button.disabled=true;
   // WebKit requires audio to start directly in the user gesture.
   // Its success or failure must NEVER control the visual transition.
   try{Promise.resolve(startAudio()).catch(()=>{});}catch{}
   // Hide the launch console BEFORE starting the real shell. A second
   // animation of the launch screen would interrupt the handoff.
   dismiss();
   try{onEnter();}catch{}
  };
  return true;
 }
 return {show,dismiss};
}
