"use client";
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {dueTimestamp,weekSummary} from '../lib/task-core.mjs';
import type {Task} from '../lib/types';
export default function WeeklyStats({tasks,now,offset,onOffset}:{tasks:Task[];now:number;offset:number;onOffset:(n:number)=>void}){
 const week=weekSummary(tasks,now,offset);
 const known=week.completed.filter((t:Task)=>t.completedAt&&t.deadline);
 const onTime=known.filter((t:Task)=>Date.parse(t.completedAt!)<=dueTimestamp(t.deadline));
 const format=(s:string)=>s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
 return <section className="panel"><div className="panel-head weekly-head"><div><h2>Deadline theo tuần</h2><p>{format(week.start)} – {format(week.end)} · Thứ Hai đến Chủ nhật</p></div><div className="week-controls"><button className="icon-button" aria-label="Tuần trước" onClick={()=>onOffset(offset-1)}><ChevronLeft size={16}/></button><CalendarDays size={18} color="#8aa078"/><button className="icon-button" aria-label="Tuần sau" onClick={()=>onOffset(offset+1)}><ChevronRight size={16}/></button></div></div>
  <div className="weekly-sub"><span>Việc chưa hoàn thành, không gồm Pending.</span>{offset!==0&&<button onClick={()=>onOffset(0)}>Về tuần này</button>}</div>
  <div className="chart weekly-chart" role="img" aria-label={week.days.map((d:{weekday:string;label:string;count:number})=>`${d.weekday} ${d.label}: ${d.count} việc`).join('; ')}>{week.days.map((d:{key:string;label:string;weekday:string;count:number})=><div className="chart-col" key={d.key}><span className="chart-value">{d.count}</span><div className="chart-bar" style={{height:`${Math.max(3,d.count/Math.max(1,...week.days.map((x:{count:number})=>x.count))*115)}px`}}/><span className="chart-day">{d.label}<small>{d.weekday}</small></span></div>)}</div>
  <div className="stats-body"><div className="metric-line"><span>Hoàn thành theo deadline trong tuần</span><strong>{week.completed.length} / {week.tasks.length}</strong></div><div className="metric-line"><span>Tỷ lệ hoàn thành trong tuần</span><strong>{week.percent}%</strong></div><div className="metric-line"><span>Đúng hạn trong các việc có thời điểm hoàn thành</span><strong>{known.length?`${Math.round(onTime.length/known.length*100)}%`:'Chưa có dữ liệu'}</strong></div><p className="notice">Một việc được tính hoàn thành trong tuần khi deadline thuộc tuần đang xem và trạng thái hiện tại là hoàn thành. {week.completed.length-known.length} việc trong nhóm này chưa có thời điểm hoàn thành để tính đúng hạn.</p></div>
 </section>;
}
