// Mobile-only fallback for iOS WebKit's nonstandard gesture events.
// The CSS touch-action rule handles normal modern touch browsers.
// Do NOT intercept one-finger touchmove, native text selection, double-click,
// or ordinary taps: those are needed for the journal and rapid button use.
export function installZoomGuard(root,{
  isTouch=()=>typeof navigator!=='undefined'&&navigator.maxTouchPoints>0
}={}){
 if(!root||!isTouch())return ()=>{};
 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 const multi=e=>{if(e.touches?.length>1&&e.cancelable)e.preventDefault();};
 root.addEventListener('gesturestart',prevent,{passive:false});
 root.addEventListener('gesturechange',prevent,{passive:false});
 root.addEventListener('touchmove',multi,{passive:false});
 return ()=>{
  root.removeEventListener('gesturestart',prevent);
  root.removeEventListener('gesturechange',prevent);
  root.removeEventListener('touchmove',multi);
 };
}
