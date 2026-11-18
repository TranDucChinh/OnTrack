import {addDayKey,vnDay} from './task-core.mjs';
import {listTasks} from './analytics.mjs';

export function monthCalendar(tasks,now=Date.now(),offset=0){
  const today=vnDay(new Date(now));
  const first=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1+offset,1,12));
  const year=first.getUTCFullYear(),month=first.getUTCMonth();
  const start=first.toISOString().slice(0,10);
  const end=new Date(Date.UTC(year,month+1,0,12)).toISOString().slice(0,10);
  const lead=(first.getUTCDay()+6)%7;
  const length=Number(end.slice(8));
  const gridStart=addDayKey(start,-lead);
  const cells=Math.ceil((lead+length)/7)*7;
  const ordered=listTasks(tasks,now);
  const days=Array.from({length:cells},(_,i)=>{
    const key=addDayKey(gridStart,i);
    return {key,day:Number(key.slice(8)),inMonth:key>=start&&key<=end,isToday:key===today,tasks:ordered.filter(t=>t.deadline&&t.deadline.slice(0,10)===key)};
  });
  return {start,end,key:start.slice(0,7),label:`Tháng ${month+1}, ${year}`,today,days,undated:tasks.filter(t=>!t.deadline).length};
}
