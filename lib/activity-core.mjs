export const ACTIVITY_LIMIT=20;
export function activityValues(task){return {name:task.name||'',deadline:task.deadline||'',status:task.done?'done':task.pending?'pending':'active',priority:task.priority||'normal',notes:task.notes||'',repeat:task.repeat||null};}
export function createActivity(previous,next,{id='',at='',source='app'}={}){
 const after=activityValues(next),before=previous?activityValues(previous):null;
 const changes=before?Object.keys(after).filter(field=>JSON.stringify(before[field])!==JSON.stringify(after[field])).map(field=>({field,before:before[field],after:after[field]})):[];
 if(before&&!changes.length)return null;
 let action=previous?'updated':'created';
 if(source==='scheduler')action='recurring_created';
 else if(previous&&changes.some(c=>c.field==='status'))action=after.status==='done'?'completed':after.status==='pending'?'paused':before.status==='pending'?'resumed':'reopened';
 return {id,at,source,action,taskId:next.id,taskName:next.name,deadline:next.deadline||'',changes};
}
export function recentActivity(entries){
 if(!Array.isArray(entries))return [];
 return entries.filter(e=>e&&typeof e.id==='string'&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&typeof e.taskName==='string'&&Array.isArray(e.changes)).slice().sort((a,b)=>b.at.localeCompare(a.at)).slice(0,ACTIVITY_LIMIT);
}
export function appendActivity(entries,entry){return entry?recentActivity([entry,...entries.filter(e=>e.id!==entry.id)]):recentActivity(entries);}
