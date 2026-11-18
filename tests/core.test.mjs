import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {dueTimestamp,taskBucket,validateTask} from '../lib/task-core.mjs';
const context=vm.createContext({Date,JSON,isFinite});
vm.runInContext(fs.readFileSync(new URL('../setup/Code.gs',import.meta.url),'utf8'),context);
test('Date-only deadline stays open through the Vietnam day, regardless of host timezone',()=>{
 const t={deadline:'2026-11-16',done:false};
 assert.equal(taskBucket(t,Date.parse('2026-11-16T16:58:00Z')),'today');
 assert.equal(taskBucket(t,Date.parse('2026-11-16T17:00:00Z')),'overdue');
 assert.equal(dueTimestamp(t.deadline),Date.parse('2026-11-16T23:59:00+07:00'));
 assert.equal(taskBucket({...t,done:true},Date.parse('2026-11-17T10:00:00Z')),'done');
});
test('Reminder scan selects only the latest eligible threshold and ignores old overdue imports',()=>{
 const due='2026-11-20T17:00:00+07:00';const end=dueTimestamp(due);const enabled=end-3*86400000;
 assert.equal(context.otStage_(due,end-25*3600000,enabled),null);
 assert.equal(context.otStage_(due,end-24*3600000,enabled),'24h');
 assert.equal(context.otStage_(due,end-3600000,enabled),'1h');
 assert.equal(context.otStage_(due,end+180000,enabled),'due');
 assert.equal(context.otStage_(due,end+86400001,enabled),null);
 assert.equal(context.otStage_(due,end+180000,end+1),null);
});
test('Missing dates do not become overdue and task inputs enforce state and text limits',()=>{
 assert.equal(taskBucket({deadline:'',done:false}),'undated');
 assert.throws(()=>validateTask({name:' ',done:false}));
 assert.throws(()=>validateTask({name:'x',done:'false'}));
 assert.throws(()=>validateTask({name:'x',done:false,deadline:'16/11/2026'}));
 assert.throws(()=>validateTask({name:'x',done:false,notes:'x'.repeat(4001)}));
 assert.equal(validateTask({name:'  Test  ',done:false}).name,'Test');
});
test('OneSignal empty-success response remains retryable, rather than recording delivery',()=>{
 const props={ONESIGNAL_APP_ID:'id',ONESIGNAL_API_KEY:'key',ONTRACK_APP_URL:'https://example.test'};
 context.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]})};
 let seen;
 context.UrlFetchApp={fetch:(url,options)=>{seen=JSON.parse(options.payload);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({id:''})};}};
 assert.throws(()=>context.otSend_(['device'],'t','m','https://example.test','stable-key'));
 assert.equal(seen.idempotency_key,'stable-key');
 context.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({id:'accepted-id'})});
 assert.equal(context.otSend_(['device'],'t','m','https://example.test','stable-key'),'accepted-id');
});
test('No reminder on completed tasks; duplicate scan reuses the persisted key and does not resend',()=>{
 const due='2026-11-20T17:00:00+07:00';const now=dueTimestamp(due)-1800000;const props={PUSH_DEVICES:'["d"]',REMINDERS_ENABLED_AT:new Date(now-86400000).toISOString()};
 const saved={};let sends=0;let key;
 context.Date=class extends Date {constructor(...args){super(...(args.length?args:[now]));} static now(){return now;}};
 context.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})};
 context.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
 context.Utilities={getUuid:()=>'persistent-uuid',formatDate:()=>'20/11/2026 17:00'};
 const task={id:'a',deadline:due,name:'Task',done:false};
 context.otRows_=()=>[{row:2,raw:[,,,,,,,,,,,JSON.stringify(saved.state||{})],task}];
 context.otSheet_=()=>({getRange:(row,col)=>({setValue:value=>{saved.state=JSON.parse(value);},getValues:()=>[[task]]})});
 context.SpreadsheetApp={flush:()=>{}};context.otAppUrl_=()=>'https://example.test';context.otTask_=r=>r[0];
 context.otSend_=(devices,title,message,url,id)=>{sends++;key=id;};
 context.checkDeadlines();context.checkDeadlines();
 assert.equal(sends,1);assert.equal(key,'persistent-uuid');
 task.done=true;delete saved.state;
 context.checkDeadlines();assert.equal(sends,1);
});
