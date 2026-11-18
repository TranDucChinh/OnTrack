import fs from 'node:fs/promises';
import path from 'node:path';
export function createStore(directory){
 const file=path.join(directory,'settings.json');
 let settings={notificationsEnabled:true,startWithWindows:true,remindersEnabledAt:Date.now(),reminders:{}};
 let queue=Promise.resolve();
 return {
  async init(){await fs.mkdir(directory,{recursive:true});try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('Invalid settings');settings={...settings,...saved};}catch(error){if(error.code!=='ENOENT')throw new Error('Không đọc được cấu hình OnTrack. Dữ liệu cũ vẫn được giữ nguyên.');}return settings;},
  get(){return settings;},
  async update(patch){const write=queue.then(async()=>{const next={...settings,...patch};await fs.writeFile(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});await fs.rename(file+'.tmp',file);settings=next;return settings;});queue=write.catch(()=>{});return write;}
 };
}
