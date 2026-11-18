export function dueTimestamp(deadline) {
  if (!deadline) return Infinity;
  return Date.parse(deadline.length === 10 ? `${deadline}T23:59:00+07:00` : deadline);
}
export function vnDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export function taskBucket(task, now = Date.now()) {
  if (task.done) return 'done';
  if (task.pending) return 'pending';
  if (!task.deadline) return 'undated';
  if (dueTimestamp(task.deadline) < now) return 'overdue';
  if (task.deadline.slice(0,10) === vnDay(new Date(now))) return 'today';
  return 'upcoming';
}
export function validateTask(input) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 500) throw new Error('Tên công việc cần từ 1 đến 500 ký tự.');
  const deadline = input.deadline || '';
  if (deadline && !validDeadline(deadline)) throw new Error('Deadline không hợp lệ.');
  if (!['normal','high','low'].includes(input.priority || 'normal')) throw new Error('Mức ưu tiên không hợp lệ.');
  if (typeof input.done !== 'boolean') throw new Error('Trạng thái không hợp lệ.');
  if (input.notes && (typeof input.notes !== 'string' || input.notes.length > 4000)) throw new Error('Ghi chú tối đa 4.000 ký tự.');
  if (input.pending !== undefined && typeof input.pending !== 'boolean') throw new Error('Trạng thái Pending không hợp lệ.');
  const repeat = validateRecurrence(input.repeat);
  if (repeat && !deadline) throw new Error('Công việc định kỳ cần có deadline bắt đầu.');
  return {name:input.name.trim(), deadline, done:input.done, pending:!input.done && Boolean(input.pending), priority:input.priority || 'normal', notes:input.notes || '',repeat};
}

export function validDeadline(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:00\+07:00)?$/.test(value))return false;
  const date=new Date(value.slice(0,10)+'T12:00:00Z');
  if(isNaN(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10))return false;
  return value.length===10 || (Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60);
}
export function addDayKey(day,amount) {
  return new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
}
export function weekBounds(now=Date.now(),offset=0) {
  const day=vnDay(new Date(now));
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const start=addDayKey(day,-((weekday+6)%7)+offset*7);
  return {start,end:addDayKey(start,6)};
}
export function inDeadlineWeek(task,now=Date.now(),offset=0) {
  const {start,end}=weekBounds(now,offset);const key=(task.deadline||'').slice(0,10);
  return Boolean(key&&key>=start&&key<=end);
}
export function weekSummary(tasks,now=Date.now(),offset=0) {
  const bounds=weekBounds(now,offset);const selected=tasks.filter(t=>inDeadlineWeek(t,now,offset));
  const completed=selected.filter(t=>t.done);
  const days=Array.from({length:7},(_,i)=>{const key=addDayKey(bounds.start,i);return {key,label:key.slice(8)+'/'+key.slice(5,7),weekday:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],count:selected.filter(t=>!t.done&&!t.pending&&t.deadline.slice(0,10)===key).length};});
  return {...bounds,tasks:selected,completed,days,percent:selected.length?Math.round(completed.length/selected.length*100):0};
}
export function validateRecurrence(value) {
  if(!value||value.type==='none')return null;
  if(typeof value!=='object')throw new Error('Lịch định kỳ không hợp lệ.');
  if(value.type==='interval'){
    if(!Number.isInteger(value.every)||value.every<1||value.every>365||!['hours','days'].includes(value.unit))throw new Error('Khoảng lặp phải từ 1 đến 365 giờ hoặc ngày.');
    return {type:'interval',every:value.every,unit:value.unit};
  }
  if(value.type==='weekly'){
    if(!Array.isArray(value.weekdays)||!value.weekdays.length||value.weekdays.length>7||!value.weekdays.every(d=>Number.isInteger(d)&&d>=1&&d<=7))throw new Error('Hãy chọn ít nhất một thứ trong tuần.');
    return {type:'weekly',weekdays:[...new Set(value.weekdays)].sort((a,b)=>a-b)};
  }
  if(value.type==='monthly'){
    if(!Number.isInteger(value.day)||value.day<1||value.day>31)throw new Error('Ngày lặp trong tháng phải từ 1 đến 31.');
    return {type:'monthly',day:value.day};
  }
  throw new Error('Kiểu định kỳ không hợp lệ.');
}
export function vnTimestamp(ms) { return new Date(ms+7*3600000).toISOString().slice(0,19)+'+07:00'; }
export function nextOccurrence(deadline,repeat) {
  const rule=validateRecurrence(repeat);if(!rule||!validDeadline(deadline))throw new Error('Lịch định kỳ cần deadline hợp lệ.');
  if(rule.type==='interval')return vnTimestamp(dueTimestamp(deadline)+rule.every*(rule.unit==='hours'?3600000:86400000));
  const key=deadline.slice(0,10);const time=deadline.length>10?deadline.slice(11,16):'23:59';
  if(rule.type==='weekly'){
    for(let i=1;i<=7;i++){const next=addDayKey(key,i);const wd=((new Date(next+'T12:00:00Z').getUTCDay()+6)%7)+1;if(rule.weekdays.includes(wd))return next+'T'+time+':00+07:00';}
  }
  let year=Number(key.slice(0,4)),month=Number(key.slice(5,7));
  for(let step=0;step<2;step++){
    const last=new Date(Date.UTC(year,month,0)).getUTCDate();
    const next=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(rule.day,last)).padStart(2,'0');
    if(next>key)return next+'T'+time+':00+07:00';
    month++;if(month===13){month=1;year++;}
  }
  throw new Error('Không tính được kỳ tiếp theo.');
}
export function recurrenceLabel(repeat) {
  const r=validateRecurrence(repeat);if(!r)return 'Không lặp';
  if(r.type==='interval')return 'Mỗi '+r.every+' '+(r.unit==='hours'?'giờ':'ngày');
  if(r.type==='weekly')return 'Hàng tuần · '+r.weekdays.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d-1]).join(', ');
  return 'Hàng tháng · ngày '+r.day;
}
export function occurrenceId(key) {
  let a=2166136261,b=2246822507,c=3266489909,d=668265263;
  for(let i=0;i<key.length;i++){const n=key.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b^n,2246822519);c=Math.imul(c^n,3266489917);d=Math.imul(d^n,668265263);}
  return 'repeat-'+[a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
export function expandRecurring(input,now=Date.now(),limit=100) {
  const tasks=input.map(t=>({...t}));const created=[];const known=new Set(tasks.map(t=>t.occurrenceKey).filter(Boolean));const ids=new Set(tasks.map(t=>t.id));let changed=false,hasMore=false;
  for(const root of tasks.slice()){
    if(!root.repeat||root.seriesId)continue;
    const repeat=validateRecurrence(root.repeat);if(!validDeadline(root.deadline))throw new Error('Task định kỳ chưa có deadline hợp lệ.');
    const signature=JSON.stringify([root.deadline,repeat]);
    let last=root.recurrenceCursor?.signature===signature?root.recurrenceCursor.lastDeadline:root.deadline;
    if(!validDeadline(last))last=root.deadline;
    let steps=0;
    while(dueTimestamp(last)<=now&&created.length<limit&&steps++<1000){
      const deadline=nextOccurrence(last,repeat);const key=root.id+'|'+deadline;const id=occurrenceId(key);
      if(!known.has(key)){
        if(ids.has(id))throw new Error('Mã task định kỳ bị trùng. Dừng tạo để bảo toàn dữ liệu.');
        const stamp=new Date(now).toISOString();const task={id,name:root.name,deadline,done:false,pending:false,priority:root.priority||'normal',notes:root.notes||'',createdAt:stamp,updatedAt:stamp,completedAt:null,repeat:null,seriesId:root.id,occurrenceKey:key};
        tasks.push(task);created.push(task);known.add(key);ids.add(id);
      }
      last=deadline;
    }
    const cursor={signature,lastDeadline:last};
    if(JSON.stringify(root.recurrenceCursor)!==JSON.stringify(cursor)){root.recurrenceCursor=cursor;changed=true;}
    if(dueTimestamp(last)<=now)hasMore=true;
  }
  return {tasks,created,changed:changed||created.length>0,hasMore};
}
export function normalizeStoredTask(task) {
  return {...task,pending:Boolean(task.pending)&&!task.done,priority:task.priority||'normal',repeat:validateRecurrence(task.repeat)};
}
export function reminderEligible(task) { return Boolean(!task.done&&!task.pending&&task.deadline); }
export function applyTaskEdit(previous,input) {
  const next={...previous,...input};
  if(!next.repeat){next.recurrenceCursor=null;return next;}
  if(previous?.repeat&&previous.recurrenceCursor&&dueTimestamp(previous.deadline)===dueTimestamp(next.deadline)){
    next.recurrenceCursor={signature:JSON.stringify([next.deadline,validateRecurrence(next.repeat)]),lastDeadline:previous.recurrenceCursor.lastDeadline};
  }else next.recurrenceCursor=null;
  return next;
}
