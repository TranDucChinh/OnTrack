import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createActivity,appendActivity,recentActivity} from '../lib/activity-core.mjs';
const task={id:'task-1',name:'Đọc tài liệu',deadline:'2026-11-16',done:false,pending:false,priority:'normal',notes:'',repeat:null};
const meta={id:'event-1',at:'2026-11-16T10:00:00.000Z'};
test('Only task data changes create history; metadata, refresh and unchanged saves do not',()=>{
 assert.equal(createActivity(task,{...task,updatedAt:'now',version:'new'},meta),null);
 assert.equal(createActivity(null,task,meta).action,'created');
 const edit=createActivity(task,{...task,name:'Tên mới',deadline:'2026-11-18'},meta);
 assert.deepEqual(edit.changes.map(c=>c.field),['name','deadline']);
 assert.equal(edit.changes[0].before,task.name);assert.equal(edit.changes[0].after,'Tên mới');
});
test('Status transitions and automatic recurring tasks retain the correct action',()=>{
 assert.equal(createActivity(task,{...task,done:true},meta).action,'completed');
 assert.equal(createActivity(task,{...task,pending:true},meta).action,'paused');
 assert.equal(createActivity({...task,pending:true},task,meta).action,'resumed');
 assert.equal(createActivity({...task,done:true},task,meta).action,'reopened');
 assert.equal(createActivity(null,task,{...meta,source:'scheduler'}).action,'recurring_created');
});
test('History is newest first, bounded to 20 and avoids repeating the same event',()=>{
 let history=[];
 for(let i=0;i<25;i++)history=appendActivity(history,createActivity(null,task,{id:'event-'+i,at:new Date(Date.parse(meta.at)+i*1000).toISOString()}));
 assert.equal(history.length,20);assert.equal(history[0].id,'event-24');assert.equal(history.at(-1).id,'event-5');
 assert.equal(appendActivity(history,history[0]).length,20);
 assert.deepEqual(recentActivity([null,{id:'broken',at:'bad'}]),[]);
});
