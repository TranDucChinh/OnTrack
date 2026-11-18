"use client";
import {useEffect,useRef} from 'react';
import {Bell,Check,Pause,Play,Plus,RefreshCw,Repeat2,SquarePen,X} from 'lucide-react';
import type {Activity} from '../lib/types';
import {usePreferences} from './preferences';
const actions:Record<string,string>={created:'Đã thêm công việc',updated:'Đã sửa công việc',completed:'Đã hoàn thành',paused:'Đã chuyển Pending',resumed:'Đã tiếp tục công việc',reopened:'Đã mở lại công việc',recurring_created:'Đã tạo task định kỳ',sheet_edit:'Đã sửa trực tiếp trên Sheet'};
const fields:Record<string,string>={name:'Tên công việc',deadline:'Deadline',status:'Trạng thái',priority:'Mức ưu tiên',notes:'Ghi chú',repeat:'Lặp lại'};
const icons:Record<string,typeof Plus>={created:Plus,updated:SquarePen,completed:Check,paused:Pause,resumed:Play,reopened:Play,recurring_created:Repeat2,sheet_edit:SquarePen};
export default function ActivityPanel({entries,mode,loading,error,ready,onRefresh,onClose}:{entries:Activity[];mode:'demo'|'live';loading:boolean;error:string;ready:boolean;onRefresh:()=>void;onClose:()=>void}){
 const {t,locale,recurrenceText}=usePreferences();const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;previous?.focus();};},[]);
 function keys(e:React.KeyboardEvent){if(e.key==='Escape')onClose();if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),summary');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 function value(field:string,v:unknown):string{
  if(field==='repeat')return recurrenceText(v);
  if(v===null||v===undefined||v==='')return t('Không có');
  if(field==='status')return t(v==='done'?'Đã hoàn thành':v==='pending'?'Pending · Tạm dừng':'Đang làm');
  if(field==='priority')return t(v==='high'?'Cao':v==='low'?'Thấp':'Vừa');
  if(field==='deadline'){const raw=String(v);const date=new Date(raw.length===10?raw+'T23:59:00+07:00':raw);if(!isNaN(date.getTime()))return new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(date);}
  return typeof v==='string'?v:JSON.stringify(v);
 }
 return <div className="activity-cover" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className="activity-panel" role="dialog" aria-modal="true" aria-labelledby="activity-title" onKeyDown={keys}>
  <header className="activity-header"><div><div className="activity-eyebrow"><Bell size={14}/>{t('THÔNG BÁO')}</div><h2 id="activity-title">{t('Hoạt động gần đây')}</h2></div><button className="icon-button" aria-label={t('Đóng')} onClick={onClose}><X size={17}/></button></header>
  <div className="activity-intro"><p>{t('20 thao tác thay đổi dữ liệu gần nhất, mới nhất ở trên.')}</p><button className="secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={13} className={loading?'activity-spinning':''}/>{t('Làm mới')}</button></div>
  <p className="activity-mode">{t(mode==='demo'?'Bản thử · Lịch sử chỉ lưu trên trình duyệt này, chưa thay đổi Sheet.':'Đã lưu trên Sheet · Lịch sử dùng chung giữa các thiết bị.')}</p>
  {error&&<p className="activity-warning" role="alert">{t('Chưa tải được lịch sử mới nhất. Hãy thử làm mới.')}</p>}
  {!ready&&mode==='live'&&<p className="activity-warning">{t('Cập nhật Code.gs và chạy lại setupOnTrack để bật lịch sử thao tác trên Sheet.')}</p>}
  <div className="activity-list">{!entries.length?<div className="activity-empty"><Bell size={28}/><h3>{t('Chưa có thao tác nào')}</h3><p>{t('Các thay đổi từ khi bật tính năng này sẽ xuất hiện tại đây.')}</p></div>:<ol>{entries.map(entry=>{const Icon=icons[entry.action]||SquarePen;return <li className="activity-item" key={entry.id}><span className={`activity-icon ${entry.action}`}><Icon size={16}/></span><div className="activity-body"><div className="activity-action">{t(actions[entry.action]||'Đã sửa công việc')}</div><p className="activity-name">{entry.taskName}</p><time dateTime={entry.at}>{new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(entry.at))}</time><span className="activity-source"> · {t(entry.source==='scheduler'?'Tự động':entry.source==='sheet'?'Google Sheet':mode==='demo'?'Bản thử':'OnTrack')}</span>
  {entry.action==='sheet_edit'?<p className="activity-fields">{entry.changes.map(c=>t(fields[c.field]||c.field)).join(', ')}{entry.range?' · '+entry.range:''}</p>:entry.changes.length?<details><summary>{t('Xem thay đổi')}<span> · {entry.changes.length}</span></summary><dl>{entry.changes.map(change=><div className="activity-change" key={change.field}><dt>{t(fields[change.field]||change.field)}</dt><dd><span className="activity-before">{value(change.field,change.before)}</span><span className="activity-arrow"> → </span><span>{value(change.field,change.after)}</span></dd></div>)}</dl></details>:entry.deadline?<p className="activity-fields">{t('Deadline')}: {value('deadline',entry.deadline)}</p>:null}</div></li>;})}</ol>}</div>
  <footer className="activity-footer">{t('Chỉ ghi thao tác làm thay đổi công việc. Không tính xem trang, đồng bộ hay đổi cài đặt giao diện.')}</footer>
 </div></div>;
}
