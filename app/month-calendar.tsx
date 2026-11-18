"use client";
import {usePreferences} from "./preferences";
import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { monthCalendar } from '../lib/month-calendar.mjs';
import { taskListGroup } from '../lib/analytics.mjs';
import type { Task } from '../lib/types';
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const labels = { overdue: 'Quá hạn', active: 'Đang làm', pending: 'Pending', done: 'Đã hoàn thành' };
export default function MonthCalendar({ tasks, now, offset, onOffset, onEdit, onAdd, busy, filters }: {
    tasks: Task[];
    now: number;
    offset: number;
    onOffset: (n: number) => void;
    onEdit: (task: Task) => void;
    onAdd: (day: string) => void;
    busy: boolean;
    filters: ReactNode;
}) {
    const { t, locale, recurrenceText } = usePreferences();
    const month = monthCalendar(tasks, now, offset);
    const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(month.start + 'T12:00:00+07:00'));
    const [selected, setSelected] = useState(month.today);
    const chosen = month.days.find(d => d.key === selected && d.inMonth) || month.days.find(d => d.isToday && d.inMonth) || month.days.find(d => d.inMonth)!;
    const weeks = Array.from({ length: month.days.length / 7 }, (_, i) => month.days.slice(i * 7, i * 7 + 7));
    function selectDay(key: string) {
        setSelected(key);
        if (key < month.start)
            onOffset(offset - 1);
        else if (key > month.end)
            onOffset(offset + 1);
    }
    const dayLabel = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
    return <section className="panel month-panel"><div className="panel-head month-head"><div><h2>{t("Lịch công việc ·") + " "}{monthTitle}</h2><p>{t("Task được xếp vào ngày có deadline. Bấm vào task để xem hoặc sửa.")}</p></div><div className="month-controls"><button className="secondary" onClick={() => { onOffset(0); setSelected(month.today); }}>{t("Tháng này")}</button><button className="icon-button" aria-label={t("Tháng trước")} onClick={() => onOffset(offset - 1)}><ChevronLeft size={16}/></button><CalendarDays size={18}/><button className="icon-button" aria-label={t("Tháng sau")} onClick={() => onOffset(offset + 1)}><ChevronRight size={16}/></button></div></div>
 {filters}
 <div className="calendar-legend">{(['overdue', 'active', 'pending', 'done'] as const).map(status => <span key={status}><i className={`calendar-dot ${status}`}/>{t(labels[status])}</span>)}</div>
 <div className="month-grid" role="grid" aria-label={t("Lịch {0}", { "0": monthTitle })}><div className="month-weekday-row" role="row">{weekdays.map(day => <div role="columnheader" key={day}>{day}</div>)}</div>{weeks.map((week, i) => <div className="month-week" role="row" key={i}>{week.map(day => <div role="gridcell" key={day.key} data-date={day.key} aria-selected={day.key === chosen.key} className={`month-day ${day.inMonth ? '' : 'outside'} ${day.isToday ? 'is-today' : ''} ${day.key === chosen.key ? 'selected' : ''}`} onClick={() => selectDay(day.key)}>
  <button className="month-day-number" aria-label={t("Chọn ngày {0}{1}", { "0": dayLabel(day.key), "1": day.isToday ? t(", hôm nay") : '' })} aria-current={day.isToday ? 'date' : undefined} onClick={e => { e.stopPropagation(); selectDay(day.key); }}>{day.day}</button>{day.tasks.length > 0 && <span className="month-day-count" aria-label={t("{0} công việc", { "0": day.tasks.length })}>{day.tasks.length}</span>}
  <div className="calendar-tasks">{day.tasks.slice(0, 3).map((taskItem: Task) => <button key={taskItem.id} disabled={busy} className={`calendar-task ${taskListGroup(taskItem, now)}`} title={`${taskItem.name} · ${taskItem.deadline.length > 10 ? taskItem.deadline.slice(11, 16) : '23:59'} · ${t(labels[taskListGroup(taskItem, now)])}`} aria-label={t("Mở công việc: {0}, {1}", { "0": taskItem.name, "1": dayLabel(day.key) })} onClick={e => { e.stopPropagation(); onEdit(taskItem); }}><span>{taskItem.name}</span></button>)}{day.tasks.length > 3 && <button className="calendar-more" onClick={e => { e.stopPropagation(); selectDay(day.key); }}>+{day.tasks.length - 3}{" " + t("việc khác")}</button>}</div>
 </div>)}</div>)}</div>
 <div className="selected-day-panel"><div className="selected-day-head"><div><h3>{t("Công việc ngày") + " "}{dayLabel(chosen.key)}</h3><p className="small">{t("{0} công việc", {"0":chosen.tasks.length})}{chosen.isToday ? t(" · Hôm nay") : ''}</p></div><button className="secondary" disabled={busy} onClick={() => onAdd(chosen.key)}><Plus size={14}/><span>{t("Thêm vào ngày này")}</span></button></div>{chosen.tasks.length ? chosen.tasks.map((task: Task) => <button className="calendar-detail" key={task.id} disabled={busy} onClick={() => onEdit(task)}><i className={`calendar-dot ${taskListGroup(task, now)}`}/><span>{task.name}</span><small>{task.deadline.length > 10 ? task.deadline.slice(11, 16) : '23:59'} · {t(labels[taskListGroup(task, now)])}</small></button>) : <p className="calendar-empty">{tasks.length ? t("Không có task có deadline vào ngày này.") : t("Không có task khớp bộ lọc.")}</p>}</div>
 {month.undated > 0 && <p className="calendar-footnote">{month.undated}{" " + t("task khớp bộ lọc chưa có deadline, xem trong chế độ Danh sách.")}</p>}
 </section>;
}
