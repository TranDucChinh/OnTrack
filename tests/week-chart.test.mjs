import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekChart} from '../lib/week-chart.mjs';
test('Stacked day has three disjoint states, with Done ahead of overdue and Pending excluded',()=>{
 const now=Date.parse('2026-11-16T12:00:00+07:00');
 const tasks=[{deadline:'2026-11-16T09:00:00+07:00',done:true},{deadline:'2026-11-16T10:00:00+07:00',done:false},{deadline:'2026-11-16T18:00:00+07:00',done:false},{deadline:'2026-11-16',done:false},{deadline:'2026-11-16T08:00:00+07:00',done:false,pending:true}];
 const day=weekChart(tasks,now).days[0];
 assert.equal(day.completed,1);assert.equal(day.incomplete,2);assert.equal(day.overdue,1);assert.equal(day.total,4);
 assert.equal(day.total,day.completed+day.incomplete+day.overdue);
});
test('Week navigation retains completion history and distinguishes future work from overdue as of now',()=>{
 const now=Date.parse('2026-11-16T12:00:00+07:00');
 const tasks=[{deadline:'2026-11-15',done:true},{deadline:'2026-11-15',done:false},{deadline:'2026-11-23',done:false},{deadline:'',done:true}];
 const prior=weekChart(tasks,now,-1);assert.equal(prior.days[6].completed,1);assert.equal(prior.days[6].overdue,1);assert.equal(prior.days[6].total,2);
 const next=weekChart(tasks,now,1);assert.equal(next.days[0].incomplete,1);assert.equal(next.days[0].overdue,0);
 assert.equal(weekChart(tasks,now).days.reduce((sum,d)=>sum+d.total,0),0);
});
test('Overdue boundary changes only after the exact deadline and each task appears once',()=>{
 const deadline='2026-11-16T12:00:00+07:00';const tasks=[{deadline,done:false}];
 assert.equal(weekChart(tasks,Date.parse(deadline)).days[0].incomplete,1);
 const after=weekChart(tasks,Date.parse(deadline)+1);assert.equal(after.days[0].overdue,1);assert.equal(after.days[0].incomplete,0);assert.equal(after.days[0].total,1);
});
