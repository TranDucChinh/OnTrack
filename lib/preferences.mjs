import en from './translations.json' with {type:'json'};
import {recurrenceLabel,validateRecurrence} from './task-core.mjs';
export const PREFERENCES_KEY='ontrack-preferences-v1';
export const DEFAULT_PREFERENCES={theme:'light',language:'vi'};
export function readPreferences(value){
  try{const p=typeof value==='string'?JSON.parse(value):value;return {theme:p?.theme==='dark'?'dark':'light',language:p?.language==='en'?'en':'vi'};}catch{return {...DEFAULT_PREFERENCES};}
}
export function translate(text,language='vi',values={}){
  const source=String(text??'');let message=language==='en'?(en[source]??source):source;
  if(language==='en' && typeof values[0]==='number' && values[0]===1){message=message.replace(/\btasks are\b/g,'task is').replace(/\btasks have\b/g,'task has').replace(/\btasks\b/g,'task').replace(/\bhours\b/g,'hour').replace(/\bdays\b/g,'day');}
  return message.replace(/\{(\d+|[a-zA-Z_]+)\}/g,(match,key)=>values[key]===undefined?match:String(values[key]));
}
export function localeFor(language){return language==='en'?'en-GB':'vi-VN';}
export function localizedRecurrence(value,language='vi'){
  const r=validateRecurrence(value);if(language!=='en')return recurrenceLabel(r);
  if(!r)return 'Does not repeat';
  if(r.type==='interval'){const unit=r.unit==='hours'?'hour':'day';return `Every ${r.every} ${unit}${r.every===1?'':'s'}`;}
  if(r.type==='weekly')return 'Weekly · '+r.weekdays.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d-1]).join(', ');
  return 'Monthly · day '+r.day;
}
