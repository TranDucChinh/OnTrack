/** OnTrack — bound to the existing Google Sheet. Secrets belong in Script Properties. */
var OT_TZ = 'Asia/Ho_Chi_Minh';
var OT_SHEET_ID = 'YOUR_SPREADSHEET_ID';
var OT_TAB = 'Deadline';
var OT_EXTRA = ['task_id','created_at','completed_at','updated_at','priority','notes','deadline_has_time','reminder_state','pending','recurrence','recurrence_cursor','series_id','occurrence_key'];

function setupOnTrack() {
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var p=PropertiesService.getScriptProperties();
    if(!p.getProperty('ONTRACK_API_TOKEN'))p.setProperty('ONTRACK_API_TOKEN',Utilities.getUuid()+Utilities.getUuid());
    var sheet=otSheet_();
    if(sheet.getMaxColumns()<17)sheet.insertColumnsAfter(sheet.getMaxColumns(),17-sheet.getMaxColumns());
    var current=sheet.getRange(1,1,1,4).getValues()[0];
    if(current.join('|')!=='Id|Name|Date|Done')throw new Error('Tên cột phải là Id, Name, Date, Done ở A:D.');
    var extra=sheet.getRange(1,5,1,OT_EXTRA.length).getValues()[0];
    extra.forEach(function(v,i){if(v&&v!==OT_EXTRA[i])throw new Error('Cột '+(i+5)+' đã có dữ liệu khác. Dừng để bảo toàn dữ liệu.');});
    sheet.getRange(1,5,1,OT_EXTRA.length).setValues([OT_EXTRA]);
    var rows=sheet.getDataRange().getValues();
    var ids={};
    for(var i=1;i<rows.length;i++){
      var r=rows[i];if(!String(r[1]||'').trim())continue;
      if(r[4]&&ids[r[4]])throw new Error('Trùng task_id. Hãy kiểm tra trước khi tiếp tục.');
      if(!r[4]){r[4]=Utilities.getUuid();sheet.getRange(i+1,5).setValue(r[4]);}
      ids[r[4]]=true;
      // Existing completed tasks keep unknown created/completed times.
    }
    SpreadsheetApp.flush();
    return 'Đã chuẩn bị dữ liệu. Mã kết nối nằm trong Project Settings → Script Properties → ONTRACK_API_TOKEN. Chưa bật lịch nhắc.';
  } finally {lock.releaseLock();}
}

function installReminders(){
  var p=PropertiesService.getScriptProperties();
  ['ONTRACK_API_TOKEN','ONESIGNAL_APP_ID','ONESIGNAL_API_KEY','ONTRACK_APP_URL'].forEach(function(k){if(!p.getProperty(k))throw new Error('Thiếu Script Property: '+k);});
  otAppUrl_();installTaskScheduler();
  if(!p.getProperty('REMINDERS_ENABLED_AT'))p.setProperty('REMINDERS_ENABLED_AT',new Date().toISOString());
  return 'Đã bật lịch 5 phút cho công việc định kỳ và nhắc deadline.';
}
function installTaskScheduler(){
  if(!PropertiesService.getScriptProperties().getProperty('ONTRACK_API_TOKEN'))throw new Error('Chạy setupOnTrack trước.');
  otRows_();
  var found=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='checkDeadlines';});
  if(!found.length)ScriptApp.newTrigger('checkDeadlines').timeBased().everyMinutes(5).create();
  else found.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);});
  PropertiesService.getScriptProperties().setProperty('REMINDERS_ACTIVE','true');
  return 'Đã bật tạo công việc định kỳ mỗi 5 phút. Web Push cần cấu hình OneSignal riêng.';
}

function doPost(e){
  var lock=LockService.getScriptLock();
  try{
    var b=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    var token=PropertiesService.getScriptProperties().getProperty('ONTRACK_API_TOKEN');
    if(!token||b.token!==token)return otJson_({ok:false,error:'Kết nối chưa được xác thực.'});
    lock.waitLock(20000);
    if(b.action==='list'){otGenerateRecurring_();return otJson_(otState_());}
    if(b.action==='save'){otSave_(b);otGenerateRecurring_();return otJson_(otState_());}
    if(b.action==='subscribe'){
      otAssertDevice_(b.subscriptionId);var p=PropertiesService.getScriptProperties();
      var devices=JSON.parse(p.getProperty('PUSH_DEVICES')||'[]');
      if(devices.indexOf(b.subscriptionId)<0){if(devices.length>=20)throw new Error('Tối đa 20 thiết bị. Cần dọn thiết bị cũ.');devices.push(b.subscriptionId);p.setProperty('PUSH_DEVICES',JSON.stringify(devices));}
      return otJson_({ok:true});
    }
    if(b.action==='testPush'){
      otAssertDevice_(b.subscriptionId);
      var registered=JSON.parse(PropertiesService.getScriptProperties().getProperty('PUSH_DEVICES')||'[]');
      if(registered.indexOf(b.subscriptionId)<0)throw new Error('Thiết bị chưa đăng ký.');
      otSend_([b.subscriptionId],'OnTrack · Đã sẵn sàng','Thiết bị này đã nhận được thông báo thử. Deadline tiếp theo sẽ được kiểm tra mỗi 5 phút.',otAppUrl_(),Utilities.getUuid());
      return otJson_({ok:true});
    }
    return otJson_({ok:false,error:'Thao tác không được hỗ trợ.'});
  }catch(err){return otJson_({ok:false,code:err.otCode||'error',error:err.message||'Thao tác thất bại.'});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function doGet(){return otJson_({ok:false,error:'OnTrack chỉ nhận yêu cầu đã xác thực.'});}
function otJson_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
function otSheet_(){var s=SpreadsheetApp.openById(OT_SHEET_ID).getSheetByName(OT_TAB);if(!s)throw new Error('Không tìm thấy tab Deadline.');return s;}
function otRows_(){
  var rows=otSheet_().getDataRange().getValues();
  if(rows[0].slice(4,4+OT_EXTRA.length).join('|')!==OT_EXTRA.join('|'))throw new Error('Hãy chạy setupOnTrack trước.');
  var ids={};return rows.slice(1).map(function(r,i){return {r:r,row:i+2};}).filter(function(o){return String(o.r[1]||'').trim();}).map(function(o){
    var r=o.r;if(!r[4])throw new Error('Có task chưa có mã. Chạy lại setupOnTrack sau khi nhập trực tiếp trong Sheet.');
    if(ids[r[4]])throw new Error('Có mã task trùng. Hãy kiểm tra Sheet.');ids[r[4]]=true;
    return {row:o.row,raw:r,task:otTask_(r)};
  });
}
function otIso_(v){return v instanceof Date&&!isNaN(v)?v.toISOString():(v?String(v):null);}
function otTask_(r){
  var deadline='';
  if(r[2]){
    if(!(r[2] instanceof Date)||isNaN(r[2]))throw new Error('Deadline của một task không phải ngày hợp lệ.');
    var hasTime=r[10]===true||Utilities.formatDate(r[2],OT_TZ,'HH:mm:ss')!=='00:00:00';
    deadline=Utilities.formatDate(r[2],OT_TZ,hasTime?"yyyy-MM-dd'T'HH:mm:ss'+07:00'":'yyyy-MM-dd');
  }
  var repeat=null,cursor=null;
  try{repeat=r[13]?validateRecurrence(JSON.parse(r[13])):null;cursor=r[14]?JSON.parse(r[14]):null;}catch(err){throw new Error('Lịch định kỳ trong Sheet không hợp lệ.');}
  var task=normalizeStoredTask({id:String(r[4]),name:String(r[1]),deadline:deadline,done:r[3]===true,pending:r[12]===true,createdAt:otIso_(r[5]),completedAt:otIso_(r[6]),updatedAt:otIso_(r[7]),priority:r[8]||'normal',notes:String(r[9]||''),repeat:repeat,recurrenceCursor:cursor,seriesId:String(r[15]||''),occurrenceKey:String(r[16]||'')});
  task.version=otHash_(JSON.stringify([task.name,task.deadline,task.done,task.priority,task.notes,task.completedAt,task.pending,task.repeat,task.seriesId]));
  return task;
}

function otHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(function(n){return ('0'+((n+256)%256).toString(16)).slice(-2);}).join('');}
function otState_(){
  var p=PropertiesService.getScriptProperties();
  return {ok:true,schemaVersion:2,tasks:otRows_().map(function(o){return o.task;}),pushReady:!!(p.getProperty('ONESIGNAL_APP_ID')&&p.getProperty('ONESIGNAL_API_KEY')),schedulerActive:ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='checkDeadlines';}),lastCheck:p.getProperty('LAST_CHECK'),lastCheckError:!!p.getProperty('LAST_CHECK_ERROR'),deviceCount:JSON.parse(p.getProperty('PUSH_DEVICES')||'[]').length};
}
function otParseDue_(value){
  if(!value)return null;
  if(!validDeadline(value))throw new Error('Deadline không hợp lệ.');
  return new Date(value.length===10?value+'T00:00:00+07:00':value);
}

function otText_(value){return /^[=+@-]/.test(value)?"'"+value:value;}
function otSame_(a,b){return ['name','deadline','done','pending','priority','notes'].every(function(k){return a[k]===b[k];})&&JSON.stringify(a.repeat)===JSON.stringify(b.repeat);}
function otSave_(b){
  var original=b.task||{};
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(original.id||''))throw new Error('Mã task không hợp lệ.');
  var t=validateTask(original);t.id=original.id;
  var records=otRows_();var existing=records.filter(function(o){return o.task.id===t.id;})[0];
  if(existing&&existing.task.seriesId&&t.repeat)throw new Error('Hãy sửa lịch ở task gốc.');
  if(existing&&existing.task.version!==b.baseVersion){if(otSame_(existing.task,t))return;var err=new Error('Task đã thay đổi ở nơi khác. Đồng bộ lại rồi mở task để chỉnh sửa.');err.otCode='conflict';throw err;}
  if(!existing&&b.baseVersion){var gone=new Error('Task đã bị xóa khỏi Sheet. Đồng bộ lại trước khi lưu.');gone.otCode='conflict';throw gone;}
  var sheet=otSheet_();var row=existing?existing.row:sheet.getLastRow()+1;var now=new Date();otEnsureRows_(sheet,row);
  if(!existing)sheet.getRange(row,1).setFormula('=IF(B'+row+'="", "", SUBTOTAL(103, $B$2:B'+row+'))');
  var complete=t.done?(existing&&existing.task.done?existing.raw[6]:now):'';
  var reminders=existing&&existing.task.deadline===t.deadline&&existing.task.done===t.done?(existing.raw[11]||''):'';
  var edited=applyTaskEdit(existing?existing.task:null,t);var cursor=edited.recurrenceCursor?JSON.stringify(edited.recurrenceCursor):'';
  sheet.getRange(row,2,1,16).setValues([[otText_(t.name),otParseDue_(t.deadline)||'',t.done,t.id,existing?existing.raw[5]:now,complete,now,t.priority,otText_(t.notes),t.deadline.length>10,reminders,t.pending,t.repeat?JSON.stringify(t.repeat):'',cursor,existing?(existing.raw[15]||''):'',existing?(existing.raw[16]||''):'']]);
  sheet.getRange(row,3).setNumberFormat(t.deadline.length>10?'dd/MM/yyyy HH:mm':'dd/MM/yyyy');
  SpreadsheetApp.flush();
}
function otEnsureRows_(sheet,last){var size=sheet.getMaxRows();if(last>size)sheet.insertRowsAfter(size,last-size);}
function otGenerateRecurring_(){
  var records=otRows_();var expanded=expandRecurring(records.map(function(o){return o.task;}),Date.now(),100);
  if(!expanded.changed)return;
  var sheet=otSheet_();
  // Append occurrences first. Stable occurrence keys make retries safe if the cursor write is interrupted.
  if(expanded.created.length){
    var first=sheet.getLastRow()+1;otEnsureRows_(sheet,first+expanded.created.length-1);
    var rows=expanded.created.map(function(t,i){var row=first+i;return ['=IF(B'+row+'="", "", SUBTOTAL(103, $B$2:B'+row+'))',otText_(t.name),otParseDue_(t.deadline),false,t.id,new Date(t.createdAt),'',new Date(t.updatedAt),t.priority,otText_(t.notes),true,'',false,'','',t.seriesId,t.occurrenceKey];});
    sheet.getRange(first,1,rows.length,17).setValues(rows);
    sheet.getRange(first,3,rows.length,1).setNumberFormat('dd/MM/yyyy HH:mm');
    SpreadsheetApp.flush();
  }
  var byId={};expanded.tasks.forEach(function(t){byId[t.id]=t;});
  records.forEach(function(o){var t=byId[o.task.id];if(JSON.stringify(t.recurrenceCursor)!==JSON.stringify(o.task.recurrenceCursor))sheet.getRange(o.row,15).setValue(t.recurrenceCursor?JSON.stringify(t.recurrenceCursor):'');});
  SpreadsheetApp.flush();
}

function otAssertDevice_(id){if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('Mã thiết bị không hợp lệ.');}
function otAppUrl_(){var url=PropertiesService.getScriptProperties().getProperty('ONTRACK_APP_URL')||'';if(!/^https:\/\/[^/?#]+\/?$/.test(url))throw new Error('ONTRACK_APP_URL phải là địa chỉ HTTPS gốc của app.');return url.replace(/\/$/,'');}
function otDueMs_(deadline){return Date.parse(deadline.length===10?deadline+'T23:59:00+07:00':deadline);}
function otStage_(deadline,now,enabled){
  var due=otDueMs_(deadline);if(!isFinite(due)||due<enabled)return null;
  var remaining=due-now;
  if(remaining<=0)return now-due<=86400000?'due':null;
  if(remaining<=3600000)return '1h';
  if(remaining<=86400000)return '24h';
  return null;
}
function checkDeadlines(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  var p=PropertiesService.getScriptProperties();
  try{
    p.setProperty('LAST_CHECK',new Date().toISOString());
    otGenerateRecurring_();
    var devices=JSON.parse(p.getProperty('PUSH_DEVICES')||'[]');
    if(!devices.length){p.deleteProperty('LAST_CHECK_ERROR');return;}
    var now=Date.now();var enabled=Date.parse(p.getProperty('REMINDERS_ENABLED_AT')||new Date(now).toISOString());
    var appUrl=otAppUrl_();var records=otRows_();var sheet=otSheet_();var failures=0;
    records.forEach(function(o){
      var t=o.task;if(!reminderEligible(t))return;
      var stage=otStage_(t.deadline,now,enabled);if(!stage)return;
      var state={};try{state=JSON.parse(o.raw[11]||'{}');}catch(ignore){}
      if(state.deadline!==t.deadline)state={deadline:t.deadline};
      if(state[stage]&&state[stage].sent)return;
      if(!state[stage]){state[stage]={key:Utilities.getUuid(),sent:false};sheet.getRange(o.row,12).setValue(JSON.stringify(state));SpreadsheetApp.flush();}
      // Preserve the same idempotency key on a retry after a network interruption.
      var fresh=sheet.getRange(o.row,1,1,17).getValues()[0];var current=otTask_(fresh);
      if(!reminderEligible(current)||current.deadline!==t.deadline||current.id!==t.id)return;
      var label=stage==='due'?'Đã đến hạn':stage==='1h'?'Còn tối đa 1 giờ':'Còn tối đa 1 ngày';
      var dueLabel=Utilities.formatDate(new Date(otDueMs_(t.deadline)),OT_TZ,'dd/MM/yyyy HH:mm');
      try{otSend_(devices,'OnTrack · '+label,t.name+' — Hạn: '+dueLabel,appUrl+'/?task='+encodeURIComponent(t.id),state[stage].key);state[stage].sent=true;state[stage].at=new Date().toISOString();sheet.getRange(o.row,12).setValue(JSON.stringify(state));}catch(err){failures++;}
    });
    if(failures)throw new Error('Có thông báo chưa gửi thành công.');
    p.deleteProperty('LAST_CHECK_ERROR');
  }catch(err){p.setProperty('LAST_CHECK_ERROR',new Date().toISOString());throw err;}
  finally{lock.releaseLock();}
}
function otSend_(devices,title,message,url,key){
  var p=PropertiesService.getScriptProperties();var appId=p.getProperty('ONESIGNAL_APP_ID');var apiKey=p.getProperty('ONESIGNAL_API_KEY');if(!appId||!apiKey)throw new Error('Chưa cấu hình OneSignal.');
  var response=UrlFetchApp.fetch('https://api.onesignal.com/notifications?c=push',{method:'post',contentType:'application/json',headers:{Authorization:'Key '+apiKey},payload:JSON.stringify({app_id:appId,include_subscription_ids:devices,headings:{en:title},contents:{en:message},url:url,ttl:1800,idempotency_key:key}),muteHttpExceptions:true});
  var result={};try{result=JSON.parse(response.getContentText());}catch(ignore){}
  if(response.getResponseCode()<200||response.getResponseCode()>=300||!result.id)throw new Error('OneSignal chưa chấp nhận thông báo. Kiểm tra API key và thiết bị đăng ký.');
  return result.id;
}

// BEGIN SHARED ONTRACK DOMAIN — generated from lib/task-core.mjs
function dueTimestamp(deadline) {
  if (!deadline) return Infinity;
  return Date.parse(deadline.length === 10 ? `${deadline}T23:59:00+07:00` : deadline);
}
function vnDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
function taskBucket(task, now = Date.now()) {
  if (task.done) return 'done';
  if (task.pending) return 'pending';
  if (!task.deadline) return 'undated';
  if (dueTimestamp(task.deadline) < now) return 'overdue';
  if (task.deadline.slice(0,10) === vnDay(new Date(now))) return 'today';
  return 'upcoming';
}
function validateTask(input) {
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

function validDeadline(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:00\+07:00)?$/.test(value))return false;
  const date=new Date(value.slice(0,10)+'T12:00:00Z');
  if(isNaN(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10))return false;
  return value.length===10 || (Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60);
}
function addDayKey(day,amount) {
  return new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
}
function weekBounds(now=Date.now(),offset=0) {
  const day=vnDay(new Date(now));
  const weekday=new Date(day+'T12:00:00Z').getUTCDay();
  const start=addDayKey(day,-((weekday+6)%7)+offset*7);
  return {start,end:addDayKey(start,6)};
}
function inDeadlineWeek(task,now=Date.now(),offset=0) {
  const {start,end}=weekBounds(now,offset);const key=(task.deadline||'').slice(0,10);
  return Boolean(key&&key>=start&&key<=end);
}
function weekSummary(tasks,now=Date.now(),offset=0) {
  const bounds=weekBounds(now,offset);const selected=tasks.filter(t=>inDeadlineWeek(t,now,offset));
  const completed=selected.filter(t=>t.done);
  const days=Array.from({length:7},(_,i)=>{const key=addDayKey(bounds.start,i);return {key,label:key.slice(8)+'/'+key.slice(5,7),weekday:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],count:selected.filter(t=>!t.done&&!t.pending&&t.deadline.slice(0,10)===key).length};});
  return {...bounds,tasks:selected,completed,days,percent:selected.length?Math.round(completed.length/selected.length*100):0};
}
function validateRecurrence(value) {
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
function vnTimestamp(ms) { return new Date(ms+7*3600000).toISOString().slice(0,19)+'+07:00'; }
function nextOccurrence(deadline,repeat) {
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
function recurrenceLabel(repeat) {
  const r=validateRecurrence(repeat);if(!r)return 'Không lặp';
  if(r.type==='interval')return 'Mỗi '+r.every+' '+(r.unit==='hours'?'giờ':'ngày');
  if(r.type==='weekly')return 'Hàng tuần · '+r.weekdays.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d-1]).join(', ');
  return 'Hàng tháng · ngày '+r.day;
}
function occurrenceId(key) {
  let a=2166136261,b=2246822507,c=3266489909,d=668265263;
  for(let i=0;i<key.length;i++){const n=key.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b^n,2246822519);c=Math.imul(c^n,3266489917);d=Math.imul(d^n,668265263);}
  return 'repeat-'+[a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
function expandRecurring(input,now=Date.now(),limit=100) {
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
function normalizeStoredTask(task) {
  return {...task,pending:Boolean(task.pending)&&!task.done,priority:task.priority||'normal',repeat:validateRecurrence(task.repeat)};
}
function reminderEligible(task) { return Boolean(!task.done&&!task.pending&&task.deadline); }
function applyTaskEdit(previous,input) {
  const next={...previous,...input};
  if(!next.repeat){next.recurrenceCursor=null;return next;}
  if(previous?.repeat&&previous.recurrenceCursor&&dueTimestamp(previous.deadline)===dueTimestamp(next.deadline)){
    next.recurrenceCursor={signature:JSON.stringify([next.deadline,validateRecurrence(next.repeat)]),lastDeadline:previous.recurrenceCursor.lastDeadline};
  }else next.recurrenceCursor=null;
  return next;
}

// END SHARED ONTRACK DOMAIN
