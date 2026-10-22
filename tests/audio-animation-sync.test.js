import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LCARS_VIEW_DURATION_MS,LCARS_BOOT_DURATION_MS,LCARS_SHELL_DURATION_MS} from '../lcars-motion.js';

// Verify the two ORIGINAL bundled recordings, rather than guessing timing
// from filenames or shortening the recordings to suit the animation.
// Both samples are MPEG-1 Layer III; their true lengths include full frames.
function mp3LengthMs(file){
 const b=readFileSync(new URL('../sounds/soundsv2/'+file,import.meta.url));
 assert.equal(b.toString('ascii',0,3),'ID3',file+' has unexpected format');
 let pos=10+((b[6]&127)<<21)+((b[7]&127)<<14)+((b[8]&127)<<7)+(b[9]&127);
 const br=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
 let frames=0,seconds=0;
 while(pos+4<=b.length){
  assert.equal(b[pos],255,file+' lost an MPEG sync byte');
  assert.equal(b[pos+1]&0xfe,0xfa,file+' must remain MPEG-1 Layer III');
  const rate=br[(b[pos+2]>>4)&15],sampleRate=[44100,48000,32000][(b[pos+2]>>2)&3];
  assert.ok(rate&&sampleRate,'invalid bitrate/sample rate in '+file);
  const bytes=Math.floor(144000*rate/sampleRate)+((b[pos+2]>>1)&1);
  assert.ok(pos+bytes<=b.length,'truncated MP3 frame in '+file);
  pos+=bytes;frames++;seconds+=1152/sampleRate;
 }
 assert.equal(pos,b.length,file+' has uncounted trailing bytes');
 assert.ok(frames>0);
 return Math.round(seconds*1000);
}

test('RC29 first build matches launch sample; navigation ends with the short layered cue',()=>{
 const launch=mp3LengthMs('launchsound_Staggered_Entrance_Animation.mp3');
 const menu=mp3LengthMs('menu_or_window_change.mp3');
 assert.equal(launch,1608);
 assert.equal(menu,576);
 assert.equal(LCARS_BOOT_DURATION_MS,1620);
 assert.ok(Math.abs(LCARS_BOOT_DURATION_MS-launch)<=15);
 assert.equal(LCARS_SHELL_DURATION_MS,1560);
 assert.ok(LCARS_SHELL_DURATION_MS<=LCARS_BOOT_DURATION_MS);
 // The navigation keypress triggers now; the menu recording starts at +55ms.
 assert.equal(LCARS_VIEW_DURATION_MS,640);
 assert.ok(Math.abs(LCARS_VIEW_DURATION_MS-(menu+55))<=15);
 assert.ok(LCARS_VIEW_DURATION_MS*2<LCARS_BOOT_DURATION_MS);
});
test('RC29 stagger remains sequential but reaches the last data rows before audio ends',()=>{
 const sequence=readFileSync(new URL('../lcars-sequence.css',import.meta.url),'utf8');
 const assembly=readFileSync(new URL('../lcars-assembly.css',import.meta.url),'utf8');
 // Last delayed navigation row = 506ms delay + 124ms finish.
 assert.match(sequence,/animation:dl-sequence-lamp 124ms ease-out 444ms both!important/);
 assert.match(sequence,/animation-delay:506ms!important/);
 assert.ok(506+124<=LCARS_VIEW_DURATION_MS);
 // Last boot details = 1380ms delay + 219ms finish.
 assert.match(assembly,/animation:dl-assembly-appear 219ms ease-out 1380ms both!important/);
 assert.ok(1380+219<=LCARS_BOOT_DURATION_MS);
 assert.match(assembly,/animation:dl-assembly-rail-x/);
 assert.match(assembly,/animation:dl-assembly-unfold/);
 assert.match(sequence,/prefers-reduced-motion:reduce/);
 assert.match(assembly,/prefers-reduced-motion:reduce/);
});
