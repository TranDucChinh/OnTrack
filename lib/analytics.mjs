import {dueTimestamp,taskBucket,weekSummary} from './task-core.mjs';

export function taskListGroup(task,now=Date.now()){
  if(task.done)return 'done';
  if(task.pending)return 'pending';
  return taskBucket(task,now)==='overdue'?'overdue':'active';
}
export function listTasks(tasks,now=Date.now(),query='',filter='all'){
  const order={overdue:0,active:1,pending:2,done:3};
  return tasks.filter(t=>{
    if(!t.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))return false;
    if(filter==='all')return true;
    if(filter==='high')return t.priority==='high';
    if(['active','done','pending','overdue'].includes(filter))return taskListGroup(t,now)===filter;
    return taskBucket(t,now)===filter;
  }).sort((a,b)=>order[taskListGroup(a,now)]-order[taskListGroup(b,now)]||(dueTimestamp(a.deadline)-dueTimestamp(b.deadline))||a.name.localeCompare(b.name,'vi'));
}
export function weeklyAnalytics(tasks,now=Date.now(),offset=0){
  const week=weekSummary(tasks,now,offset);const previous=weekSummary(tasks,now,offset-1);
  const status={overdue:0,active:0,pending:0,done:0};
  const priority={high:{total:0,done:0},normal:{total:0,done:0},low:{total:0,done:0}};
  for(const task of week.tasks){status[taskListGroup(task,now)]++;const key=['high','normal','low'].includes(task.priority)?task.priority:'normal';priority[key].total++;if(task.done)priority[key].done++;}
  const known=week.completed.filter(t=>t.completedAt&&Number.isFinite(Date.parse(t.completedAt)));
  const late=known.filter(t=>Date.parse(t.completedAt)>dueTimestamp(t.deadline));
  const onTime=known.length-late.length;
  const busiest=week.days.map(day=>({...day,count:week.tasks.filter(t=>t.deadline.slice(0,10)===day.key).length})).sort((a,b)=>b.count-a.count)[0];
  return {week,previous,status,priority,
    totalDelta:week.tasks.length-previous.tasks.length,doneDelta:week.completed.length-previous.completed.length,percentDelta:week.percent-previous.percent,
    upcoming24h:week.tasks.filter(t=>!t.done&&!t.pending&&dueTimestamp(t.deadline)>=now&&dueTimestamp(t.deadline)<=now+86400000).length,
    highOpen:week.tasks.filter(t=>!t.done&&!t.pending&&t.priority==='high').length,
    undated:tasks.filter(t=>!t.deadline).length,
    busiest:busiest?.count?busiest:null,
    quality:{known:known.length,onTime,late:late.length,unknown:week.completed.length-known.length,onTimePercent:known.length?Math.round(onTime/known.length*100):null,averageLateHours:late.length?late.reduce((sum,t)=>sum+(Date.parse(t.completedAt)-dueTimestamp(t.deadline))/3600000,0)/late.length:null}
  };
}
