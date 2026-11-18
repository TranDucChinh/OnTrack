"use client";
import {usePreferences,AppearanceSettings} from "./preferences";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, Pause, Play, Repeat2, CalendarDays, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Cloud, Download, ExternalLink, Leaf, ListTodo, LoaderCircle, Pencil, Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Target, TrendingUp, X } from "lucide-react";
import { dueTimestamp, taskBucket, weekSummary, expandRecurring, normalizeStoredTask, applyTaskEdit } from "../lib/task-core.mjs";
import type { Task, Activity } from "../lib/types";
import {appendActivity,createActivity,recentActivity} from '../lib/activity-core.mjs';
import ActivityPanel from './activity-panel';
import {AccountMenu} from './auth-gate';
import TaskModal from "./task-modal";
import AnalyticsDashboard from "./analytics-dashboard";
import { listTasks, taskListGroup } from "../lib/analytics.mjs";
import RecurringTasks from "./recurring-tasks";
import MonthCalendar from "./month-calendar";
type AppState = {
    mode: 'demo' | 'live';
    tasks: Task[];
    activity?: Activity[];
    activityReady?: boolean;
    pushAppId: string;
    pushReady: boolean;
    schedulerActive: boolean;
    lastCheck: string | null;
    lastCheckError: boolean;
    deviceCount: number;
};
type View = 'all' | 'recurring' | 'stats' | 'settings';
type PushSDK = {
    init: (o: object) => Promise<void>;
    Notifications: {
        requestPermission: () => Promise<void>;
        permission: boolean;
        isPushSupported: () => boolean;
    };
    User: {
        PushSubscription: {
            id?: string;
            optedIn: boolean;
            optIn: () => Promise<void>;
            addEventListener: (n: string, cb: (e: {
                current: {
                    id?: string;
                    optedIn: boolean;
                };
            }) => void) => void;
        };
    };
};
declare global {
    interface Window {
        OneSignalDeferred?: ((s: PushSDK) => void)[];
    }
}
const nav = [{ key: 'all', name: 'Công việc', Icon: ListTodo }, { key: 'recurring', name: 'Định kỳ', Icon: Repeat2 }, { key: 'stats', name: 'Thống kê', Icon: TrendingUp }, { key: 'settings', name: 'Cài đặt', Icon: Settings2 }] as const;
const DEMO_KEY = 'ontrack-excel-preview-v1';
const DEMO_STATE_KEY = 'ontrack-demo-state-v2';
const titles = { recurring: 'Việc lặp lại, nhịp nhàng hơn.', all: 'Mọi việc, trong tầm tay.', stats: 'Nhìn rõ từng bước tiến.', settings: 'OnTrack theo cách của bạn.' };
const subtitles = { recurring: 'Đặt lịch một lần, OnTrack tạo các task tiếp theo.', all: 'Sắp xếp công việc, dành chỗ cho điều quan trọng.', stats: 'Tiến độ rõ ràng giúp bạn lên kế hoạch tốt hơn.', settings: 'Kết nối dữ liệu, bật nhắc việc và cài app trên thiết bị.' };
function formatDue(value: string, locale = 'vi-VN') {
    if (!value)
        return 'Chưa có deadline';
    const date = new Date(`${value.slice(0, 10)}T12:00:00+07:00`);
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date) + ` · ${value.length > 10 ? value.slice(11, 16) : '23:59'}`;
}
async function api(body?: object) {
    const response = await fetch('/api/ontrack', { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await response.json() as any;
    if(response.status===401)window.dispatchEvent(new Event('ontrack-auth-required'));
    if (!response.ok || data.error)
        throw new Error(data.error || 'Không thể kết nối. Hãy thử lại.');
    return data;
}
function Brand({ mobile = false }: {
    mobile?: boolean;
}) { const { t, locale, recurrenceText } = usePreferences(); return <div className={`brand ${mobile ? 'mobile-brand' : ''}`}><span className="mark"><CheckCheck size={23}/></span>OnTrack</div>; }
export default function OnTrack() {
    const { t, locale, recurrenceText } = usePreferences();
    const [view, setView] = useState<View>('all');
    const [workLayout, setWorkLayout] = useState<'list' | 'calendar'>('list');
    const [monthOffset, setMonthOffset] = useState(0);
    const [weekOffset, setWeekOffset] = useState(0);
    const [state, setState] = useState<AppState | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activity,setActivity]=useState<Activity[]>([]);
    const [activityOpen,setActivityOpen]=useState(false);
    const [activityLoading,setActivityLoading]=useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [draft, setDraft] = useState<Task | null>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [toast, setToast] = useState<{
        text: string;
        error?: boolean;
    } | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [sdk, setSdk] = useState<PushSDK | null>(null);
    const [pushStatus, setPushStatus] = useState("Chưa bật trên thiết bị này");
    const [deviceId, setDeviceId] = useState('');
    const [installEvent, setInstallEvent] = useState<any>(null);
    const sdkStarted = useRef(false);
    const initialTaskOpened = useRef(false);
    const say = (text: string, error = false) => setToast({ text, error });
    async function refresh(quiet = false) {
        if (!quiet)
            setLoading(true);
        try {
            const data: AppState = await api();
            setState(data);
            if (data.mode === 'demo') {
                let base = data.tasks;
                let history:Activity[]=[];
                const bundle=localStorage.getItem(DEMO_STATE_KEY);
                const saved = bundle || localStorage.getItem(DEMO_KEY);
                if (saved) {
                    try {
                        const value = JSON.parse(saved);
                        const parsed = bundle ? value.tasks : value;
                        if (!Array.isArray(parsed) || !parsed.every((taskItem: Task) => taskItem && typeof taskItem.id === 'string' && typeof taskItem.name === 'string' && typeof taskItem.done === 'boolean'))
                            throw new Error();
                        base = parsed;
                        history=recentActivity(bundle?value.activity:[]);
                    }
                    catch {
                        say('Bản lưu thử trên thiết bị không hợp lệ. Đã nạp lại dữ liệu mẫu.', true);
                    }
                }
                const expanded = expandRecurring(base.map(normalizeStoredTask), Date.now());
                for(const task of expanded.created)history=appendActivity(history,createActivity(null,task,{id:'recurring-'+task.id,at:new Date().toISOString(),source:'scheduler'}));
                if (expanded.changed || !bundle)
                    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({tasks:expanded.tasks,activity:history}));
                setTasks(expanded.tasks as Task[]);
                setActivity(history);
            }
            else{
                setTasks(data.tasks.map(normalizeStoredTask));
                setActivity(recentActivity(data.activity));
            }
            setLoadError('');
        }
        catch (e) {
            setLoadError((e as Error).message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void refresh();
        const id = setInterval(() => { setNow(Date.now()); void refresh(true); }, 300000);
        const visibility = () => {
            if (document.visibilityState === 'visible') {
                setNow(Date.now());
                void refresh(true);
            }
        };
        document.addEventListener('visibilitychange', visibility);
        const install = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
        window.addEventListener('beforeinstallprompt', install);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('beforeinstallprompt', install); };
    }, []);
    useEffect(() => {
        if (!toast)
            return;
        const id = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(id);
    }, [toast]);
    useEffect(() => {
        if (!tasks.length || initialTaskOpened.current)
            return;
        const id = new URLSearchParams(location.search).get('task');
        if (id) {
            const found = tasks.find(taskItem => taskItem.id === id);
            if (found) {
                setDraft(found);
                initialTaskOpened.current = true;
            }
        }
    }, [tasks]);
    useEffect(() => {
        if (!state?.pushAppId || state.mode !== 'live' || sdkStarted.current)
            return;
        sdkStarted.current = true;
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (s) => {
            try {
                await s.init({ appId: state.pushAppId, serviceWorkerPath: 'OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/' }, notifyButton: { enable: false }, welcomeNotification: { disable: true }, promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } } });
                setSdk(s);
                const sub = s.User.PushSubscription;
                if (sub.id && sub.optedIn) {
                    setDeviceId(sub.id);
                    setPushStatus('Đã bật trên thiết bị này');
                    await api({ action: 'subscribe', subscriptionId: sub.id });
                }
                sub.addEventListener('change', e => {
                    if (e.current.id && e.current.optedIn) {
                        setDeviceId(e.current.id);
                        setPushStatus('Đã bật trên thiết bị này');
                        void api({ action: 'subscribe', subscriptionId: e.current.id }).catch(() => say('Chưa lưu được thiết bị nhận thông báo. Hãy bật lại.', true));
                    }
                    else {
                        setDeviceId('');
                        setPushStatus('Chưa bật trên thiết bị này');
                    }
                });
            }
            catch {
                setPushStatus('Không tải được thông báo. Kiểm tra cấu hình OneSignal.');
            }
        });
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        script.onerror = () => setPushStatus('Không tải được dịch vụ thông báo.');
        document.head.appendChild(script);
    }, [state?.pushAppId, state?.mode]);
    async function enablePush() {
        if (!state?.pushReady) {
            say('Cần hoàn tất kết nối OneSignal trước khi bật thông báo.', true);
            setView('settings');
            return;
        }
        if (!sdk) {
            say('Dịch vụ thông báo đang khởi động. Hãy thử lại sau vài giây.', true);
            return;
        }
        if (!sdk.Notifications.isPushSupported()) {
            say('Hãy mở OnTrack trong Chrome hoặc Edge ở chế độ thường.', true);
            return;
        }
        try {
            await sdk.Notifications.requestPermission();
            if (!sdk.Notifications.permission) {
                say('Bạn chưa cấp quyền. Hãy bật Thông báo trong cài đặt trang của trình duyệt.', true);
                return;
            }
            await sdk.User.PushSubscription.optIn();
            const id = sdk.User.PushSubscription.id;
            if (id) {
                await api({ action: 'subscribe', subscriptionId: id });
                setDeviceId(id);
                setPushStatus('Đã bật trên thiết bị này');
                say('Đã đăng ký nhận thông báo trên thiết bị này.');
            }
            else
                say('Đang đăng ký thiết bị. Trạng thái sẽ được cập nhật tự động.');
        }
        catch {
            say('Chưa bật được thông báo. Kiểm tra quyền và kết nối mạng.', true);
        }
    }
    async function testPush() {
        if (!deviceId)
            return;
        setBusy(true);
        try {
            await api({ action: 'testPush', subscriptionId: deviceId });
            say('Đã chuyển thông báo thử đến dịch vụ gửi. Hãy kiểm tra thiết bị.');
        }
        catch (e) {
            say((e as Error).message, true);
        }
        finally {
            setBusy(false);
        }
    }
    async function persist(task: Task) {
        if (!state)
            return false;
        setBusy(true);
        try {
            if (state.mode === 'demo') {
                const edited = applyTaskEdit(tasks.find(taskItem => taskItem.id === task.id), task);
                const next = tasks.some(taskItem => taskItem.id === task.id) ? tasks.map(taskItem => taskItem.id === task.id ? edited : taskItem) : [...tasks, edited];
                const expanded = expandRecurring(next.map(normalizeStoredTask), Date.now());
                let history=appendActivity(activity,createActivity(tasks.find(taskItem=>taskItem.id===task.id),edited,{id:crypto.randomUUID(),at:new Date().toISOString()}));
                for(const child of expanded.created)history=appendActivity(history,createActivity(null,child,{id:'recurring-'+child.id,at:new Date().toISOString(),source:'scheduler'}));
                localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({tasks:expanded.tasks,activity:history}));
                setTasks(expanded.tasks as Task[]);
                setActivity(history);
                say('Đã lưu bản dùng thử trên thiết bị này.');
            }
            else {
                const data = await api({ action: 'save', task, baseVersion: task.version ?? null });
                setTasks(data.tasks);
                setActivity(recentActivity(data.activity));
                say('Đã lưu vào Google Sheet.');
            }
            return true;
        }
        catch (e) {
            say((e as Error).message, true);
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    function newTask(recurring = false, day = '') { setDraft({ id: crypto.randomUUID(), name: '', deadline: day ? `${day}T23:59:00+07:00` : '', done: false, pending: false, priority: 'normal', notes: '', createdAt: new Date().toISOString(), completedAt: null, updatedAt: null, repeat: recurring ? { type: 'interval', every: 1, unit: 'days' } : null }); }
    async function toggle(task: Task) { await persist({ ...task, done: !task.done, pending: false, completedAt: task.done ? null : new Date().toISOString(), updatedAt: new Date().toISOString() }); }
    async function togglePending(task: Task) { await persist({ ...task, pending: !task.pending, done: false, completedAt: null, updatedAt: new Date().toISOString() }); }
    async function loadActivity(){setActivityLoading(true);try{await refresh(true);}finally{setActivityLoading(false);}}
    async function install() {
        if (installEvent) {
            await installEvent.prompt();
            setInstallEvent(null);
        }
        else
            say('Android: menu ⋮ → Thêm vào màn hình chính / Cài đặt ứng dụng. Windows: menu Chrome hoặc Edge → Cài đặt OnTrack.');
    }
    const currentWeek = weekSummary(tasks, now);
    const displayWeek = view === 'stats' ? weekSummary(tasks, now, weekOffset) : currentWeek;
    const done = currentWeek.completed.length;
    const pct = currentWeek.percent;
    const pendingCount = tasks.filter(taskItem => !taskItem.done && taskItem.pending).length;
    const activeCount = tasks.filter(taskItem => !taskItem.done && !taskItem.pending).length;
    const overdue = tasks.filter(taskItem => taskBucket(taskItem, now) === 'overdue').length;
    const today = tasks.filter(taskItem => taskBucket(taskItem, now) === 'today').length;
    const visible: Task[] = listTasks(tasks, now, query, filter);
    const buckets = [{ id: 'overdue', name: t("Quá hạn") }, { id: 'active', name: t("Đang làm") }, { id: 'pending', name: t("Pending · Tạm dừng") }, { id: 'done', name: t("Đã hoàn thành") }];
    const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(now));
    const changeView = (v: View) => { setView(v); setFilter('all'); setQuery(''); };
    const taskFilters = (<div className="tools"><label className="search"><Search size={15}/><input aria-label={t("Tìm công việc")} placeholder={t("Tìm công việc của bạn…")} value={query} onChange={e => setQuery(e.target.value)}/></label><select className="filter" aria-label={t("Lọc công việc")} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{t("Tất cả công việc")}</option><option value="high">{t("Ưu tiên cao")}</option><option value="overdue">{t("Đang quá hạn")}</option><option value="active">{t("Đang làm")}</option><option value="today">{t("Hôm nay")}</option><option value="upcoming">{t("Sắp tới")}</option><option value="pending">Pending</option>{view === 'all' && <option value="done">{t("Đã hoàn thành")}</option>}</select></div>);
    return <div className="app"><aside className="sidebar"><Brand /><div className="brand-sub">Stay on task. Stay on time.</div><div className="nav-label">{t("Không gian của bạn")}</div><nav aria-label={t("Điều hướng")}>{nav.map(({ key, name, Icon }) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => changeView(key)}><Icon size={17}/>{t(name)}{key === 'all' && <span className="nav-count">{activeCount}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="quiet-note"><Leaf size={22}/><strong>{t("Từng việc nhỏ, tiến xa hơn.")}</strong>{t("Một danh sách gọn gàng. Một ngày chủ động hơn.")}</div><div className="profile"><span className="avatar">OT</span><div><strong style={{ fontSize: 12, fontWeight: 600 }}>{t("Không gian cá nhân")}</strong><div className="small" style={{ fontSize: 10 }}>{t("Chỉ dành cho bạn")}</div></div><ShieldCheck size={15} style={{ marginLeft: 'auto', color: '#8da07e' }}/></div></div></aside>
    <main className="main"><header className="topbar"><Brand mobile/><div className="breadcrumb">{t("Không gian cá nhân")}<ChevronRight size={13}/><strong>{t(nav.find(n => n.key === view)?.name)}</strong></div><div className="top-actions"><span className="top-date">{dateLabel}</span><button className="icon-button" title={t("Đồng bộ dữ liệu")} aria-label={t("Đồng bộ dữ liệu")} disabled={loading || busy} onClick={() => refresh()}><RefreshCw size={15}/></button><button className="icon-button activity-bell" title={t("Xem thông báo hoạt động")} aria-label={t("Xem thông báo hoạt động")} aria-haspopup="dialog" aria-expanded={activityOpen} disabled={loading||busy} onClick={()=>{setActivityOpen(true);void loadActivity();}}><Bell size={16}/>{activity.length>0&&<span className="activity-count" aria-hidden="true">{activity.length}</span>}</button><AccountMenu/></div></header>
      <div className="content"><div className="intro"><div><div className="eyebrow">YOUR DAY, ON TRACK</div><h1>{t(titles[view])}</h1><p className="subtitle">{t(subtitles[view])}</p></div><button className="primary" aria-label={t("Thêm công việc")} onClick={() => newTask(view === 'recurring')} disabled={loading || !state || busy}><Plus size={17}/><span>{t("Thêm công việc")}</span></button></div>
      {state && <div className={`connection ${state.mode === 'live' ? 'live' : ''}`}><Cloud size={15}/><span>{state.mode === 'demo' ? t("Bản dùng thử · Thay đổi chỉ lưu trên thiết bị này.") : t("Đã kết nối Google Sheet · Tự động làm mới mỗi 5 phút.")}</span><button onClick={() => changeView('settings')}>{state.mode === 'demo' ? t("Kết nối Sheet") : t("Chi tiết")}</button></div>}
      {loadError && <div className="connection" role="alert"><CircleHelp size={16}/><span>{t(loadError)}{" " + t("Dữ liệu hiện có chưa được làm mới.")}</span><button onClick={() => refresh()}>{t("Thử lại")}</button></div>}
      {loading && !state ? <div className="loading"><LoaderCircle size={23} style={{ margin: '0 auto 14px' }}/>{t("Đang mở không gian của bạn…")}</div> : <>
      {view === 'all' && <div className="stats-grid">{[{ label: t("Tổng công việc trong tuần"), value: displayWeek.tasks.length, foot: `${displayWeek.start.slice(8)}/${displayWeek.start.slice(5, 7)} – ${displayWeek.end.slice(8)}/${displayWeek.end.slice(5, 7)}`, Icon: ListTodo }, { label: t("Hoàn thành tuần này"), value: displayWeek.completed.length, foot: t("Theo deadline · Thứ Hai–Chủ nhật"), Icon: CheckCheck }, { label: t("Đến hạn hôm nay"), value: today, foot: t("Việc chưa hoàn thành"), Icon: CalendarDays }, { label: t("Đang quá hạn"), value: overdue, foot: overdue ? t("Ưu tiên xử lý những việc này") : t("Mọi deadline vẫn trong tầm tay"), Icon: Clock3 }].map((s, i) => <div className={`stat ${i === 3 ? 'overdue' : ''}`} key={t(s.label)}><div className="stat-top">{t(s.label)}<span className="stat-icon"><s.Icon size={15}/></span></div><div className="stat-number">{String(s.value).padStart(2, '0')}</div><div className="stat-foot">{s.foot}</div></div>)}</div>}
      {view === 'all' && <div className="work-view-switch" role="group" aria-label={t("Cách hiển thị công việc")}><button aria-pressed={workLayout === 'list'} className={workLayout === 'list' ? 'active' : ''} onClick={() => setWorkLayout('list')}><ListTodo size={15}/>{t("Danh sách")}</button><button aria-pressed={workLayout === 'calendar'} className={workLayout === 'calendar' ? 'active' : ''} onClick={() => setWorkLayout('calendar')}><CalendarDays size={15}/>{t("Lịch tháng")}</button></div>}
      {view === 'all' && workLayout === 'calendar' && <MonthCalendar tasks={visible} now={now} offset={monthOffset} onOffset={setMonthOffset} onEdit={setDraft} onAdd={day => newTask(false, day)} busy={busy} filters={taskFilters}/>}
      {view === 'all' && workLayout === 'list' && <div className="workspace-grid"><section className="panel"><div className="panel-head"><div><h2>{t("Danh sách công việc")}</h2><p>{t("Toàn bộ công việc, ưu tiên việc quá hạn trước.")}</p></div><span className="day-chip">{t("{0} công việc", {"0":visible.length})}</span></div>{taskFilters}
      {buckets.map(b => {
                    const items = visible.filter(taskItem => taskListGroup(taskItem, now) === b.id);
                    if (!items.length)
                        return null;
                    return <div key={b.id}><div className={`task-section-title ${b.id === 'overdue' ? 'danger' : ''}`}>{b.id === 'pending' ? <Pause size={12}/> : b.id === 'overdue' ? <Clock3 size={12}/> : b.id === 'done' ? <CheckCheck size={12}/> : <CalendarDays size={12}/>} {t(b.name)}<span style={{ marginLeft: 'auto', fontSize: 10 }}>{items.length}</span></div>{items.map(taskItem => <div className={`task-row ${taskItem.done ? 'completed' : ''} ${taskItem.pending ? 'is-pending' : ''}`} key={taskItem.id}><button className={`task-check ${taskItem.done ? 'checked' : ''}`} aria-label={`${taskItem.done ? t("Mở lại") : t("Hoàn thành")}: ${taskItem.name}`} aria-pressed={taskItem.done} disabled={busy} onClick={() => toggle(taskItem)}>{taskItem.done && <Check size={13}/>}</button><div className="task-info"><button className="task-name" disabled={busy} onClick={() => setDraft(taskItem)}>{taskItem.name}</button><div className="task-meta"><span className={b.id === 'overdue' ? 'late' : ''}><CalendarDays size={11}/>{t(formatDue(taskItem.deadline, locale))}</span><span className={`priority ${taskItem.priority || 'normal'}`}>{taskItem.priority === 'high' ? 'Cao' : taskItem.priority === 'low' ? t("Thấp") : t("Vừa")}</span>{(taskItem.repeat || taskItem.seriesId) && <span><Repeat2 size={11}/>{t("Định kỳ")}</span>}{taskItem.pending && <span className="pending-badge">Pending</span>}{taskItem.notes && <span>{t("Có ghi chú")}</span>}</div></div><div className="task-end">{!taskItem.done && <button disabled={busy} title={taskItem.pending ? t("Tiếp tục công việc") : t("Chuyển sang Pending")} aria-label={`${taskItem.pending ? t("Tiếp tục") : 'Pending'}: ${taskItem.name}`} onClick={() => togglePending(taskItem)}>{taskItem.pending ? <Play size={14}/> : <Pause size={14}/>}</button>}<button disabled={busy} aria-label={t("Sửa: {0}", { "0": taskItem.name })} onClick={() => setDraft(taskItem)}><Pencil size={13}/></button></div></div>)}</div>;
                })}
      {!visible.length && <div className="empty"><Sparkles size={24} style={{ margin: '0 auto 10px' }}/>{filter === 'done' ? t("Chưa có công việc đã hoàn thành.") : query || filter !== 'all' ? t("Không có công việc khớp bộ lọc.") : t("Bạn đã có một danh sách thật gọn. Thêm việc mới khi sẵn sàng.")}</div>}</section><aside className="right-stack"><section className="panel progress-panel"><div className="progress-top"><h3>{t("Tiến độ tuần này")}</h3><Target size={17}/></div><div className="progress-ring" style={{ background: `conic-gradient(var(--progress-fill, #7e9e66) ${pct}%, var(--progress-track, #dce5d0) 0)` }}><div className="ring-label"><strong>{pct}%</strong><span>{t("đã hoàn thành")}</span></div></div><p className="progress-description"><strong>{done} / {t("{0} công việc", {"0":currentWeek.tasks.length})}</strong>{" " + t("đã xong.")}</p><div className="legend"><span><i className="dot"/>{t("Đã xong")}</span><span><i className="dot light"/>{t("Còn lại")}</span></div></section><section className="panel reminder-card"><div className="reminder-icon"><Bell size={18}/></div><h3>{t("Để OnTrack nhắc bạn")}</h3><p>{t("Nhận nhắc deadline ngay trên Android và Windows, kể cả khi bạn rời app.")}</p><button className="secondary" onClick={() => changeView('settings')}>{deviceId ? t("Quản lý thông báo") : t("Thiết lập thông báo")}<ArrowUpRight size={14}/></button></section></aside></div>}
      {view === 'stats' && <AnalyticsDashboard tasks={tasks} now={now} offset={weekOffset} onOffset={setWeekOffset} onViewTasks={selected => { changeView('all'); setFilter(selected); }}/>}
      {view === 'recurring' && <RecurringTasks tasks={tasks} busy={busy} onEdit={setDraft} onAdd={() => newTask(true)}/>}
      {view === 'settings' && <div className="settings-grid"><AppearanceSettings /><section className="panel setting-card"><div className="setting-title"><Cloud size={20}/><h2>Google Sheet</h2></div><span className={`status-tag ${state?.mode === 'live' ? 'ready' : ''}`}>{state?.mode === 'live' ? t("Đã kết nối") : t("Chưa kết nối trực tiếp")}</span><p>{state?.mode === 'live' ? t("Thêm, sửa và hoàn thành công việc sẽ được ghi về Sheet.") : t("Bạn đang xem dữ liệu mẫu. Bản dùng thử lưu trên từng thiết bị; dữ liệu chưa được đồng bộ về Sheet gốc.")}</p><a className="secondary" href="https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit" target="_blank" rel="noreferrer">{t("Mở Sheet gốc")}<ExternalLink size={13}/></a><button className="secondary" onClick={() => refresh()} disabled={loading}>{t("Kiểm tra kết nối")}<RefreshCw size={13}/></button></section>
      <section className="panel setting-card"><div className="setting-title"><Bell size={20}/><h2>{t("Thông báo deadline")}</h2></div><span className={`status-tag ${deviceId ? 'ready' : ''}`}>{state?.pushReady ? t(pushStatus) : t("Chưa cấu hình OneSignal")}</span><p>{t("Kiểm tra mỗi") + " "}<strong>{t("5 phút")}</strong>{t(". Nhắc trước 1 ngày, 1 giờ và khi đến hạn; mỗi mốc gửi một lần. Thời điểm nhận còn phụ thuộc mạng và cài đặt thiết bị.")}</p><button className="primary" onClick={enablePush} disabled={!state?.pushReady}>{t("Bật trên thiết bị này")}<Bell size={14}/></button><button className="secondary" disabled={!deviceId || busy} onClick={testPush}>{t("Gửi thông báo thử")}</button><div className="small">{state?.schedulerActive ? t("Lịch kiểm tra đã được cài đặt.") : t("Lịch kiểm tra chưa được kích hoạt.")}{state?.lastCheck && t(" Lần gần nhất: {0}.", { "0": new Date(state.lastCheck).toLocaleString(locale, { timeZone: 'Asia/Ho_Chi_Minh' }) })}{state?.lastCheckError && t(" Lần kiểm tra gần nhất gặp lỗi; cần kiểm tra cấu hình.")}</div></section>
      <section className="panel setting-card"><div className="setting-title"><Download size={20}/><h2>{t("Cài OnTrack")}</h2></div><p>{t("Mở nhanh từ màn hình chính, cùng một địa chỉ trên hai thiết bị.")}</p><ol className="install-steps"><li>{t("Android: mở bằng Chrome → menu ⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính.")}</li><li>{t("Windows: mở bằng Chrome hoặc Edge → menu → Cài đặt OnTrack.")}</li><li>{t("Đăng nhập cùng tài khoản có quyền vào app và bật thông báo trên từng thiết bị.")}</li></ol><button className="secondary" style={{ marginTop: 17 }} onClick={install}>{t("Cài trên thiết bị này")}<Download size={13}/></button></section>
      <section className="panel setting-card"><div className="setting-title"><Clock3 size={20}/><h2>{t("Thời gian & dữ liệu")}</h2></div><p>{t("Múi giờ:") + " "}<strong>{t("Việt Nam (UTC+7)")}</strong>.<br />{t("Deadline chỉ có ngày: hết hạn lúc") + " "}<strong>23:59</strong>.<br />{t("Bạn có thể chọn giờ cụ thể khi thêm hoặc sửa task.")}<br />{t("Dòng trống trong Sheet được bỏ qua.")}</p><div className="notice">{t("Bản dùng thử không tự nhập thay đổi vào Sheet khi kết nối. Hãy dùng nó để trải nghiệm thao tác.")}</div></section>
      <section className="panel setting-card settings-full"><div className="setting-title"><ShieldCheck size={20}/><h2>{t("Kích hoạt lần đầu")}</h2></div><p>{t("Cần cấu hình Google Apps Script và OneSignal trong tài khoản của bạn. Không cần thuê server. Hướng dẫn và mã cài đặt đã được chuẩn bị trong gói OnTrack đi kèm cuộc trò chuyện.")}</p><ol className="setup-list"><li>{t("Thêm mã OnTrack vào Apps Script của Sheet và chạy thiết lập.")}</li><li>{t("Tạo ứng dụng Web Push trong OneSignal cho đúng địa chỉ OnTrack.")}</li><li>{t("Cấu hình kết nối bảo mật cho app, rồi bật thông báo trên Android và Windows.")}</li></ol></section></div>}
      </>}
      <div className="footer-note"><Leaf size={12}/>{t("Ít bỏ lỡ hơn. Nhiều khoảng trống hơn.")}</div></div>
    </main><nav className="bottom-nav" aria-label={t("Điều hướng điện thoại")}>{nav.map(({ key, name, Icon }) => <button key={key} className={view === key ? 'active' : ''} onClick={() => changeView(key)}><Icon size={20}/>{t(name)}</button>)}</nav>
    {draft && <TaskModal key={draft.id} task={draft} onEditSeries={id => {
                const root = tasks.find(taskItem => taskItem.id === id);
                if (root)
                    setDraft(root);
                else
                    say("Không tìm thấy lịch gốc. Hãy đồng bộ lại.", true);
            }} busy={busy} onClose={() => setDraft(null)} onSave={async (taskItem) => {
                if (await persist(taskItem))
                    setDraft(null);
            }}/>}{activityOpen&&<ActivityPanel entries={activity} mode={state?.mode||'demo'} loading={activityLoading} error={loadError} ready={state?.mode==='demo'||Boolean(state?.activityReady)} onRefresh={()=>void loadActivity()} onClose={()=>setActivityOpen(false)}/>} {toast && <div className={`toast ${toast.error ? 'error-toast' : ''}`} role={toast.error ? 'alert' : 'status'}>{t(toast.text)}</div>}
  </div>;
}
