"use client";
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {Languages,Moon,Sun} from 'lucide-react';
import {DEFAULT_PREFERENCES,PREFERENCES_KEY,readPreferences,translate,localeFor,localizedRecurrence} from '../lib/preferences.mjs';
type Theme='light'|'dark';type Language='vi'|'en';
type Preferences={theme:Theme;language:Language};
type PreferenceContext=Preferences&{locale:string;t:(text:string|null|undefined,values?:Record<string,string|number>)=>string;recurrenceText:(rule:unknown)=>string;setTheme:(value:Theme)=>void;setLanguage:(value:Language)=>void;storageError:boolean};
const Context=createContext<PreferenceContext|null>(null);
export function PreferencesProvider({children}:{children:ReactNode}){
 const [prefs,setPrefs]=useState<Preferences>(DEFAULT_PREFERENCES as Preferences);const [storageError,setStorageError]=useState(false);
 useEffect(()=>{try{setPrefs(readPreferences(localStorage.getItem(PREFERENCES_KEY)) as Preferences);}catch{setStorageError(true);}const sync=(e:StorageEvent)=>{if(e.key===PREFERENCES_KEY)setPrefs(readPreferences(e.newValue) as Preferences);};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=prefs.theme;document.documentElement.lang=prefs.language;document.documentElement.style.colorScheme=prefs.theme;},[prefs]);
 const update=(patch:Partial<Preferences>)=>{const next={...prefs,...patch};setPrefs(next);try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}};
 const t=useCallback((text:string|null|undefined,values?:Record<string,string|number>)=>translate(text,prefs.language,values),[prefs.language]);
 return <Context.Provider value={{...prefs,locale:localeFor(prefs.language),t,recurrenceText:rule=>localizedRecurrence(rule,prefs.language),setTheme:theme=>update({theme}),setLanguage:language=>update({language}),storageError}}>{children}</Context.Provider>;
}
export function usePreferences(){const value=useContext(Context);if(!value)throw new Error('PreferencesProvider is required.');return value;}
export function AppearanceSettings(){
 const {theme,language,setTheme,setLanguage,t,storageError}=usePreferences();
 return <section className="panel setting-card settings-full preferences-card"><div className="setting-title"><Languages size={20}/><h2>{t('Giao diện & ngôn ngữ')}</h2></div><div className="preference-grid"><div className="preference-row"><div className="preference-copy"><h3>{t('Chế độ tối')}</h3><p>{t('Chọn giao diện sáng hoặc tối cho OnTrack.')}</p></div><button type="button" className="theme-switch" role="switch" aria-label={t('Chế độ tối')} aria-checked={theme==='dark'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><Sun size={14}/><Moon size={14}/><span className="theme-switch-knob"/></button></div><div className="preference-row"><div className="preference-copy"><h3>{t('Ngôn ngữ')}</h3><p>{t('Chuyển ngôn ngữ hiển thị của ứng dụng.')}</p></div><div className="language-switch" role="group" aria-label={t('Ngôn ngữ')}><button type="button" aria-label="Tiếng Việt" aria-pressed={language==='vi'} className={language==='vi'?'selected':''} onClick={()=>setLanguage('vi')}>VI</button><button type="button" aria-label="English" aria-pressed={language==='en'} className={language==='en'?'selected':''} onClick={()=>setLanguage('en')}>EN</button></div></div></div><div className={storageError?'error':'small'}>{t(storageError?'Không lưu được tùy chọn. Trình duyệt đang chặn lưu trữ.':'Tùy chọn được lưu trên thiết bị này.')}</div></section>;
}
