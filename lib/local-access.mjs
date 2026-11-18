export function localAccessAllowed(request,env){
 if(env.ONTRACK_AUTH_MODE!=='windows-local'||typeof env.ONTRACK_LOCAL_ORIGIN!=='string')return false;
 try{const url=new URL(request.url),expected=new URL(env.ONTRACK_LOCAL_ORIGIN);return expected.protocol==='http:'&&expected.hostname==='127.0.0.1'&&expected.pathname==='/'&&!expected.search&&!expected.hash&&!expected.username&&!expected.password&&url.origin===expected.origin&&request.headers.get('sec-fetch-site')!=='cross-site';}catch{return false;}
}
