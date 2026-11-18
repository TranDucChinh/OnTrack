/** OnTrack — bound to the existing Google Sheet. Secrets belong in Script Properties. */
var OT_TZ = 'Asia/Ho_Chi_Minh';
var OT_SHEET_ID = 'YOUR_SPREADSHEET_ID';
var OT_TAB = 'Deadline';
var OT_EXTRA = ['task_id','created_at','completed_at','updated_at','priority','notes','deadline_has_time','reminder_state'];

function setupOnTrack() {
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var p=PropertiesService.getScriptProperties();
    if(!p.getProperty('ONTRACK_API_TOKEN'))p.setProperty('ONTRACK_API_TOKEN',Utilities.getUuid()+Utilities.getUuid());
    var sheet=otSheet_();
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
  otAppUrl_();otRows_();
  var found=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='checkDeadlines';});
  if(!found.length)ScriptApp.newTrigger('checkDeadlines').timeBased().everyMinutes(5).create();
  else found.slice(1).forEach(function(t){ScriptApp.deleteTrigger(t);});
  if(!p.getProperty('REMINDERS_ENABLED_AT'))p.setProperty('REMINDERS_ENABLED_AT',new Date().toISOString());
  p.setProperty('REMINDERS_ACTIVE','true');
  return 'Đã cài lịch kiểm tra 5 phút. Bật nhận thông báo trên từng thiết bị trong OnTrack.';
}

function doPost(e){
  var lock=LockService.getScriptLock();
  try{
    var b=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    var token=PropertiesService.getScriptProperties().getProperty('ONTRACK_API_TOKEN');
    if(!token||b.token!==token)return otJson_({ok:false,error:'Kết nối chưa được xác thực.'});
    lock.waitLock(20000);
    if(b.action==='list')return otJson_(otState_());
    if(b.action==='save'){otSave_(b);return otJson_(otState_());}
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
  if(rows[0].slice(4,12).join('|')!==OT_EXTRA.join('|'))throw new Error('Hãy chạy setupOnTrack trước.');
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
  var task={id:String(r[4]),name:String(r[1]),deadline:deadline,done:r[3]===true,createdAt:otIso_(r[5]),completedAt:otIso_(r[6]),updatedAt:otIso_(r[7]),priority:r[8]||'normal',notes:String(r[9]||'')};
  task.version=otHash_(JSON.stringify([task.name,task.deadline,task.done,task.priority,task.notes,task.completedAt]));
  return task;
}
function otHash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(function(n){return ('0'+((n+256)%256).toString(16)).slice(-2);}).join('');}
function otState_(){
  var p=PropertiesService.getScriptProperties();
  return {ok:true,tasks:otRows_().map(function(o){return o.task;}),pushReady:!!(p.getProperty('ONESIGNAL_APP_ID')&&p.getProperty('ONESIGNAL_API_KEY')),schedulerActive:ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='checkDeadlines';}),lastCheck:p.getProperty('LAST_CHECK'),lastCheckError:!!p.getProperty('LAST_CHECK_ERROR'),deviceCount:JSON.parse(p.getProperty('PUSH_DEVICES')||'[]').length};
}
function otParseDue_(value){
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:00\+07:00)?$/.test(value))throw new Error('Deadline không hợp lệ.');
  var date=new Date(value.length===10?value+'T00:00:00+07:00':value);
  if(isNaN(date)||Utilities.formatDate(date,OT_TZ,'yyyy-MM-dd')!==value.slice(0,10))throw new Error('Ngày không hợp lệ.');
  return date;
}
function otText_(value){return /^[=+@-]/.test(value)?"'"+value:value;}
function otSame_(a,b){return ['name','deadline','done','priority','notes'].every(function(k){return a[k]===b[k];});}
function otSave_(b){
  var t=b.task||{};if(!/^[a-zA-Z0-9-]{1,100}$/.test(t.id||''))throw new Error('Mã task không hợp lệ.');
  if(typeof t.name!=='string'||!t.name.trim()||t.name.length>500)throw new Error('Tên công việc không hợp lệ.');
  if(typeof t.done!=='boolean'||['normal','high','low'].indexOf(t.priority)<0)throw new Error('Trạng thái hoặc mức ưu tiên không hợp lệ.');
  if(typeof t.notes!=='string'||t.notes.length>4000)throw new Error('Ghi chú không hợp lệ.');
  t.name=t.name.trim();var date=otParseDue_(t.deadline);
  var records=otRows_();var existing=records.filter(function(o){return o.task.id===t.id;})[0];
  if(existing&&existing.task.version!==b.baseVersion){if(otSame_(existing.task,t))return;var err=new Error('Task đã thay đổi ở nơi khác. Đồng bộ lại rồi mở task để chỉnh sửa.');err.otCode='conflict';throw err;}
  if(!existing&&b.baseVersion){var gone=new Error('Task đã bị xóa khỏi Sheet. Đồng bộ lại trước khi lưu.');gone.otCode='conflict';throw gone;}
  var sheet=otSheet_();var row=existing?existing.row:sheet.getLastRow()+1;var now=new Date();
  // Existing ordinal formulas in column A are preserved. New rows get the same numbering rule.
  if(!existing)sheet.getRange(row,1).setFormula('=IF(B'+row+'="", "", SUBTOTAL(103, $B$2:B'+row+'))');
  var complete=t.done?(existing&&existing.task.done?existing.raw[6]:now):'';
  var reminders=existing&&existing.task.deadline===t.deadline&&existing.task.done===t.done?(existing.raw[11]||''):'';
  sheet.getRange(row,2,1,11).setValues([[otText_(t.name),date||'',t.done,t.id,existing?existing.raw[5]:now,complete,now,t.priority,otText_(t.notes),t.deadline.length>10,reminders]]);
  sheet.getRange(row,3).setNumberFormat(t.deadline.length>10?'dd/MM/yyyy HH:mm':'dd/MM/yyyy');
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
    var devices=JSON.parse(p.getProperty('PUSH_DEVICES')||'[]');
    if(!devices.length){p.deleteProperty('LAST_CHECK_ERROR');return;}
    var now=Date.now();var enabled=Date.parse(p.getProperty('REMINDERS_ENABLED_AT')||new Date(now).toISOString());
    var appUrl=otAppUrl_();var records=otRows_();var sheet=otSheet_();var failures=0;
    records.forEach(function(o){
      var t=o.task;if(t.done||!t.deadline)return;
      var stage=otStage_(t.deadline,now,enabled);if(!stage)return;
      var state={};try{state=JSON.parse(o.raw[11]||'{}');}catch(ignore){}
      if(state.deadline!==t.deadline)state={deadline:t.deadline};
      if(state[stage]&&state[stage].sent)return;
      if(!state[stage]){state[stage]={key:Utilities.getUuid(),sent:false};sheet.getRange(o.row,12).setValue(JSON.stringify(state));SpreadsheetApp.flush();}
      // Preserve the same idempotency key on a retry after a network interruption.
      var fresh=sheet.getRange(o.row,1,1,12).getValues()[0];var current=otTask_(fresh);
      if(current.done||current.deadline!==t.deadline||current.id!==t.id)return;
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
