import {SignJWT,jwtVerify,createRemoteJWKSet,base64url} from 'jose';
import {localAccessAllowed} from './local-access.mjs';

const GOOGLE_KEYS=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const AUTH_KEYS=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','ONTRACK_SESSION_SECRET','ONTRACK_GOOGLE_EMAIL','ONTRACK_ORIGIN'];
const SESSION_SECONDS=12*60*60;
const FLOW_SECONDS=10*60;
const string=value=>typeof value==='string'?value.trim():'';
const localHost=host=>['localhost','127.0.0.1','[::1]'].includes(host);
const randomToken=()=>base64url.encode(crypto.getRandomValues(new Uint8Array(32)));

/** @param {Record<string,any>} env */
export function readAuthConfig(env,dev=false){
 const clientId=string(env.GOOGLE_CLIENT_ID),clientSecret=string(env.GOOGLE_CLIENT_SECRET),secret=string(env.ONTRACK_SESSION_SECRET),email=string(env.ONTRACK_GOOGLE_EMAIL).toLowerCase();
 if(!clientId.endsWith('.apps.googleusercontent.com')||!clientSecret||!/^[a-f0-9]{64}$/.test(secret)||!/^\S+@\S+\.\S+$/.test(email)||email.includes(','))return null;
 try{
  const origin=new URL(string(env.ONTRACK_ORIGIN));
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return null;
  const secure=origin.protocol==='https:';
  if(!secure&&!(dev&&origin.protocol==='http:'&&localHost(origin.hostname)))return null;
  return {clientId,clientSecret,email,origin:origin.origin,secure,key:Uint8Array.from(secret.match(/.{2}/g),hex=>parseInt(hex,16))};
 }catch{return null;}
}

/** @param {Request} request @param {Record<string,any>} env */
export function demoAllowed(request,env,dev=false){
 const url=new URL(request.url);
 return dev&&localHost(url.hostname)&&['http:','https:'].includes(url.protocol)&&!string(env.ONTRACK_SCRIPT_URL)&&!string(env.ONTRACK_API_TOKEN)&&!AUTH_KEYS.some(key=>string(env[key]));
}

export function safeReturnTo(value,origin){
 if(typeof value!=='string'||value.length>1200||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/';
 try{const url=new URL(value,origin);if(url.origin!==origin||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/'))return '/';url.searchParams.delete('auth_error');return url.pathname+url.search+url.hash;}catch{return '/';}
}
const cookieName=(purpose,secure)=>(secure?'__Host-ontrack_':'ontrack_')+purpose+(secure?'':'_dev');
function cookieValue(request,name){
 const matches=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
 if(matches.length!==1)return '';
 const value=matches[0].slice(name.length+1);return value.length<=6000?value:'';
}
function cookie(purpose,value,config,maxAge){return `${cookieName(purpose,config.secure)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.secure?'; Secure':''}`;}
async function sign(payload,config,purpose,ttl){return new SignJWT(payload).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.origin).setAudience('ontrack-'+purpose).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+ttl).sign(config.key);}
async function verifyCookie(request,config,purpose){
 try{return (await jwtVerify(cookieValue(request,cookieName(purpose,config.secure)),config.key,{algorithms:['HS256'],issuer:config.origin,audience:'ontrack-'+purpose,requiredClaims:['iat','exp'],clockTolerance:5})).payload;}catch{return null;}
}

export async function verifyGoogleIdToken(token,config,nonce,keys=GOOGLE_KEYS){
 const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:config.clientId,requiredClaims:['exp','iat','sub','email','email_verified','nonce'],maxTokenAge:'2h',clockTolerance:30});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=='string'||payload.email.toLowerCase()!==config.email||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||(payload.azp&&payload.azp!==config.clientId))throw new Error('Google identity is not allowed.');
 return {sub:payload.sub,email:payload.email.toLowerCase(),name:typeof payload.name==='string'?payload.name.slice(0,160):payload.email};
}

/** @param {Request} request @param {Record<string,any>} env */
export async function getAuthState(request,env,dev=false){
 if(localAccessAllowed(request,env))return {mode:'local',configured:true,user:null};
 const config=readAuthConfig(env,dev);
 if(!config)return {mode:demoAllowed(request,env,dev)?'demo':'setup',configured:false,user:null};
 if(new URL(request.url).origin!==config.origin)return {mode:'google',configured:true,user:null};
 const payload=await verifyCookie(request,config,'session');
 const user=payload&&payload.clientId===config.clientId&&payload.email===config.email&&typeof payload.sub==='string'&&typeof payload.name==='string'?{sub:payload.sub,email:config.email,name:payload.name}:null;
 return {mode:'google',configured:true,user};
}

function response(body,status=200,extra={}){return Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...extra}});}
function redirect(location,cookies=[]){const headers=new Headers({'Location':location,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});for(const value of cookies)headers.append('Set-Cookie',value);return new Response(null,{status:303,headers});}

// Dependencies are injectable for protocol tests; request input never selects a verifier or endpoint.
export function createAuthHandler({fetchToken=fetch,verifyIdToken=verifyGoogleIdToken}={}){
 return async function authHandler(request,env,dev=false){
  const url=new URL(request.url);if(!['/api/auth/session','/api/auth/logout','/auth/google','/auth/google/callback'].includes(url.pathname))return null;
  if(url.pathname==='/api/auth/session'){
   if(request.method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
   return response(await getAuthState(request,env,dev));
  }
  const config=readAuthConfig(env,dev);
  if(url.pathname==='/api/auth/logout'){
   if(request.method!=='POST')return response({error:'Method not allowed.'},405,{Allow:'POST'});
   if(request.headers.get('Origin')!==url.origin||(config&&config.origin!==url.origin))return response({error:'Invalid origin.'},403);
   if(!config)return response({ok:true});
   const result=response({ok:true});result.headers.append('Set-Cookie',cookie('session','',config,0));result.headers.append('Set-Cookie',cookie('oauth','',config,0));return result;
  }
  if(!config)return response({error:'Đăng nhập Google chưa được cấu hình.'},503);
  if(url.origin!==config.origin)return response({error:'Invalid origin.'},403);
  if(request.method!=='GET')return response({error:'Method not allowed.'},405,{Allow:'GET'});
  if(url.pathname==='/auth/google'){
   if(request.headers.get('sec-fetch-site')==='cross-site')return response({error:'Invalid origin.'},403);
   const state=randomToken(),nonce=randomToken(),verifier=randomToken();
   const challenge=base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   const flow=await sign({state,nonce,verifier,returnTo:safeReturnTo(url.searchParams.get('return_to'),config.origin)},config,'oauth',FLOW_SECONDS);
   const authorization=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   authorization.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.origin+'/auth/google/callback',response_type:'code',scope:'openid email profile',access_type:'online',prompt:'select_account',state,nonce,code_challenge:challenge,code_challenge_method:'S256'}).toString();
   return redirect(authorization.href,[cookie('oauth',flow,config,FLOW_SECONDS)]);
  }
  const clearFlow=cookie('oauth','',config,0);
  try{
   const flow=await verifyCookie(request,config,'oauth');
   if(!flow||url.searchParams.getAll('state').length!==1||!url.searchParams.get('state')||flow.state!==url.searchParams.get('state')||typeof flow.nonce!=='string'||typeof flow.verifier!=='string')throw new Error('Invalid flow.');
   if(url.searchParams.has('error'))return redirect('/?auth_error=cancelled',[clearFlow]);
   if(url.searchParams.getAll('code').length!==1||!url.searchParams.get('code')||url.searchParams.get('code').length>4096)throw new Error('Invalid code.');
   const exchanged=await fetchToken('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code'),client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.origin+'/auth/google/callback',grant_type:'authorization_code',code_verifier:flow.verifier}),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!exchanged.ok)throw new Error('Token exchange failed.');
   const tokens=await exchanged.json();if(typeof tokens.id_token!=='string')throw new Error('Missing identity token.');
   const user=await verifyIdToken(tokens.id_token,config,flow.nonce);
   // Recheck owner restrictions even when protocol tests inject an ID-token verifier.
   if(user.email!==config.email||!user.sub)throw new Error('Account not allowed.');
   const session=await sign({...user,clientId:config.clientId},config,'session',SESSION_SECONDS);
   return redirect(safeReturnTo(flow.returnTo,config.origin),[clearFlow,cookie('session',session,config,SESSION_SECONDS)]);
  }catch{return redirect('/?auth_error=failed',[clearFlow]);}
 };
}
export const handleAuth=createAuthHandler();
