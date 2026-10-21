// One-shot LCARS choreography. Tab changes animate only the active page.
// The INITIALIZE handoff is deliberately longer and runs exactly once.
export const LCARS_VIEW_DURATION_MS=1480;
export const LCARS_BOOT_DURATION_MS=3100;
export const LCARS_SHELL_DURATION_MS=3000;
export function createViewMotion(root,{
 schedule=(fn,ms)=>setTimeout(fn,ms),
 clear=id=>clearTimeout(id),
 reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
}={}){
 let active=null,activeClass=null,timer=null;
 const stop=()=>{
  if(timer!==null){clear(timer);timer=null;}
  if(active){active.classList.remove('lcars-view-enter');active.classList.remove('lcars-view-boot');active=null;}
  activeClass=null;
 };
 const play=(id,{boot=false}={})=>{
  stop();
  const page=root.getElementById(id);
  if(!page||page.hidden||reduced())return false;
  active=page;
  activeClass=boot?'lcars-view-boot':'lcars-view-enter';
  // Flush a removed class so quick page transitions do not lose the restart.
  page.classList.remove('lcars-view-enter');page.classList.remove('lcars-view-boot');
  void page.offsetWidth;
  page.classList.add(activeClass);
  timer=schedule(()=>{
   if(active===page){page.classList.remove(activeClass);active=null;activeClass=null;}
   timer=null;
  },boot?LCARS_BOOT_DURATION_MS:LCARS_VIEW_DURATION_MS);
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
 const stop=()=>{
  if(timer!==null){clear(timer);timer=null;}
  shell.classList.remove('lcars-chassis-assembling');
 };
 const play=()=>{
  stop();
  if(reduced())return false;
  shell.classList.add('lcars-chassis-assembling');
  timer=schedule(()=>{shell.classList.remove('lcars-chassis-assembling');timer=null;},LCARS_SHELL_DURATION_MS);
  return true;
 };
 return {play,stop};
}
