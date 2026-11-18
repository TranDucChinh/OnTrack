import http from 'node:http';
import fs from 'node:fs/promises';
import {existsSync,createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {Readable} from 'node:stream';
import {ontrackApi} from '../../lib/ontrack-api.mjs';
import {createStore} from './settings-store.mjs';
import {DESKTOP_PORT,DESKTOP_ORIGIN,allowLocalRequest,validateConnection,publicSettings,reminderCandidates} from './local-core.mjs';
import {showNotification,getNotificationStatus} from './notifications.mjs';
import {setStartup} from './shortcuts.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dataDirectory=process.env.ONTRACK_DATA_DIR||path.join(process.env.LOCALAPPDATA||root,'OnTrack');
const icon=path.join(root,'public','icon-192.png'),ico=path.join(root,'public','icon.ico');
const uiOrigin='http://127.0.0.1:43128';
const store=createStore(dataDirectory);await store.init();
const status={lastCheck:null,lastCheckError:false};let checking=false,closing=false,uiChild,uiReady=false;
const localEnv=settings=>({ONTRACK_AUTH_MODE:'windows-local',ONTRACK_LOCAL_ORIGIN:DESKTOP_ORIGIN,ONTRACK_SCRIPT_URL:settings.scriptUrl||'',ONTRACK_API_TOKEN:settings.apiToken||''});
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function browser(){
 const candidates=[path.join(process.env['ProgramFiles(x86)']||'','Microsoft','Edge','Application','msedge.exe'),path.join(process.env.ProgramFiles||'','Microsoft','Edge','Application','msedge.exe'),path.join(process.env.ProgramFiles||'','Google','Chrome','Application','chrome.exe')];
 return candidates.find(existsSync);
}
function openApp(taskId=''){
 const executable=browser();if(!executable)throw new Error('Cần Microsoft Edge hoặc Google Chrome để mở OnTrack.');
 const url=DESKTOP_ORIGIN+(taskId?'/?task='+encodeURIComponent(taskId):'/');
 const child=spawn(executable,['--app='+url,'--user-data-dir='+path.join(dataDirectory,'BrowserProfile'),'--no-first-run','--no-default-browser-check'],{detached:true,stdio:'ignore',windowsHide:false});child.unref();
}
async function readBody(request,limit=25000){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw new Error('Dữ liệu quá lớn.');chunks.push(chunk);}return Buffer.concat(chunks);}
async function webRequest(request){const body=['GET','HEAD'].includes(request.method)?undefined:await readBody(request);return new Request(DESKTOP_ORIGIN+request.url,{method:request.method,headers:request.headers,body});}
async function listState(settings=store.get()){
 const response=await ontrackApi(new Request(DESKTOP_ORIGIN+'/api/ontrack'),localEnv(settings));const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Không kết nối được Sheet.');return data;
}
async function checkDeadlines(){
 if(checking||closing||!store.get().apiToken)return;checking=true;
 try{
  const data=await listState();status.lastCheck=new Date().toISOString();status.lastCheckError=false;
  if(!store.get().notificationsEnabled)return;
  const candidates=reminderCandidates(data.tasks,store.get().reminders||{},store.get().remindersEnabledAt).slice(0,10);
  for(const {key,stage,task} of candidates){
   if(closing||!store.get().notificationsEnabled)break;
   const stageLabel=stage==='due'?'Đã đến hạn':stage==='1h'?'Còn tối đa 1 giờ':'Còn tối đa 1 ngày';
   const deadline=(task.deadline.slice(8,10)+'/'+task.deadline.slice(5,7)+'/'+task.deadline.slice(0,4))+' '+(task.deadline.length>10?task.deadline.slice(11,16):'23:59');
   await showNotification({title:'OnTrack · '+stageLabel,message:task.name+' — Hạn: '+deadline,icon,onClick:()=>openApp(task.id)});
   const history={...(store.get().reminders||{}),[key]:Date.now()};const cutoff=Date.now()-14*86400000;
   await store.update({reminders:Object.fromEntries(Object.entries(history).filter(([,stamp])=>stamp>=cutoff).slice(-2000))});
  }
 }catch{status.lastCheckError=true;}finally{checking=false;}
}
async function desktopRoute(request,url){
 const settings=store.get();
 if(url.pathname==='/api/desktop/health')return json({app:'OnTrack',desktop:true,ready:uiReady,connected:Boolean(settings.apiToken)});
 if(url.pathname==='/api/auth/session')return json({mode:'local',configured:true,user:null,desktop:{connected:Boolean(settings.scriptUrl&&settings.apiToken)}});
 if(url.pathname.startsWith('/auth/')||url.pathname==='/api/auth/logout')return json({error:'Bản Windows không cần đăng nhập.'},400);
 if(url.pathname==='/api/desktop/settings'){
  if(request.method==='GET')return json({...publicSettings(settings,status),notificationStatus:await getNotificationStatus()});
  if(request.method!=='POST')return json({error:'Phương thức không được hỗ trợ.'},405);
  const input=await request.json();const connection=validateConnection(input,settings);
  const candidate={...settings,...connection};await listState(candidate);
  await store.update({...connection,reminders:connection.scriptUrl===settings.scriptUrl?settings.reminders:{},remindersEnabledAt:connection.scriptUrl===settings.scriptUrl?settings.remindersEnabledAt:Date.now()});
  void checkDeadlines();return json({ok:true,...publicSettings(store.get(),status)});
 }
 if(url.pathname==='/api/desktop/preferences'&&request.method==='POST'){
  const input=await request.json(),patch={};
  if(typeof input.notificationsEnabled==='boolean'){patch.notificationsEnabled=input.notificationsEnabled;if(input.notificationsEnabled&&!settings.notificationsEnabled)patch.remindersEnabledAt=Date.now();}
  if(typeof input.startWithWindows==='boolean'){await setStartup(input.startWithWindows,dataDirectory,ico);patch.startWithWindows=input.startWithWindows;}
  await store.update(patch);return json({ok:true,...publicSettings(store.get(),status)});
 }
 if(url.pathname==='/api/desktop/test-notification'&&request.method==='POST'){
  await showNotification({title:'OnTrack · Đã sẵn sàng',message:'Thông báo Windows đã sẵn sàng. OnTrack kiểm tra deadline mỗi 5 phút khi máy đang chạy.',icon,duration:'long',onClick:()=>openApp()});return json({ok:true});
 }
 if(url.pathname==='/api/desktop/open'&&request.method==='POST'){openApp();return json({ok:true});}
 if(url.pathname==='/api/desktop/check-now'&&request.method==='POST'){await checkDeadlines();return json({ok:!status.lastCheckError,...publicSettings(store.get(),status)});}
 if(url.pathname==='/api/desktop/stop'&&request.method==='POST'){setTimeout(()=>void shutdown(),300);return json({ok:true});}
 if(url.pathname==='/api/ontrack'){
  const response=await ontrackApi(request,localEnv(settings));
  return response;
 }
 if(url.pathname.startsWith('/api/desktop/'))return json({error:'Không tìm thấy thao tác.'},404);
 return null;
}
const server=http.createServer(async(incoming,outgoing)=>{
 try{
  if(!allowLocalRequest({host:incoming.headers.host,origin:incoming.headers.origin,site:incoming.headers['sec-fetch-site'],method:incoming.method})){outgoing.writeHead(403,{'Content-Type':'text/plain','Cache-Control':'no-store'});outgoing.end('OnTrack is available on this computer only.');return;}
  const request=await webRequest(incoming),url=new URL(request.url);let response=await desktopRoute(request,url);
  if(!response){
   const headers=new Headers(request.headers);for(const name of ['host','connection','content-length','accept-encoding'])headers.delete(name);
   response=await fetch(uiOrigin+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),redirect:'manual'});
  }
  const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
  const location=headers.get('location');if(location?.startsWith(uiOrigin))headers.set('location',DESKTOP_ORIGIN+location.slice(uiOrigin.length));
  outgoing.writeHead(response.status,Object.fromEntries(headers));if(!response.body||incoming.method==='HEAD')outgoing.end();else Readable.fromWeb(response.body).pipe(outgoing);
 }catch(error){if(!outgoing.headersSent){outgoing.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'});outgoing.end(JSON.stringify({error:error.message||'Thao tác chưa hoàn tất.'}));}else outgoing.end();}
});
async function shutdown(){
 if(closing)return;closing=true;server.close();
 if(uiChild?.pid)await new Promise(resolve=>execFile('taskkill.exe',['/PID',String(uiChild.pid),'/T','/F'],{windowsHide:true},()=>resolve()));
 await fs.rm(path.join(dataDirectory,'host.pid'),{force:true});process.exit(0);
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void shutdown());
let existing=false;try{const health=await fetch(DESKTOP_ORIGIN+'/api/desktop/health',{signal:AbortSignal.timeout(1000)});existing=(await health.json()).app==='OnTrack';}catch{}
if(existing){if(process.argv.includes('--open'))openApp();process.exit(0);}
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(DESKTOP_PORT,'127.0.0.1',resolve);});
if(!existsSync(path.join(root,'dist','server','wrangler.json')))throw new Error('Cần build OnTrack trước khi chạy bản Windows.');
const log=createWriteStream(path.join(dataDirectory,'runtime.log'),{flags:'a'});
uiChild=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'scripts','sites-env.mjs')).href,path.join(root,'node_modules','wrangler','bin','wrangler.js'),'dev','--config',path.join(root,'dist','server','wrangler.json'),'--local','--persist-to',path.join(dataDirectory,'worker-state'),'--ip','127.0.0.1','--port','43128','--inspector-port','0'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
uiChild.stdout.pipe(log);uiChild.stderr.pipe(log);
let ready=false;for(let attempt=0;attempt<90;attempt++){try{const response=await fetch(uiOrigin,{signal:AbortSignal.timeout(1500)});if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
if(!ready)throw new Error('Không khởi động được giao diện OnTrack. Xem runtime.log trong dữ liệu ứng dụng.');
uiReady=true;
await fs.writeFile(path.join(dataDirectory,'host.pid'),String(process.pid));
console.log('OnTrack Windows ready at '+DESKTOP_ORIGIN);
if(process.argv.includes('--open'))openApp();
void checkDeadlines();setInterval(()=>void checkDeadlines(),300000);
