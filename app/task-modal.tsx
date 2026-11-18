"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Check,LoaderCircle,Repeat2,X} from 'lucide-react';
import {validateTask} from '../lib/task-core.mjs';
import type {Task} from '../lib/types';

export default function TaskModal({task,busy,onClose,onSave,onEditSeries}:{task:Task;busy:boolean;onClose:()=>void;onSave:(t:Task)=>Promise<void>;onEditSeries:(id:string)=>void}){
 const [name,setName]=useState(task.name);
 const date=task.deadline.slice(0,10);
 const time=task.deadline.length>10?task.deadline.slice(11,16):'23:59';
 const [priority,setPriority]=useState(task.priority||'normal');
 const [status,setStatus]=useState(task.done?'done':task.pending?'pending':'active');
 const [notes,setNotes]=useState(task.notes);
 const [kind,setKind]=useState(task.repeat?.type||'none');
 const every=task.repeat?.type==='interval'?task.repeat.every:1;
 const unit=task.repeat?.type==='interval'?task.repeat.unit:'days';
 const [weekdays,setWeekdays]=useState<number[]>(task.repeat?.type==='weekly'?task.repeat.weekdays:[1]);
 const monthDay=task.repeat?.type==='monthly'?task.repeat.day:1;
 const [error,setError]=useState('');
 const ref=useRef<HTMLDivElement>(null);const first=useRef<HTMLInputElement>(null);
 useEffect(()=>{first.current?.focus();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[]);
 function keys(e:React.KeyboardEvent){
  if(e.key==='Escape'&&!busy)onClose();
  if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea');if(!nodes?.length)return;const a=nodes[0],b=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}
 }
 async function submit(e:FormEvent){
  e.preventDefault();const form=e.currentTarget as HTMLFormElement;
  const dueDay=form.querySelector<HTMLInputElement>('input[type="date"]')?.value||'';
  const dueTime=form.querySelector<HTMLInputElement>('input[type="time"]')?.value||'23:59';
  const fields=new FormData(form);
  const repeat=task.seriesId?null:kind==='interval'?{type:'interval',every:Number(fields.get('repeatEvery')),unit:fields.get('repeatUnit')}:kind==='weekly'?{type:'weekly',weekdays}:kind==='monthly'?{type:'monthly',day:Number(fields.get('monthDay'))}:null;
  try{
   const clean=validateTask({name,deadline:dueDay?`${dueDay}T${dueTime}:00+07:00`:'',done:status==='done',pending:status==='pending',priority:priority||'normal',notes,repeat});
   const stamp=new Date().toISOString();
   await onSave({...task,...clean,completedAt:clean.done?(task.done?task.completedAt:stamp):null,updatedAt:stamp} as Task);
  }catch(err){setError((err as Error).message);}
 }
 return <div className="modal-cover" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="task-title" onKeyDown={keys}>
  <div className="modal-header"><h2 id="task-title">{task.name?'Chi tiết công việc':'Một việc mới, một bước tiến'}</h2><button className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={16}/></button></div>
  <form onSubmit={submit}>
   <label className="field">Tên công việc<input ref={first} value={name} maxLength={500} required onChange={e=>setName(e.target.value)} placeholder="Bạn cần làm gì?"/></label>
   <div className="field-row"><label className="field">Ngày deadline<input type="date" defaultValue={date}/></label><label className="field">Giờ deadline<input type="time" defaultValue={time}/></label></div>
   <div className="field-row"><label className="field">Mức ưu tiên<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Vừa</option><option value="high">Cao</option><option value="low">Thấp</option></select></label><label className="field">Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Đang làm</option><option value="pending">Pending · Tạm dừng</option><option value="done">Hoàn thành</option></select></label></div>
   {status==='pending'&&<p className="notice form-notice">Task Pending giữ nguyên deadline, tạm ngừng nhắc hạn và không tính vào việc cần làm. Lịch định kỳ vẫn tiếp tục tạo các lần sau.</p>}
   {task.seriesId?<div className="recurrence-box"><p className="small">Đây là một lần của công việc định kỳ. Chỉnh sửa ở đây chỉ áp dụng cho lần này.</p><button type="button" className="secondary" onClick={()=>onEditSeries(task.seriesId!)}><Repeat2 size={14}/>Sửa lịch gốc</button></div>:<div className="recurrence-box">
    <label className="field">Lặp lại<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="none">Không lặp</option><option value="interval">Sau một khoảng thời gian</option><option value="weekly">Theo tuần</option><option value="monthly">Theo tháng</option></select></label>
    {kind==='interval'&&<div className="field-row"><label className="field">Lặp mỗi<input name="repeatEvery" type="number" min={1} max={365} required defaultValue={every}/></label><label className="field">Đơn vị<select name="repeatUnit" defaultValue={unit}><option value="hours">Giờ</option><option value="days">Ngày</option></select></label></div>}
    {kind==='weekly'&&<div className="weekday-field"><p className="small">Chọn các thứ lặp mỗi tuần</p><div className="weekday-buttons">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=><button key={day} type="button" aria-label={`Lặp vào ${day}`} aria-pressed={weekdays.includes(i+1)} className={weekdays.includes(i+1)?'selected':''} onClick={()=>setWeekdays(old=>old.includes(i+1)?old.filter(d=>d!==i+1):[...old,i+1])}>{day}</button>)}</div></div>}
    {kind==='monthly'&&<><label className="field">Ngày lặp mỗi tháng<input name="monthDay" type="number" min={1} max={31} required defaultValue={monthDay}/></label><p className="small">Nếu tháng không có ngày đã chọn, dùng ngày cuối tháng. Ví dụ ngày 31 → 28 hoặc 29/02.</p></>}
    {kind!=='none'&&<p className="small">Deadline là lần đầu. Khi đến hạn mỗi lần, OnTrack tạo lần tiếp theo theo lịch, kể cả khi lần trước chưa xong. Sửa hoặc tắt lịch không thay đổi các lần đã tạo.</p>}
   </div>}
   <label className="field">Ghi chú<textarea value={notes} maxLength={4000} onChange={e=>setNotes(e.target.value)} placeholder="Thêm thông tin hoặc đường dẫn…"/></label>
   <p className="small">Bỏ trống giờ hoặc ưu tiên: mặc định 23:59 và Vừa, theo giờ Việt Nam.</p>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="modal-footer"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Hủy</button><button className="primary" type="submit" disabled={busy}>{busy?<LoaderCircle size={15}/>:<Check size={15}/>}Lưu công việc</button></div>
  </form>
 </div></div>;
}
