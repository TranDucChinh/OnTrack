import seed from './seed.json';
import { validateTask } from './task-core.mjs';
type RuntimeEnv = {ONTRACK_SCRIPT_URL?:string;ONTRACK_API_TOKEN?:string;ONESIGNAL_APP_ID?:string};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function ontrackApi(request:Request,env:RuntimeEnv,dev=false){
  if(!dev&&!request.headers.get('oai-authenticated-user-id'))return json({error:'Bạn cần đăng nhập để sử dụng OnTrack.'},401);
  const live=Boolean(env.ONTRACK_SCRIPT_URL&&env.ONTRACK_API_TOKEN);
  if(!live&&(env.ONTRACK_SCRIPT_URL||env.ONTRACK_API_TOKEN))return json({error:'Cấu hình kết nối Sheet chưa đầy đủ. Cần cả địa chỉ Apps Script và mã kết nối.'},503);
  if(request.method==='GET'){
    if(!live)return json({mode:'demo',tasks:seed,pushAppId:'',pushReady:false,schedulerActive:false,lastCheck:null,lastCheckError:false,deviceCount:0});
    return remote({action:'list'},env);
  }
  if(request.method!=='POST')return json({error:'Phương thức không được hỗ trợ.'},405);
  const origin=request.headers.get('Origin');
  if(!origin||origin!==new URL(request.url).origin)return json({error:'Yêu cầu không hợp lệ.'},403);
  if(!live)return json({error:'Chưa kết nối Google Sheet.'},409);
  if(Number(request.headers.get('Content-Length')||0)>20000)return json({error:'Dữ liệu quá lớn.'},413);
  let body:any;try{const text=await request.text();if(text.length>20000)return json({error:'Dữ liệu quá lớn.'},413);body=JSON.parse(text);}catch{return json({error:'Dữ liệu không hợp lệ.'},400);}
  if(!body||typeof body!=='object')return json({error:'Dữ liệu không hợp lệ.'},400);
  if(body.action==='save'){
    try{const clean=validateTask(body.task||{});if(!/^[a-zA-Z0-9-]{1,100}$/.test(body.task?.id||''))throw new Error('Mã công việc không hợp lệ.');body={action:'save',task:{...clean,id:body.task.id},baseVersion:body.baseVersion??null};}catch(e){return json({error:(e as Error).message},400);}
  }else if(['subscribe','testPush'].includes(body.action)){
    if(!/^[0-9a-f-]{36}$/i.test(body.subscriptionId||''))return json({error:'Mã thiết bị không hợp lệ.'},400);
    body={action:body.action,subscriptionId:body.subscriptionId};
  }else return json({error:'Thao tác không được hỗ trợ.'},400);
  return remote(body,env);
}
async function remote(body:object,env:RuntimeEnv){
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(env.ONTRACK_SCRIPT_URL||''))return json({error:'Địa chỉ kết nối Apps Script chưa hợp lệ.'},503);
  try{
    const response=await fetch(env.ONTRACK_SCRIPT_URL!,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token:env.ONTRACK_API_TOKEN}),redirect:'follow',signal:AbortSignal.timeout(25000)});
    if(!response.ok)return json({error:'Không kết nối được Apps Script. Kiểm tra triển khai và quyền truy cập.'},502);
    const result=await response.json() as any;
    if(!result.ok)return json({error:result.error||'Không thể cập nhật Sheet.'},result.code==='conflict'?409:502);
    return json({...result,mode:'live',pushReady:Boolean(result.pushReady&&env.ONESIGNAL_APP_ID),pushAppId:env.ONESIGNAL_APP_ID||''});
  }catch{return json({error:'Kết nối Sheet bị gián đoạn. Dữ liệu chưa được xác nhận lưu; hãy đồng bộ lại trước khi thử.'},502);}
}
