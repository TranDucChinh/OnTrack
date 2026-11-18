import {dueTimestamp,reminderEligible} from '../../lib/task-core.mjs';
export const DESKTOP_PORT=43127;
export const DESKTOP_ORIGIN='http://127.0.0.1:'+DESKTOP_PORT;
export const APP_ID='OnTrack.Desktop';
export function allowLocalRequest({host,origin,site,method},port=DESKTOP_PORT){
 if(host!==`127.0.0.1:${port}`||site==='cross-site')return false;
 return ['GET','HEAD'].includes(method)||origin===`http://127.0.0.1:${port}`;
}
export function validateConnection(input,previous={}){
 const scriptUrl=typeof input.scriptUrl==='string'?input.scriptUrl.trim():'';
 const token=typeof input.token==='string'?input.token.trim():'';
 const apiToken=token||(input.keepToken&&scriptUrl===previous.scriptUrl?previous.apiToken:'');
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(scriptUrl))throw new Error('Hãy nhập đúng URL Apps Script kết thúc bằng /exec.');
 if(typeof apiToken!=='string'||apiToken.length<20||apiToken.length>500||/[\r\n]/.test(apiToken))throw new Error('Mã kết nối chưa hợp lệ. Hãy sao chép lại ONTRACK_API_TOKEN.');
 return {scriptUrl,apiToken};
}
export function publicSettings(settings,status={}){return {connected:Boolean(settings.scriptUrl&&settings.apiToken),scriptUrl:settings.scriptUrl||'',hasToken:Boolean(settings.apiToken),notificationsEnabled:settings.notificationsEnabled!==false,startWithWindows:settings.startWithWindows!==false,lastCheck:status.lastCheck||null,lastCheckError:status.lastCheckError||false,pollMinutes:5};}
export function reminderCandidates(tasks,records,enabledAt,now=Date.now()){
 return tasks.flatMap(task=>{
  if(!reminderEligible(task))return [];
  const due=dueTimestamp(task.deadline);if(!Number.isFinite(due)||due<enabledAt)return [];
  const remaining=due-now;const stage=remaining<=0?(now-due<=86400000?'due':null):remaining<=3600000?'1h':remaining<=86400000?'24h':null;
  if(!stage)return [];const key=JSON.stringify([task.id,task.deadline,stage]);if(records[key])return [];
  return [{key,stage,task}];
 });
}
