import {useMemo,useState} from 'react';
import {Input,type EntityPickerOption} from './primitives.js';

export function MultiEntityPicker({
 values,options,onChange,placeholder='بحث واختيار',emptyLabel='لا توجد عناصر متاحة',disabled=false,
}:{
 readonly values:readonly string[];
 readonly options:readonly EntityPickerOption[];
 readonly onChange:(ids:string[])=>void;
 readonly placeholder?:string;
 readonly emptyLabel?:string;
 readonly disabled?:boolean;
}){
 const[query,setQuery]=useState('');
 const selected=new Set(values);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase('ar');return [...options].sort((a,b)=>a.label.localeCompare(b.label,'ar')).filter(option=>!q||`${option.code??''} ${option.label} ${option.description??''}`.toLocaleLowerCase('ar').includes(q));},[options,query]);
 function toggle(id:string,checked:boolean){onChange(checked?[...values,id]:values.filter(value=>value!==id));}
 return <div className="ui-multi-picker">
  <Input value={query} onChange={event=>setQuery(event.target.value)} placeholder={placeholder} disabled={disabled}/>
  <div className="ui-multi-picker__options" role="group" aria-label={placeholder}>
   {!filtered.length?<small>{emptyLabel}</small>:filtered.map(option=><label key={option.id} className="ui-checkbox-field"><input type="checkbox" checked={selected.has(option.id)} disabled={disabled||option.disabled} onChange={event=>toggle(option.id,event.target.checked)}/><span>{option.code?`${option.code} — `:''}{option.label}{option.description?` — ${option.description}`:''}</span></label>)}
  </div>
  {values.length?<small>تم اختيار {values.length}</small>:null}
 </div>;
}
