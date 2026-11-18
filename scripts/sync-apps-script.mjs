import fs from 'node:fs';
const shared=fs.readFileSync(new URL('../lib/task-core.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const target=new URL('../setup/Code.gs',import.meta.url);
const current=fs.readFileSync(target,'utf8').split('// BEGIN SHARED ONTRACK DOMAIN')[0].trimEnd();
fs.writeFileSync(target,current+'\n\n// BEGIN SHARED ONTRACK DOMAIN — generated from lib/task-core.mjs\n'+shared+'\n// END SHARED ONTRACK DOMAIN\n');
console.log('Apps Script shared recurrence/calendar logic synchronized.');
