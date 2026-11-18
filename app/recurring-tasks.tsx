"use client";
import {usePreferences} from "./preferences";
import { CalendarDays, Pencil, Repeat2 } from 'lucide-react';
import { nextOccurrence, recurrenceLabel } from '../lib/task-core.mjs';
import type { Task } from '../lib/types';
export default function RecurringTasks({ tasks, busy, onEdit, onAdd }: {
    tasks: Task[];
    busy: boolean;
    onEdit: (taskItem: Task) => void;
    onAdd: () => void;
}) {
    const { t, locale, recurrenceText } = usePreferences();
    const roots = tasks.filter(taskItem => taskItem.repeat && !taskItem.seriesId);
    return <section className="panel"><div className="panel-head"><div><h2>{t("Lịch công việc định kỳ")}</h2><p>{t("Mỗi lần là một task riêng, giữ được lịch sử hoàn thành.")}</p></div><Repeat2 size={20} color="#7e9e66"/></div>{!roots.length ? <div className="empty">{t("Chưa có lịch định kỳ.")}<br /><button className="secondary" style={{ marginTop: 15 }} onClick={onAdd}>{t("Tạo lịch đầu tiên")}</button></div> : roots.map(taskItem => { const next = nextOccurrence(taskItem.recurrenceCursor?.lastDeadline || taskItem.deadline, taskItem.repeat); return <div className="recurring-row" key={taskItem.id}><div className="recurring-symbol"><Repeat2 size={19}/></div><div className="task-info"><h3>{taskItem.name}</h3><p className="small">{recurrenceText(taskItem.repeat)}</p><span className="task-meta"><CalendarDays size={12}/>{t("Deadline kỳ kế tiếp:") + " "}{next.slice(8, 10)}/{next.slice(5, 7)}/{next.slice(0, 4)} · {next.slice(11, 16)}</span></div><button className="secondary" disabled={busy} aria-label={t("Sửa lịch: {0}", { "0": taskItem.name })} onClick={() => onEdit(taskItem)}><Pencil size={13}/><span>{t("Sửa lịch")}</span></button></div>; })}<p className="notice" style={{ margin: 20 }}>{t("Pending chỉ tạm dừng một task. Muốn dừng tạo các lần mới, mở lịch gốc và chọn “Không lặp”. Trong bản dùng thử, task mới được bổ sung khi mở hoặc làm mới app; chạy nền mỗi 5 phút cần kết nối Sheet và kích hoạt lịch.")}</p></section>;
}
