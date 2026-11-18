"use client";
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {dueTimestamp,vnDay} from '../lib/task-core.mjs';
import {weekChart} from '../lib/week-chart.mjs';
import type {Task} from '../lib/types';
const states=[{key:'completed',label:'Đã hoàn thành'},{key:'incomplete',label:'Chưa hoàn thành'},{key:'overdue',label:'Quá hạn'}] as const;
export default function WeeklyStats({tasks,now,offset,onOffset}:{tasks:Task[];now:number;offset:number;onOffset:(n:number)=>void}){
 const week=weekChart(tasks,now,offset);
 const max=Math.max(1,...week.days.map(d=>d.total));
 const today=vnDay(new Date(now));
 const known=week.completed.filter((t:Task)=>t.completedAt&&t.deadline);
 const onTime=known.filter((t:Task)=>Date.parse(t.completedAt!)<=dueTimestamp(t.deadline));
 const format=(s:string)=>s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
 return <section className="panel"><div className="panel-head weekly-head"><div><h2>Công việc theo tuần</h2><p>{format(week.start)} – {format(week.end)} · Thứ Hai đến Chủ nhật</p></div><div className="week-controls"><button className="icon-button" aria-label="Tuần trước" onClick={()=>onOffset(offset-1)}><ChevronLeft size={16}/></button><CalendarDays size={18} color="#8aa078"/><button className="icon-button" aria-label="Tuần sau" onClick={()=>onOffset(offset+1)}><ChevronRight size={16}/></button></div></div>
  <div className="weekly-sub"><span>Theo ngày deadline · Không gồm Pending.</span>{offset!==0&&<button onClick={()=>onOffset(0)}>Về tuần này</button>}</div>
  <div className="chart-legend">{states.map(s=><span key={s.key}><i className={`chart-swatch ${s.key}`}/>{s.label}</span>)}</div>
  <div className="chart weekly-chart" role="img" aria-label={week.days.map(d=>`${d.weekday} ${d.label}${d.key===today?' (Hôm nay)':''}: ${d.completed} đã hoàn thành, ${d.incomplete} chưa hoàn thành, ${d.overdue} quá hạn`).join('; ')}>{week.days.map(d=>{const height=Math.max(3,d.total/max*125);const isToday=d.key===today;return <div className={`chart-col ${isToday?'is-today':''}`} key={d.key} data-today={isToday?'true':undefined}><span className="chart-value">{d.total}</span><div className={`stacked-bar ${d.total?'':'zero'}`} data-date={d.key} data-completed={d.completed} data-incomplete={d.incomplete} data-overdue={d.overdue} title={`${d.label}: ${d.completed} đã hoàn thành · ${d.incomplete} chưa hoàn thành · ${d.overdue} quá hạn`} style={{height:`${height}px`}}>{states.filter(s=>d[s.key]>0).map(s=><span key={s.key} className={`stack-segment ${s.key}`} style={{height:`${d[s.key]/d.total*100}%`}} title={`${s.label}: ${d[s.key]}`}>{height*d[s.key]/d.total>=18&&d[s.key]}</span>)}</div><span className="chart-day">{d.label}<small>{d.weekday}</small><em className="today-tag">{isToday?'Hôm nay':'\u00a0'}</em></span></div>;})}</div>
  <div className="stats-body"><div className="metric-line"><span>Hoàn thành theo deadline trong tuần</span><strong>{week.completed.length} / {week.tasks.length}</strong></div><div className="metric-line"><span>Tỷ lệ hoàn thành trong tuần</span><strong>{week.percent}%</strong></div><div className="metric-line"><span>Đúng hạn trong các việc có thời điểm hoàn thành</span><strong>{known.length?`${Math.round(onTime.length/known.length*100)}%`:'Chưa có dữ liệu'}</strong></div><p className="notice">Một việc được tính hoàn thành trong tuần khi deadline thuộc tuần đang xem và trạng thái hiện tại là hoàn thành. {week.completed.length-known.length} việc trong nhóm này chưa có thời điểm hoàn thành để tính đúng hạn.</p></div>
 </section>;
}
