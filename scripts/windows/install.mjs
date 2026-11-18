import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createStore} from './settings-store.mjs';
import {createShortcut,setStartup,launcherPaths} from './shortcuts.mjs';
import {installNotificationShortcut} from './notifications.mjs';
import {DESKTOP_ORIGIN} from './local-core.mjs';
const exec=promisify(execFile);
if(process.platform!=='win32')throw new Error('Trình cài này chỉ dành cho Windows.');
const root=fileURLToPath(new URL('../../',import.meta.url)),dataDirectory=path.join(process.env.LOCALAPPDATA,'OnTrack');
const desktop=(await exec('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"[Environment]::GetFolderPath('Desktop')"],{windowsHide:true})).stdout.trim();
const paths=launcherPaths(dataDirectory),desktopShortcut=path.join(desktop,'OnTrack.lnk'),icon=path.join(root,'public','icon.ico');
const wscript=path.join(process.env.SystemRoot,'System32','wscript.exe');
if(process.argv.includes('--uninstall')){
 try{await fetch(DESKTOP_ORIGIN+'/api/desktop/stop',{method:'POST',headers:{Origin:DESKTOP_ORIGIN}});}catch{}
 for(const shortcut of [desktopShortcut,paths.shortcut,paths.startup])await fs.rm(shortcut,{force:true});
 console.log('Đã gỡ shortcut và tự khởi động OnTrack. Cấu hình cá nhân vẫn giữ trong dữ liệu ứng dụng.');process.exit(0);
}
if(!existsSync(wscript))throw new Error('Máy này chưa có Windows Script Host để chạy launcher ẩn.');
if(!existsSync(path.join(root,'dist','server','wrangler.json')))throw new Error('Hãy chạy npm run build trước khi cài bản Windows.');
await fs.mkdir(dataDirectory,{recursive:true});
if(!existsSync(icon)){
 const png=await fs.readFile(path.join(root,'public','icon-192.png')),header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=192;header[7]=192;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);await fs.writeFile(icon,Buffer.concat([header,png]));
}
const quote=value=>value.replaceAll('"','""');
const executable=`"${process.execPath}" "${path.join(root,'scripts','windows','host.mjs')}"`;
const vbs=`Option Explicit\nDim shell, command\nSet shell = CreateObject("WScript.Shell")\ncommand = "${quote(executable)}"\nIf WScript.Arguments.Count > 0 Then\n  If WScript.Arguments(0) = "--background" Then\n    command = command & " --background"\n  Else\n    command = command & " --open"\n  End If\nElse\n  command = command & " --open"\nEnd If\nshell.Run command, 0, False\n`;
await fs.writeFile(paths.launcher,Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(vbs,'utf16le')]));
await installNotificationShortcut(wscript);
await createShortcut(paths.shortcut,paths.launcher,'--open',icon);
await createShortcut(desktopShortcut,paths.launcher,'--open',icon);
const store=createStore(dataDirectory);await store.init();await store.update({installedAt:new Date().toISOString()});
await setStartup(store.get().startWithWindows!==false,dataDirectory,icon);
spawn(wscript,[paths.launcher,'--open'],{detached:true,stdio:'ignore',windowsHide:true}).unref();
console.log(JSON.stringify({installed:true,desktopShortcut,startMenu:paths.shortcut,backgroundAtLogin:store.get().startWithWindows!==false,url:DESKTOP_ORIGIN}));
