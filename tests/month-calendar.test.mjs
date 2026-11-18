import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthCalendar} from '../lib/month-calendar.mjs';
test('Month grid starts on Monday, ends on Sunday and includes all November dates once',()=>{
 const month=monthCalendar([],Date.parse('2026-11-16T10:00:00+07:00'));
 assert.equal(month.start,'2026-11-01');assert.equal(month.end,'2026-11-30');assert.equal(month.days[0].key,'2026-10-26');assert.equal(month.days.at(-1).key,'2026-12-06');
 assert.equal(month.days.length,42);assert.equal(month.days.filter(d=>d.inMonth).length,30);assert.equal(new Set(month.days.map(d=>d.key)).size,42);
});
test('Task placement uses deadline, includes all states and ignores completion date',()=>{
 const tasks=[{id:'done',name:'Done',done:true,deadline:'2026-11-16',completedAt:'2026-11-20'},{id:'active',name:'Active',done:false,deadline:'2026-11-16T23:59:00+07:00'},{id:'pending',name:'Pending',done:false,pending:true,deadline:'2026-11-16'},{id:'undated',name:'Undated',done:false,deadline:''}];
 const month=monthCalendar(tasks,Date.parse('2026-11-16T12:00:00+07:00'));const day=month.days.find(d=>d.key==='2026-11-16');
 assert.equal(day.tasks.length,3);assert.equal(day.isToday,true);assert.equal(month.undated,1);assert.equal(month.days.find(d=>d.key==='2026-11-20').tasks.length,0);
});
test('Month navigation handles leap February and year boundaries without losing days',()=>{
 const now=Date.parse('2027-12-16T12:00:00+07:00');
 assert.equal(monthCalendar([],now,1).start,'2028-01-01');assert.equal(monthCalendar([],now,2).end,'2028-02-29');assert.equal(monthCalendar([],now,-12).start,'2026-12-01');
 assert.equal(monthCalendar([],Date.parse('2026-11-16T17:01:00Z')).today,'2026-11-17');
});
