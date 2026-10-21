// LCARS one-shot view assembly, strictly user-initiated. No idle animation,
// DOM layout changes, loops or changes to the scheduler / student records.
export const LCARS_VIEW_DURATION_MS=1480;
export function createViewMotion(root,{
 schedule=(fn,ms)=>setTimeout(fn,ms),
 clear=id=>clearTimeout(id),
 reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
}={}){
 let active=null,timer=null;
 const stop=()=>{
  if(timer!==null){clear(timer);timer=null;}
  if(active){active.classList.remove('lcars-view-enter');active=null;}
 };
 const play=id=>{
  stop();
  const page=root.getElementById(id);
  if(!page||page.hidden||reduced())return false;
  // Animate only the destination section. The header/side rail are stable.
  // Opacity / filter do not change the actual touch or keyboard hit targets.
  active=page;
  // Like the metronome, restart only for an actual navigation. The section
  // remains in place, and its own header/panels/lists power up in phases.
  page.classList.remove('lcars-view-enter');
  void page.offsetWidth;
  page.classList.add('lcars-view-enter');
  timer=schedule(()=>{
   if(active===page){page.classList.remove('lcars-view-enter');active=null;}
   timer=null;
  },LCARS_VIEW_DURATION_MS);
  return true;
 };
 return {play,stop};
}

export function createShellMotion(root,{
 schedule=(fn,ms)=>setTimeout(fn,ms),
 clear=id=>clearTimeout(id),
 reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
}={}){
 const shell=root.body||root;
 let timer=null;
 function stop(){
  if(timer!==null){clear(timer);timer=null;}
  shell.classList.remove('lcars-chassis-assembling');
 }
 function play(){
  stop();
  if(reduced())return false;
  shell.classList.add('lcars-chassis-assembling');
  timer=schedule(()=>{shell.classList.remove('lcars-chassis-assembling');timer=null;},1150);
  return true;
 }
 return {play,stop};
}
