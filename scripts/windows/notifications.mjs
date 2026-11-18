import path from 'node:path';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {APP_ID} from './local-core.mjs';
const require=createRequire(import.meta.url);
export const snoreToast=path.join(path.dirname(require.resolve('node-notifier/package.json')),'vendor','snoreToast',process.arch==='x64'?'snoretoast-x64.exe':'snoretoast-x86.exe');
const exec=promisify(execFile);
export async function installNotificationShortcut(target){await exec(snoreToast,['-install','OnTrack.lnk',target,APP_ID],{windowsHide:true,timeout:15000});}
export function notificationBlockMessage(state){
 return {
  DisabledForUser:'Windows đang tắt thông báo. Bật Settings → System → Notifications → Notifications rồi thử lại.',
  DisabledForApplication:'Windows đang tắt thông báo của OnTrack. Bật OnTrack trong Settings → System → Notifications.',
  DisabledByGroupPolicy:'Thông báo bị chặn bởi chính sách Windows. Liên hệ người quản lý máy.',
  DisabledByManifest:'Windows chưa nhận diện được OnTrack để gửi thông báo. Chạy lại trình cài OnTrack.',
  Unknown:'Chưa kiểm tra được quyền thông báo Windows. Hãy thử lại.'
 }[state]||'';
}
export async function getNotificationStatus(){
 const result=state=>({state,message:notificationBlockMessage(state)});
 if(process.platform!=='win32')return result('Unknown');
 // Windows PowerShell 5 exposes WinRT. Read settings only; never change the user's preferences.
 const command="$ErrorActionPreference='Stop'; $globalToast=Get-ItemPropertyValue -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' -Name ToastEnabled -ErrorAction SilentlyContinue; if($globalToast -eq 0){'DisabledForUser'; exit}; [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null; [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:ONTRACK_APP_ID).Setting.ToString()";
 try{
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',command],{windowsHide:true,timeout:10000,env:{...process.env,ONTRACK_APP_ID:APP_ID}});
  const value=stdout.trim();return result(['Enabled','DisabledForUser','DisabledForApplication','DisabledByGroupPolicy','DisabledByManifest'].includes(value)?value:'Unknown');
 }catch{return result('Unknown');}
}
export function checkNotificationResult(error){
 if(error?.code===1)throw new Error('Windows đã ẩn thông báo. Kiểm tra Do not disturb và Show notification banners của OnTrack.');
 if(error&&!(typeof error.code==='number'&&[0,2,3,4,5].includes(error.code)))throw new Error('Windows chưa chấp nhận thông báo. Kiểm tra quyền thông báo của OnTrack.');
 return {accepted:true};
}
export async function showNotification({title,message,icon,onClick,duration='short'}){
 if(process.platform!=='win32'||!fs.existsSync(snoreToast))throw new Error('Thông báo Windows chưa sẵn sàng.');
 const status=await getNotificationStatus();const blocked=notificationBlockMessage(status.state);if(blocked)throw new Error(blocked);
 const pipe='\\\\.\\pipe\\ontrack-toast-'+randomUUID();
 const listener=net.createServer(socket=>{const chunks=[];socket.on('data',chunk=>chunks.push(chunk));socket.on('end',()=>{const action=Buffer.concat(chunks).toString('utf16le');if(/action=(?:contentsClicked|activated)/i.test(action)){try{onClick?.();}catch{}}listener.close();});});
 await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(pipe,resolve);});
 const timer=setTimeout(()=>listener.close(),60000);timer.unref();listener.unref();
 const args=['-appID',APP_ID,'-t',String(title).slice(0,200),'-m',String(message).slice(0,1000),'-p',icon,'-d',duration==='long'?'long':'short','-pipeName',pipe];
 return new Promise((resolve,reject)=>{
  execFile(snoreToast,args,{windowsHide:true,timeout:45000},(error,stdout)=>{
   clearTimeout(timer);listener.close();
   try{resolve(checkNotificationResult(error));}catch(failure){reject(failure);}
  });
 });
}
