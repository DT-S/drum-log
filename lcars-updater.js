// Drum Log LCARS updater. Never changes IndexedDB/lesson records.
// Mirrors the Metronome update workflow but protects editor state and other
// tabs before activating a new offline shell.
export function awaitWorkerState(worker,desired,timeout=7500){
 if(!worker)return Promise.resolve(false);
 if(worker.state===desired)return Promise.resolve(true);
 if(worker.state==='redundant')return Promise.resolve(false);
 return new Promise(resolve=>{
  let done=false, timer;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);
   worker.removeEventListener?.('statechange',changed);resolve(ok);};
  const changed=()=>{
   if(worker.state===desired)finish(true);
   else if(worker.state==='redundant')finish(false);
  };
  worker.addEventListener?.('statechange',changed);
  timer=setTimeout(()=>finish(worker.state===desired),timeout);
  changed();
 });
}
export function countOpenTabs(worker,{timeout=1600}={}){
 if(!worker?.postMessage)return Promise.resolve(null);
 return new Promise(resolve=>{
  let settled=false,timer;
  const finish=n=>{if(settled)return;settled=true;clearTimeout(timer);
   channel?.port1?.close();resolve(n);};
  const channel=typeof MessageChannel!=='undefined'?new MessageChannel():null;
  if(!channel)return finish(null);
  channel.port1.onmessage=e=>finish(Number.isInteger(e.data?.count)?e.data.count:null);
  timer=setTimeout(()=>finish(null),timeout);
  try{worker.postMessage({type:'COUNT_DRUM_LOG_CLIENTS'},[channel.port2]);}
  catch{finish(null);}
 });
}
export function createUpdateManager({
 serviceWorker,online=()=>navigator.onLine,canProceed=async()=>true,
 reload=()=>location.reload(),onStatus=()=>{}
}={}){
 let registration=null,registrationTask=null,button=null,statusNode=null;
 let checking=false,readyToReload=false,display='No update check performed.';
 const say=(message)=>{display=message;if(statusNode)statusNode.textContent=message;onStatus(message);draw();};
 const draw=()=>{
  if(!button)return;
  button.disabled=checking||!serviceWorker;
  button.textContent=checking?'CHECKING / INSTALLING…':readyToReload?'RELOAD UPDATED APP':
   registration?.waiting?'INSTALL UPDATE & RELOAD':'CHECK FOR UPDATES';
 };
 const mount=(nextButton,nextStatus)=>{
  button=nextButton;statusNode=nextStatus;
  if(statusNode)statusNode.textContent=display;
  if(button)button.onclick=check;
  draw();
 };
 const register=()=>{
  if(!serviceWorker?.register)return Promise.reject(Error('Service workers unsupported.'));
  if(!registrationTask)registrationTask=serviceWorker.register('./sw.js',{updateViaCache:'none'})
   .then(async r=>{
    registration=r;
    r.addEventListener?.('updatefound',()=>{
     say('Downloading LCARS update to offline cache…');
     r.installing?.addEventListener?.('statechange',()=>{
      if(r.waiting)say('New version downloaded. Ready to install.');
      else if(r.installing?.state==='redundant')say('Update download failed. Retry online.');
     });
    });
    serviceWorker.addEventListener?.('controllerchange',()=>{
     readyToReload=true;
     say('New LCARS version active. Reload when your notes are saved.');
    });
    await serviceWorker.ready;
    say(r.waiting?'New LCARS version ready to install.':'Offline system ready. Check for updates in Data systems.');
    return r;
   }).catch(e=>{registrationTask=null;say('Update setup failed. Reload online.');throw e;});
  return registrationTask;
 };
 const safe=async()=>{
  try{if(await canProceed())return true;}
  catch{}
  say('Finish saving your journal and close dialogs before updating.');
  return false;
 };
 const activate=async worker=>{
  // Check across the complete service-worker scope before skipWaiting.
  const active=serviceWorker.controller||registration?.active;
  const count=await countOpenTabs(active||worker);
  if(count===null||count>1){
   say('Close other Drum Log windows; cannot safely verify a single active tab.');
   return false;
  }
  if(!await safe())return false;
  try{
   worker.postMessage({type:'ACTIVATE_DRUM_LOG_UPDATE'});
   const ok=await awaitWorkerState(worker,'activated');
   if(!ok){say('Activation delayed. Close other tabs and retry.');return false;}
   readyToReload=true;
   say('New LCARS system installed. Reload when ready.');
   return true;
  }catch{say('Cannot activate update. Reopen online.');return false;}
 };
 const check=async()=>{
  if(checking)return;
  if(!await safe())return;
  if(readyToReload){
   // Second gate guards edits typed after the update finished.
   if(await safe())reload();return;
  }
  checking=true;draw();
  try{
   const r=registration||await register();
   if(!r)return;
   if(r.waiting){await activate(r.waiting);return;}
   if(!online()){say('Offline. Reconnect to check for a newer LCARS build.');return;}
   say('Checking GitHub Pages for a newer system…');
   await r.update();
   if(r.waiting){await activate(r.waiting);return;}
   if(r.installing){
    const installed=await awaitWorkerState(r.installing,'installed');
    if(r.waiting){await activate(r.waiting);return;}
    if(installed)readyToReload=true;
    say(installed?'New version downloaded. Reload when ready.':'Update downloading. Check again shortly.');
    return;
   }
   say('System is up to date. No restart necessary.');
  }catch{say('Update check failed. Reconnect and retry.');}
  finally{checking=false;draw();}
 };
 return {register,mount,check,get status(){return display;},get readyToReload(){return readyToReload;}};
}
