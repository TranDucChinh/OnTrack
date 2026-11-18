import {dueTimestamp,weekSummary} from './task-core.mjs';

export function weekChart(tasks,now=Date.now(),offset=0){
  const week=weekSummary(tasks,now,offset);
  const days=week.days.map(day=>{
    const counts={completed:0,incomplete:0,overdue:0};
    for(const task of week.tasks){
      if(task.deadline.slice(0,10)!==day.key)continue;
      if(task.done)counts.completed++;
      else if(!task.pending){
        if(dueTimestamp(task.deadline)<now)counts.overdue++;
        else counts.incomplete++;
      }
    }
    return {...day,...counts,total:counts.completed+counts.incomplete+counts.overdue};
  });
  return {...week,days};
}
