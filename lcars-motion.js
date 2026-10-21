// LCARS one-shot view assembly, strictly user-initiated. No idle animation,
// DOM layout changes, loops or changes to the scheduler / student records.
export const LCARS_VIEW_DURATION_MS=760;
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
  page.classList.add('lcars-view-enter');
  timer=schedule(()=>{
   if(active===page){page.classList.remove('lcars-view-enter');active=null;}
   timer=null;
  },LCARS_VIEW_DURATION_MS);
  return true;
 };
 return {play,stop};
}
