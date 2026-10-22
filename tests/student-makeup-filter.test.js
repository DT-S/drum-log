import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual Students renderer with synthetic in-memory records only.
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function renderStudents(){');
const end=app.indexOf('function planDateShift(',start);
assert.ok(start>=0&&end>start,'Expected Students renderer');
const rendererSource=app.slice(start,end);

function setup(){
 const students=[
  {id:'a',name:'Active Owed',schedule:'weekly',day:1,time:'12:00',archived:false,makeupBalance:1},
  {id:'b',name:'Archived Owed',schedule:'weekly',day:2,time:'12:00',archived:true,makeupBalance:2},
  {id:'c',name:'Active Zero',schedule:'weekly',day:3,time:'12:00',archived:false,makeupBalance:0},
  {id:'d',name:'Legacy Missing',schedule:'weekly',day:4,time:'12:00',archived:false},
  {id:'e',name:'Archived Zero',schedule:'weekly',day:5,time:'12:00',archived:true,makeupBalance:0}
 ];
 const elements={
  '#students':{innerHTML:''},
  '#filter':{value:'',onchange:null},
  '#search':{value:'',oninput:null,focus(){},setSelectionRange(){}},
  '#addStudent':{onclick:null}
 };
 const scope={
  filter:'active',search:'',state:{students},
  $:key=>elements[key],esc:value=>String(value),
  scheduleType:()=> 'weekly',
  studentRows:items=>items.map(s=>'<div class="studentrow">'+s.name+'</div>').join(''),
  bindRows(){},editStudent(){}
 };
 const renderStudents=vm.runInNewContext(rendererSource+';renderStudents',scope);
 const rows=()=>[...elements['#students'].innerHTML.matchAll(/<div class="studentrow">([^<]*)<\/div>/g)].map(m=>m[1]);
 const select=key=>{const el=elements['#filter'];el.value=key;el.onchange({target:el});};
 const query=value=>{const el=elements['#search'];el.value=value;el.oninput({target:{value,selectionStart:value.length}});};
 return {students,elements,renderStudents,rows,select,query};
}

test('Students offers a fourth filter for owed make-up lessons (1+), preserving default active view',()=>{
 const ui=setup();ui.renderStudents();
 assert.match(ui.elements['#students'].innerHTML,/<option value="makeup">Make-up lessons owed \(1\+\)<\/option>/);
 assert.deepEqual(ui.rows(),['Active Owed','Active Zero','Legacy Missing']);
 assert.equal(ui.elements['#filter'].value,'active');
 ui.select('makeup');
 assert.deepEqual(ui.rows(),['Active Owed','Archived Owed']);
 assert.equal(ui.elements['#filter'].value,'makeup');
 ui.select('archived');assert.deepEqual(ui.rows(),['Archived Owed','Archived Zero']);
 ui.select('all');assert.deepEqual(ui.rows(),['Active Owed','Archived Owed','Active Zero','Legacy Missing','Archived Zero']);
});
test('positive make-up balances combine with case-insensitive search and update after correction',()=>{
 const ui=setup();ui.renderStudents();ui.select('makeup');
 ui.query('ARCHIVED');assert.deepEqual(ui.rows(),['Archived Owed']);
 ui.query('');assert.deepEqual(ui.rows(),['Active Owed','Archived Owed']);
 ui.students[0].makeupBalance=0;ui.renderStudents();
 assert.deepEqual(ui.rows(),['Archived Owed']);
 ui.students[1].makeupBalance=0;ui.renderStudents();
 assert.deepEqual(ui.rows(),[]);
 assert.match(ui.elements['#students'].innerHTML,/No matching students/);
 assert.equal(ui.elements['#filter'].value,'makeup');
});
