import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listTasks,taskListGroup,weeklyAnalytics} from '../lib/analytics.mjs';
const now=Date.parse('2026-11-18T12:00:00+07:00');
test('All task history is visible in status order, with chronological order inside each group',()=>{
 const tasks=[{id:'oldDone',name:'Old completed',deadline:'2026-10-01',done:true},{id:'future',name:'Future',deadline:'2026-11-20',done:false},{id:'late2',name:'Late 2',deadline:'2026-11-17',done:false},{id:'pending',name:'Paused',deadline:'2026-11-01',done:false,pending:true},{id:'late1',name:'Late 1',deadline:'2026-11-16',done:false},{id:'undated',name:'No date',deadline:'',done:false}];
 assert.deepEqual(listTasks(tasks,now).map(t=>t.id),['late1','late2','future','undated','pending','oldDone']);
 assert.equal(listTasks(tasks,now,'','done')[0].id,'oldDone');
 assert.equal(listTasks(tasks,now).length,tasks.length);
 assert.equal(taskListGroup(tasks[3],now),'pending');
});
test('Weekly metrics reconcile states, priorities and comparison without counting other weeks',()=>{
 const tasks=[{name:'On time',deadline:'2026-11-16T18:00:00+07:00',done:true,completedAt:'2026-11-16T17:00:00+07:00',priority:'high'},{name:'Late',deadline:'2026-11-17T12:00:00+07:00',done:true,completedAt:'2026-11-17T18:00:00+07:00',priority:'normal'},{name:'Unknown',deadline:'2026-11-18',done:true},{name:'Open',deadline:'2026-11-19T10:00:00+07:00',done:false,priority:'high'},{name:'Overdue',deadline:'2026-11-16',done:false,priority:'low'},{name:'Pending',deadline:'2026-11-20',done:false,pending:true},{name:'Prior week',deadline:'2026-11-15',done:true},{name:'Undated',deadline:'',done:false}];
 const a=weeklyAnalytics(tasks,now);
 assert.equal(a.week.tasks.length,6);assert.deepEqual(a.status,{overdue:1,active:1,pending:1,done:3});
 assert.equal(Object.values(a.status).reduce((sum,n)=>sum+n,0),6);
 assert.equal(Object.values(a.priority).reduce((sum,p)=>sum+p.total,0),6);
 assert.equal(a.totalDelta,5);assert.equal(a.doneDelta,2);assert.equal(a.upcoming24h,1);assert.equal(a.highOpen,1);assert.equal(a.undated,1);
 assert.deepEqual(a.quality,{known:2,onTime:1,late:1,unknown:1,onTimePercent:50,averageLateHours:6});
});
test('Empty weeks and historic Done without timestamps do not invent quality rates or busiest days',()=>{
 const empty=weeklyAnalytics([],now);assert.equal(empty.week.tasks.length,0);assert.equal(empty.quality.onTimePercent,null);assert.equal(empty.quality.averageLateHours,null);assert.equal(empty.busiest,null);
 const old=weeklyAnalytics([{name:'Done',deadline:'2026-11-18',done:true}],now);assert.equal(old.quality.unknown,1);assert.equal(old.quality.known,0);assert.equal(old.quality.onTimePercent,null);
});
