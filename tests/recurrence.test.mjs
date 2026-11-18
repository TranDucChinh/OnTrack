import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyTaskEdit,expandRecurring,inDeadlineWeek,nextOccurrence,reminderEligible,taskBucket,validateTask,weekBounds,weekSummary} from '../lib/task-core.mjs';
const at=value=>Date.parse(value+'+07:00');
const root={id:'root',name:'Recurring work',deadline:'2026-11-16T23:59:00+07:00',done:false,pending:false,priority:'normal',notes:'',repeat:{type:'interval',every:1,unit:'days'}};
test('Monday–Sunday boundaries use Vietnam time, including Sunday night and year crossing',()=>{
 assert.deepEqual(weekBounds(at('2026-11-22T23:59:59')),{start:'2026-11-16',end:'2026-11-22'});
 assert.deepEqual(weekBounds(at('2026-11-23T00:00:00')),{start:'2026-11-23',end:'2026-11-29'});
 assert.deepEqual(weekBounds(at('2027-01-01T10:00:00')),{start:'2026-12-28',end:'2027-01-03'});
 assert.equal(inDeadlineWeek({deadline:'2026-11-22T23:59:00+07:00'},at('2026-11-16T10:00:00')),true);
});
test('Completion in week is based on deadline and current Done, not completedAt',()=>{
 const tasks=[{deadline:'2026-11-16',done:true,completedAt:'2026-10-01'}, {deadline:'2026-11-15',done:true,completedAt:'2026-11-16'}, {deadline:'2026-11-22',done:false}, {deadline:'',done:true}];
 const week=weekSummary(tasks,at('2026-11-18T10:00:00'));
 assert.equal(week.completed.length,1);assert.equal(week.tasks.length,2);assert.equal(week.percent,50);
 assert.deepEqual(week.days.map(d=>d.weekday),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
 assert.equal(week.days[6].count,1);assert.equal(weekSummary(tasks,at('2026-11-18T10:00:00'),-1).completed.length,1);
});
test('Pending takes precedence over overdue and suppresses reminders and actionable weekly bars',()=>{
 const task={...root,pending:true};assert.equal(taskBucket(task,at('2026-11-20T10:00:00')),'pending');assert.equal(reminderEligible(task),false);
 assert.equal(weekSummary([task],at('2026-11-16T10:00:00')).days[0].count,0);
 assert.equal(taskBucket({...task,done:true}),'done');assert.equal(validateTask({...task,done:true}).pending,false);
});
test('Missing priority defaults to medium, date-only due remains 23:59, invalid calendar dates fail',()=>{
 assert.equal(validateTask({name:'x',done:false,deadline:'2026-11-16'}).priority,'normal');
 assert.equal(nextOccurrence('2026-11-16',{type:'interval',every:1,unit:'days'}),'2026-11-17T23:59:00+07:00');
 assert.throws(()=>validateTask({name:'x',done:false,deadline:'2026-02-30'}));
 assert.throws(()=>validateTask({name:'x',done:false,deadline:'2026-11-16T24:00:00+07:00'}));
 assert.throws(()=>validateTask({...root,deadline:''}));
});
test('Interval repeats cross midnight and use deadline, even if prior occurrence is unfinished',()=>{
 assert.equal(nextOccurrence(root.deadline,{type:'interval',every:2,unit:'hours'}),'2026-11-17T01:59:00+07:00');
 const result=expandRecurring([root],at('2026-11-16T23:59:00'));
 assert.equal(result.created.length,1);assert.equal(result.created[0].deadline,'2026-11-17T23:59:00+07:00');
 assert.equal(result.tasks[0].done,false);assert.equal(expandRecurring(result.tasks,at('2026-11-17T12:00:00')).created.length,0);
});
test('Weekly repeats choose multiple selected weekdays and roll Sunday into Monday',()=>{
 const rule={type:'weekly',weekdays:[1,3,7]};
 assert.equal(nextOccurrence('2026-11-16T10:00:00+07:00',rule),'2026-11-18T10:00:00+07:00');
 assert.equal(nextOccurrence('2026-11-22',rule),'2026-11-23T23:59:00+07:00');
 assert.throws(()=>validateTask({...root,repeat:{type:'weekly',weekdays:[]}}));
});
test('Monthly day 31 clamps short months without drifting to day 28 in the next month',()=>{
 const rule={type:'monthly',day:31};
 assert.equal(nextOccurrence('2027-01-31',rule),'2027-02-28T23:59:00+07:00');
 assert.equal(nextOccurrence('2027-02-28',rule),'2027-03-31T23:59:00+07:00');
 assert.equal(nextOccurrence('2028-01-31',rule),'2028-02-29T23:59:00+07:00');
 assert.equal(nextOccurrence('2026-12-31',rule),'2027-01-31T23:59:00+07:00');
});
test('Repeated scans and retry after a lost cursor do not duplicate occurrences',()=>{
 const now=at('2026-11-19T12:00:00');const first=expandRecurring([root],now);
 assert.equal(first.created.length,3);
 assert.equal(new Set(first.tasks.map(t=>t.id)).size,4);
 assert.equal(expandRecurring(first.tasks,now).created.length,0);
 const recovered=expandRecurring([{...first.tasks[0],recurrenceCursor:null},...first.created],now);
 assert.equal(recovered.created.length,0);assert.equal(recovered.tasks.length,4);
});
test('Recurring creation continues for completed or pending root; a new occurrence starts active',()=>{
 for(const status of [{done:true},{pending:true}]){const result=expandRecurring([{...root,...status}],at('2026-11-17T10:00:00'));assert.equal(result.created.length,1);assert.equal(result.created[0].done,false);assert.equal(result.created[0].pending,false);}
});
test('Changing a schedule preserves already materialized tasks and starts from the current cursor',()=>{
 const first=expandRecurring([root],at('2026-11-19T12:00:00'));
 const edited=applyTaskEdit(first.tasks[0],{...first.tasks[0],repeat:{type:'interval',every:2,unit:'days'}});
 const next=expandRecurring([edited,...first.created],at('2026-11-20T10:00:00'));
 assert.deepEqual(next.created.map(t=>t.deadline),['2026-11-21T23:59:00+07:00']);
 const stopped=applyTaskEdit(edited,{repeat:null});assert.equal(expandRecurring([stopped,...next.created],at('2026-11-30T10:00:00')).created.length,0);
});
test('A long outage catches up in bounded batches and continues without losing progress',()=>{
 const first=expandRecurring([root],at('2026-11-25T12:00:00'),2);assert.equal(first.created.length,2);assert.equal(first.hasMore,true);
 const second=expandRecurring(first.tasks,at('2026-11-25T12:00:00'),2);assert.equal(second.created.length,2);assert.equal(second.tasks.length,5);
});
