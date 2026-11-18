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
export async function showNotification({title,message,icon,onClick}){
 if(process.platform!=='win32'||!fs.existsSync(snoreToast))throw new Error('Thông báo Windows chưa sẵn sàng.');
 const pipe='\\\\.\\pipe\\ontrack-toast-'+randomUUID();
 const listener=net.createServer(socket=>{const chunks=[];socket.on('data',chunk=>chunks.push(chunk));socket.on('end',()=>{const action=Buffer.concat(chunks).toString('utf16le');if(/action=(?:contentsClicked|activated)/i.test(action)){try{onClick?.();}catch{}}listener.close();});});
 await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(pipe,resolve);});
 const timer=setTimeout(()=>listener.close(),60000);timer.unref();listener.unref();
 const args=['-appID',APP_ID,'-t',String(title).slice(0,200),'-m',String(message).slice(0,1000),'-p',icon,'-pipeName',pipe];
 return new Promise((resolve,reject)=>{
  execFile(snoreToast,args,{windowsHide:true,timeout:45000},(error,stdout)=>{
   if(error&&!(typeof error.code==='number'&&error.code>=0&&error.code<=5)){listener.close();return reject(new Error('Windows chưa chấp nhận thông báo. Kiểm tra quyền thông báo của OnTrack.'));}
   resolve({accepted:true});
  });
 });
}
