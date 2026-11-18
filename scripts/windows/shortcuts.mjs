import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export function launcherPaths(dataDirectory){return {launcher:path.join(dataDirectory,'Start-OnTrack.vbs'),shortcut:path.join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','OnTrack.lnk'),startup:path.join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','Startup','OnTrack Background.lnk')};}
export async function setStartup(enabled,dataDirectory,icon){
 const paths=launcherPaths(dataDirectory);
 if(!enabled){await fs.rm(paths.startup,{force:true});return;}
 await createShortcut(paths.startup,paths.launcher,'--background',icon);
}
export async function createShortcut(shortcut,launcher,args,icon){
 // Paths are passed through environment variables, never interpolated as PowerShell code.
 const command="$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:ONTRACK_LINK); $l.TargetPath=$env:ONTRACK_WSCRIPT; $l.Arguments='\"'+$env:ONTRACK_LAUNCHER+'\" '+$env:ONTRACK_ARGS; $l.WorkingDirectory=$env:ONTRACK_DIR; $l.IconLocation=$env:ONTRACK_ICON; $l.Description='OnTrack'; $l.WindowStyle=7; $l.Save()";
 await fs.mkdir(path.dirname(shortcut),{recursive:true});
 await exec('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',command],{windowsHide:true,timeout:15000,env:{...process.env,ONTRACK_LINK:shortcut,ONTRACK_WSCRIPT:path.join(process.env.SystemRoot,'System32','wscript.exe'),ONTRACK_LAUNCHER:launcher,ONTRACK_ARGS:args,ONTRACK_DIR:path.dirname(launcher),ONTRACK_ICON:icon}});
}
