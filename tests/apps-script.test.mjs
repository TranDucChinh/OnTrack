import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
function fixture(){
 const due=new Date(Math.floor((Date.now()-1800000)/60000)*60000);const grid=[['Id','Name','Date','Done'],['=ordinal','Existing',due,false],['=ordinal','Already done',due,true]];const props={};let columns=4,capacity=10;const audit=[];const triggers=[];const auditSheet={getLastRow:()=>audit.length,getMaxRows:()=>100,hideSheet:()=>{},deleteRows:(row,n)=>audit.splice(row-1,n),getRange:(row,col,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>[audit[row-1+i]?.[0]??'']),setValue:v=>{audit[row-1]=[v];}})};
 const sheet={getMaxColumns:()=>columns,insertColumnsAfter:(after,n)=>{columns+=n;},getMaxRows:()=>capacity,insertRowsAfter:(after,n)=>{capacity+=n;},getLastRow:()=>grid.length,getDataRange:()=>({getValues:()=>grid.map(r=>Array.from({length:columns},(_,c)=>r[c]??''))}),getRange:(row,col,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>grid[row-1+i]?.[col-1+j]??'')),setValues:values=>{values.forEach((r,i)=>{grid[row-1+i]??=[];r.forEach((value,j)=>{grid[row-1+i][col-1+j]=value;});});},setValue:value=>{grid[row-1]??=[];grid[row-1][col-1]=value;},setFormula:value=>{grid[row-1]??=[];grid[row-1][col-1]=value;},setNumberFormat:()=>{}})};
 const ctx=vm.createContext({Date,JSON,isFinite,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;},deleteProperty:k=>{delete props[k];}})},LockService:{getScriptLock:()=>({waitLock:()=>{},tryLock:()=>true,releaseLock:()=>{},hasLock:()=>true})},SpreadsheetApp:{openById:()=>({getSheetByName:name=>name==='Deadline'?sheet:(audit.length?auditSheet:null),insertSheet:()=>auditSheet}),flush:()=>{}},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...createHash('sha256').update(value).digest()],formatDate:(date,tz,format)=>{const s=new Date(date.getTime()+7*3600000).toISOString();if(format==='HH:mm:ss')return s.slice(11,19);if(format==='yyyy-MM-dd')return s.slice(0,10);return s.slice(0,19)+'+07:00';}},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({forSpreadsheet:()=>({onEdit:()=>({create:()=>triggers.push({getHandlerFunction:()=>name})})})}),deleteTrigger:()=>{}}});
 vm.runInContext(fs.readFileSync(new URL('../setup/Code.gs',import.meta.url),'utf8'),ctx);
 return {ctx,grid,props,audit,triggers};
}
test('Schema upgrade preserves original columns and does not invent historic completion times',()=>{
 const {ctx,grid}=fixture();const original=grid.map(r=>r.slice());ctx.setupOnTrack();
 assert.equal(grid[0].length,17);assert.deepEqual(grid.map(r=>r.slice(0,4)),original);
 assert.equal(grid[2][6]??'', '');assert.equal(ctx.otRows_().length,2);
 const id=grid[1][4];ctx.setupOnTrack();assert.equal(grid[1][4],id);
});
test('Live Sheet save round-trips Pending and recurrence; scheduler creates once without push subscribers',()=>{
 const {ctx,grid}=fixture();ctx.setupOnTrack();const previous=ctx.otRows_()[0].task;
 ctx.otSave_({task:{...previous,pending:true,repeat:{type:'interval',every:1,unit:'hours'}},baseVersion:previous.version});
 assert.equal(grid[1][12],true);assert.equal(ctx.otRows_()[0].task.pending,true);
 ctx.checkDeadlines();ctx.checkDeadlines();
 const rows=ctx.otRows_();assert.equal(rows.length,3);
 const child=rows.find(r=>r.task.seriesId===previous.id).task;
 assert.equal(child.pending,false);assert.equal(child.done,false);assert.equal(child.repeat,null);
 assert.equal(ctx.otState_().schemaVersion,2);
});
test('Direct Sheet edits invalidate an old revision and are protected from overwrite',()=>{
 const {ctx,grid}=fixture();ctx.setupOnTrack();const previous=ctx.otRows_()[0].task;
 grid[1][1]='Edited directly in Sheet';
 assert.throws(()=>ctx.otSave_({task:{...previous,name:'Old draft'},baseVersion:previous.version}),e=>e.otCode==='conflict');
 assert.equal(grid[1][1],'Edited directly in Sheet');
});

test('Sheet history records confirmed changes, excludes no-ops and conflicts, and survives state reload',()=>{
 const {ctx,audit,triggers}=fixture();ctx.setupOnTrack();ctx.setupOnTrack();
 assert.equal(triggers.length,1);assert.equal(audit.length,1);assert.equal(ctx.otActivity_().length,0);
 let task=ctx.otRows_()[0].task;
 ctx.otSave_({task,baseVersion:task.version});assert.equal(ctx.otActivity_().length,0);
 ctx.otSave_({task:{...task,done:true},baseVersion:task.version});
 assert.equal(ctx.otState_().activity[0].action,'completed');
 assert.throws(()=>ctx.otSave_({task:{...task,name:'Stale edit'},baseVersion:task.version}));
 assert.equal(ctx.otActivity_().length,1);
 for(let i=0;i<24;i++){task=ctx.otRows_()[0].task;ctx.otSave_({task:{...task,name:'Task '+i},baseVersion:task.version});}
 assert.equal(audit.length,21);assert.equal(ctx.otActivity_().length,20);assert.equal(ctx.otActivity_()[0].taskName,'Task 23');
});

test('Recurring creation logs once, while repeat scans and reminder metadata do not add activity',()=>{
 const {ctx}=fixture();ctx.setupOnTrack();let task=ctx.otRows_()[0].task;
 ctx.otSave_({task:{...task,repeat:{type:'interval',every:1,unit:'hours'}},baseVersion:task.version});
 ctx.checkDeadlines();const count=ctx.otActivity_().length;
 assert.equal(ctx.otActivity_()[0].action,'recurring_created');ctx.checkDeadlines();
 assert.equal(ctx.otActivity_().length,count);
});

test('Manual Sheet edits log touched task fields and ignore other tabs and no-op edits',()=>{
 const {ctx,grid}=fixture();ctx.setupOnTrack();grid[1][1]='Manual rename';
 const range={getSheet:()=>({getName:()=>ctx.OT_TAB}),getRow:()=>2,getLastRow:()=>2,getColumn:()=>2,getLastColumn:()=>2,getNumRows:()=>1,getNumColumns:()=>1,getA1Notation:()=>'B2'};
 const event={range,source:{getId:()=>ctx.OT_SHEET_ID},oldValue:'Existing',value:'Manual rename'};
 ctx.onTrackSheetEdit(event);assert.equal(ctx.otActivity_()[0].action,'sheet_edit');assert.equal(ctx.otActivity_()[0].taskName,'Manual rename');
 ctx.onTrackSheetEdit({...event,oldValue:event.value});assert.equal(ctx.otActivity_().length,1);
 ctx.onTrackSheetEdit({...event,source:{getId:()=>'other'}});assert.equal(ctx.otActivity_().length,1);
});
