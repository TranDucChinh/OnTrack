import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
function fixture(){
 const due=new Date(Math.floor((Date.now()-1800000)/60000)*60000);const grid=[['Id','Name','Date','Done'],['=ordinal','Existing',due,false],['=ordinal','Already done',due,true]];const props={};let columns=4,capacity=10;
 const sheet={getMaxColumns:()=>columns,insertColumnsAfter:(after,n)=>{columns+=n;},getMaxRows:()=>capacity,insertRowsAfter:(after,n)=>{capacity+=n;},getLastRow:()=>grid.length,getDataRange:()=>({getValues:()=>grid.map(r=>Array.from({length:columns},(_,c)=>r[c]??''))}),getRange:(row,col,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>grid[row-1+i]?.[col-1+j]??'')),setValues:values=>{values.forEach((r,i)=>{grid[row-1+i]??=[];r.forEach((value,j)=>{grid[row-1+i][col-1+j]=value;});});},setValue:value=>{grid[row-1]??=[];grid[row-1][col-1]=value;},setFormula:value=>{grid[row-1]??=[];grid[row-1][col-1]=value;},setNumberFormat:()=>{}})};
 const ctx=vm.createContext({Date,JSON,isFinite,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;},deleteProperty:k=>{delete props[k];}})},LockService:{getScriptLock:()=>({waitLock:()=>{},tryLock:()=>true,releaseLock:()=>{},hasLock:()=>true})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...createHash('sha256').update(value).digest()],formatDate:(date,tz,format)=>{const s=new Date(date.getTime()+7*3600000).toISOString();if(format==='HH:mm:ss')return s.slice(11,19);if(format==='yyyy-MM-dd')return s.slice(0,10);return s.slice(0,19)+'+07:00';}},ScriptApp:{getProjectTriggers:()=>[]}});
 vm.runInContext(fs.readFileSync(new URL('../setup/Code.gs',import.meta.url),'utf8'),ctx);
 return {ctx,grid,props};
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
