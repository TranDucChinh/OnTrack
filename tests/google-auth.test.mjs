import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT,generateKeyPair,createLocalJWKSet,exportJWK,decodeJwt,base64url} from 'jose';
import {readAuthConfig,demoAllowed,safeReturnTo,verifyGoogleIdToken,getAuthState,createAuthHandler} from '../lib/google-auth.mjs';
const env={GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-client-secret',ONTRACK_SESSION_SECRET:'a'.repeat(64),ONTRACK_GOOGLE_EMAIL:'owner@example.test',ONTRACK_ORIGIN:'https://ontrack.example.test'};
const config=readAuthConfig(env),origin=env.ONTRACK_ORIGIN;
const request=(path,options={})=>new Request(origin+path,options);
const cookiePair=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]);
async function begin(handler){const response=await handler(request('/auth/google?return_to=%2F%3Ftask%3Dtask-1'),env);return {response,location:new URL(response.headers.get('location')),cookie:cookiePair(response)[0]};}

test('Google configuration fails closed; development bypass only permits an unconfigured loopback demo',async()=>{
 assert.equal(readAuthConfig({...env,ONTRACK_SESSION_SECRET:'short'}),null);
 assert.equal(readAuthConfig({...env,ONTRACK_ORIGIN:'http://public.example.test'},true),null);
 assert.equal(readAuthConfig({...env,ONTRACK_ORIGIN:origin+'/path'}),null);
 assert.equal(readAuthConfig({...env,ONTRACK_GOOGLE_EMAIL:'one@example.test,two@example.test'}),null);
 assert.ok(readAuthConfig({...env,ONTRACK_ORIGIN:'http://127.0.0.1:5173'},true));
 const local=new Request('http://127.0.0.1:5173/api/ontrack');
 assert.equal(demoAllowed(local,{},true),true);
 assert.equal(demoAllowed(local,{ONTRACK_SCRIPT_URL:'configured'},true),false);
 assert.equal(demoAllowed(local,{GOOGLE_CLIENT_ID:env.GOOGLE_CLIENT_ID},true),false);
 assert.equal(demoAllowed(new Request('https://example.test/api/ontrack'),{},true),false);
 assert.equal(demoAllowed(local,{},false),false);
 assert.equal((await getAuthState(request('/api/ontrack',{headers:{'oai-authenticated-user-id':'spoofed'}}),env)).user,null);
 assert.equal((await getAuthState(local,{ONTRACK_API_TOKEN:'real-sheet-config'},true)).mode,'setup');
});

test('Login redirect binds a short-lived HttpOnly flow to state, nonce, PKCE and a safe return path',async()=>{
 const handler=createAuthHandler();const {response,location,cookie}=await begin(handler);
 assert.equal(response.status,303);assert.equal(location.origin,'https://accounts.google.com');
 assert.equal(location.searchParams.get('scope'),'openid email profile');
 assert.equal(location.searchParams.get('redirect_uri'),origin+'/auth/google/callback');
 assert.equal(location.searchParams.get('code_challenge_method'),'S256');
 const flow=decodeJwt(cookie.slice(cookie.indexOf('=')+1));
 assert.equal(location.searchParams.get('state'),flow.state);assert.equal(location.searchParams.get('nonce'),flow.nonce);
 const challenge=base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(flow.verifier))));
 assert.equal(location.searchParams.get('code_challenge'),challenge);assert.equal(flow.returnTo,'/?task=task-1');
 const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/__Host-ontrack_oauth=/);assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);assert.match(setCookie,/Secure/);assert.match(setCookie,/Max-Age=600/);
 assert.equal(location.href.includes(env.GOOGLE_CLIENT_SECRET),false);
 for(const unsafe of ['https://evil.example/','//evil.example/','/\\evil.example/','/auth/google','/api/auth/session'])assert.equal(safeReturnTo(unsafe,origin),'/');
});

test('Callback rejects missing, forged, duplicate and cross-browser state before exchanging any code',async()=>{
 let calls=0;const handler=createAuthHandler({fetchToken:async()=>{calls++;throw new Error('Unexpected network call');}});
 const {location,cookie}=await begin(handler);const state=location.searchParams.get('state');
 for(const [query,cookies] of [['code=x&state='+state,''],['code=x&state=wrong',cookie],['code=x&state='+state+'&state='+state,cookie],['code=x&state='+state,cookie+'; '+cookie]]){
  const result=await handler(request('/auth/google/callback?'+query,{headers:{cookie:cookies}}),env);
  assert.equal(result.headers.get('location'),'/?auth_error=failed');assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
 }
 assert.equal(calls,0);
});

test('Google ID token validation checks signature, issuer, audience, nonce, expiry and the sole approved email',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test-key';const keys=createLocalJWKSet({keys:[jwk]});
 const claims={email:env.ONTRACK_GOOGLE_EMAIL,email_verified:true,nonce:'nonce-1',name:'Test Owner'};
 async function token(overrides={},options={}){return new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('google-subject-1').setIssuer(options.issuer||'https://accounts.google.com').setAudience(options.audience||env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime(options.exp||'5m').sign(privateKey);}
 const good=await token();assert.equal((await verifyGoogleIdToken(good,config,'nonce-1',keys)).sub,'google-subject-1');
 for(const bad of [await token({email:'other@example.test'}),await token({email_verified:false}),await token({nonce:'another-nonce'}),await token({azp:'other-client'}),await token({}, {issuer:'https://evil.example'}),await token({}, {audience:'other-client'}),await token({}, {exp:Math.floor(Date.now()/1000)-100})])await assert.rejects(()=>verifyGoogleIdToken(bad,config,'nonce-1',keys));
 const parts=good.split('.');parts[1]=base64url.encode(JSON.stringify({...decodeJwt(good),email:'other@example.test'}));await assert.rejects(()=>verifyGoogleIdToken(parts.join('.'),config,'nonce-1',keys));
});

test('Successful callback issues an owner-only session; allowlist or secret changes revoke access',async()=>{
 let exchangeBody;const handler=createAuthHandler({fetchToken:async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');exchangeBody=options.body;return Response.json({id_token:'verified-in-test',access_token:'must-not-be-stored'});},verifyIdToken:async()=>({sub:'owner-google-id',email:env.ONTRACK_GOOGLE_EMAIL,name:'Test Owner'})});
 const {location,cookie}=await begin(handler);const state=location.searchParams.get('state');
 const callback=await handler(request('/auth/google/callback?state='+state+'&code=one-time-code',{headers:{cookie}}),env);
 assert.equal(callback.headers.get('location'),'/?task=task-1');assert.equal(exchangeBody.get('grant_type'),'authorization_code');assert.ok(exchangeBody.get('code_verifier'));
 const sessionCookie=cookiePair(callback).find(value=>value.startsWith('__Host-ontrack_session='));assert.ok(sessionCookie);
 assert.equal(sessionCookie.includes('must-not-be-stored'),false);
 const authenticated=request('/api/ontrack',{headers:{cookie:sessionCookie}});
 assert.equal((await getAuthState(authenticated,env)).user.email,env.ONTRACK_GOOGLE_EMAIL);
 assert.equal((await getAuthState(authenticated,{...env,ONTRACK_GOOGLE_EMAIL:'other@example.test'})).user,null);
 assert.equal((await getAuthState(authenticated,{...env,ONTRACK_SESSION_SECRET:'b'.repeat(64)})).user,null);
 assert.equal((await getAuthState(new Request('https://other.example.test/api/ontrack',{headers:{cookie:sessionCookie}}),env)).user,null);
});

test('Disallowed identity and failed exchange never issue a session, and logout requires a same-origin POST',async()=>{
 const denied=createAuthHandler({fetchToken:async()=>Response.json({id_token:'not-an-owner-token'}),verifyIdToken:async()=>({sub:'another-user',email:'other@example.test',name:'Other'})});
 const {location,cookie}=await begin(denied);const callback=await denied(request('/auth/google/callback?state='+location.searchParams.get('state')+'&code=x',{headers:{cookie}}),env);
 assert.equal(callback.headers.get('location'),'/?auth_error=failed');assert.equal(cookiePair(callback).some(c=>c.startsWith('__Host-ontrack_session=')),false);
 const handler=createAuthHandler();assert.equal((await handler(request('/api/auth/logout'),env)).status,405);
 assert.equal((await handler(request('/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 const logout=await handler(request('/api/auth/logout',{method:'POST',headers:{Origin:origin}}),env);assert.equal(logout.status,200);assert.equal(logout.headers.getSetCookie().length,2);assert.ok(logout.headers.getSetCookie().every(value=>value.includes('Max-Age=0')));
});

test('Expired or forged session cookies and exchanged-token errors cannot authenticate',async()=>{
 const old=await new SignJWT({sub:'owner-google-id',email:env.ONTRACK_GOOGLE_EMAIL,name:'Test Owner',clientId:env.GOOGLE_CLIENT_ID}).setProtectedHeader({alg:'HS256'}).setIssuer(origin).setAudience('ontrack-session').setIssuedAt(Math.floor(Date.now()/1000)-100).setExpirationTime(Math.floor(Date.now()/1000)-30).sign(config.key);
 assert.equal((await getAuthState(request('/api/ontrack',{headers:{cookie:'__Host-ontrack_session='+old}}),env)).user,null);
 assert.equal((await getAuthState(request('/api/ontrack',{headers:{cookie:'__Host-ontrack_session=forged'}}),env)).user,null);
 const handler=createAuthHandler({fetchToken:async()=>Response.json({error:'invalid_grant'},{status:400})});const {location,cookie}=await begin(handler);
 const failed=await handler(request('/auth/google/callback?state='+location.searchParams.get('state')+'&code=expired-code',{headers:{cookie}}),env);
 assert.equal(failed.headers.get('location'),'/?auth_error=failed');assert.equal(cookiePair(failed).some(c=>c.startsWith('__Host-ontrack_session=')),false);
});
