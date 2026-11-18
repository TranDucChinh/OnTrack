import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {localAccessAllowed} from '../lib/local-access.mjs';
import {ontrackApi} from '../lib/ontrack-api.mjs';
import {allowLocalRequest,validateConnection,publicSettings,reminderCandidates,DESKTOP_ORIGIN} from '../scripts/windows/local-core.mjs';
import {createStore} from '../scripts/windows/settings-store.mjs';
const localEnv={ONTRACK_AUTH_MODE:'windows-local',ONTRACK_LOCAL_ORIGIN:DESKTOP_ORIGIN};
const scriptUrl='https://script.google.com/macros/s/TEST_ONLY_DEPLOYMENT/exec';
const token='test-only-connection-token-12345';

test('Windows access is restricted to its exact loopback origin and never trusts LAN hosts or cross-site requests',()=>{
 assert.equal(localAccessAllowed(new Request(DESKTOP_ORIGIN+'/api/ontrack'),localEnv),true);
 for(const url of ['https://public.example.test/api/ontrack','http://192.168.1.10:43127/api/ontrack','http://127.0.0.1:8080/api/ontrack'])assert.equal(localAccessAllowed(new Request(url),localEnv),false);
 assert.equal(localAccessAllowed(new Request(DESKTOP_ORIGIN,{headers:{'sec-fetch-site':'cross-site'}}),localEnv),false);
 assert.equal(allowLocalRequest({host:'127.0.0.1:43127',method:'GET'}),true);
 assert.equal(allowLocalRequest({host:'evil.example:43127',method:'GET'}),false);
 assert.equal(allowLocalRequest({host:'127.0.0.1:43127',method:'POST',origin:'https://evil.example'}),false);
 assert.equal(allowLocalRequest({host:'127.0.0.1:43127',method:'POST',origin:DESKTOP_ORIGIN}),true);
});
test('Connection setup accepts only an Apps Script deployment and never reuses a token for a different deployment',()=>{
 assert.deepEqual(validateConnection({scriptUrl,token}),{scriptUrl,apiToken:token});
 assert.deepEqual(validateConnection({scriptUrl,keepToken:true},{scriptUrl,apiToken:token}),{scriptUrl,apiToken:token});
 assert.throws(()=>validateConnection({scriptUrl:scriptUrl.replace('TEST_ONLY','OTHER'),keepToken:true},{scriptUrl,apiToken:token}));
 assert.throws(()=>validateConnection({scriptUrl:'https://evil.example/exec',token}));
 assert.throws(()=>validateConnection({scriptUrl,token:'short'}));
 assert.equal(JSON.stringify(publicSettings({scriptUrl,apiToken:token})).includes(token),false);
});
test('The native API can read/write a private Sheet locally without Google sign-in, but remote callers cannot bypass auth',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({ok:true,schemaVersion:2,tasks:[],activity:[]});});
 const env={...localEnv,ONTRACK_SCRIPT_URL:scriptUrl,ONTRACK_API_TOKEN:token};
 const read=await ontrackApi(new Request(DESKTOP_ORIGIN+'/api/ontrack'),env);assert.equal(read.status,200);assert.equal((await read.json()).mode,'live');
 const task={id:'test-id',name:'Native task',deadline:'2026-11-20',done:false,priority:'normal',notes:''};
 const save=await ontrackApi(new Request(DESKTOP_ORIGIN+'/api/ontrack',{method:'POST',headers:{Origin:DESKTOP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({action:'save',task})}),env);assert.equal(save.status,200);assert.equal(calls[1].action,'save');assert.equal(calls[1].token,token);
 const denied=await ontrackApi(new Request('https://public.example.test/api/ontrack',{headers:{'oai-authenticated-user-id':'forged'}}),env);assert.equal(denied.status,503);assert.equal(calls.length,2);
 const csrf=await ontrackApi(new Request(DESKTOP_ORIGIN+'/api/ontrack',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env);assert.equal(csrf.status,403);assert.equal(calls.length,2);
});
test('Reminder scan skips completed, pending and old imports, uses the latest threshold, and deduplicates persisted notices',()=>{
 const now=Date.parse('2026-11-18T10:00:00+07:00'),enabledAt=now-60000;
 const task={id:'1',name:'Test',done:false,pending:false,deadline:'2026-11-18T10:30:00+07:00'};
 const initial=reminderCandidates([task],{},enabledAt,now);assert.equal(initial[0].stage,'1h');
 assert.equal(reminderCandidates([task],{[initial[0].key]:now},enabledAt,now).length,0);
 assert.equal(reminderCandidates([{...task,done:true},{...task,pending:true},{...task,deadline:'2026-11-17'}],{},enabledAt,now).length,0);
 assert.equal(reminderCandidates([{...task,deadline:'2026-11-19'}],{},enabledAt,now).length,0);
 const due={...task,deadline:'2026-11-18T10:00:00+07:00'};assert.equal(reminderCandidates([due],{},enabledAt,now)[0].stage,'due');
});
test('Settings writes preserve secrets outside client responses and serialize concurrent updates without losing changes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ontrack-settings-test-'));const store=createStore(directory);await store.init();
 try{await Promise.all([store.update({scriptUrl,apiToken:token}),store.update({notificationsEnabled:false})]);const again=createStore(directory);await again.init();assert.equal(again.get().apiToken,token);assert.equal(again.get().notificationsEnabled,false);assert.equal(JSON.stringify(publicSettings(again.get())).includes(token),false);}finally{await fs.rm(path.join(directory,'settings.json'),{force:true});await fs.rm(path.join(directory,'settings.json.tmp'),{force:true});await fs.rmdir(directory);}
});
