'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MOPPrivacy=api;})(globalThis,()=>{
  const emailPattern=/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+/gi;
  function label(name,id){const value=typeof name==='string'?name.trim():'';return value&&!value.includes('@')?value.slice(0,100):'Operador'+(id?' '+String(id).slice(0,8):'');}
  function clean(value){
    if(typeof value==='string')return value.replace(emailPattern,'[e-mail protegido]');
    if(Array.isArray(value))return value.map(clean);
    if(value&&typeof value==='object'){
      const result={};for(const [key,item] of Object.entries(value)){
        if(key==='email')continue;
        result[key]=key==='content'?item:clean(item);
      }
      if(value.user_id&&(value.email||value.display_name))result.display_name=label(value.display_name,value.user_id);
      for(const [field,identity] of Object.entries({created_by:'created_identity',updated_by:'updated_identity',deleted_by:'deleted_identity',actor:'author',incoming:'incoming_identity',outgoing:'outgoing_identity'})){
        if(value[field]!==undefined&&value[identity]?.display_name)result[field]=label(value[identity].display_name,value[identity].user_id);
        else if(typeof value[field]==='string'&&value[field].includes('@'))result[field]=label(null,value[identity]?.user_id);
      }
      return result;
    }
    return value;
  }
  return {label,clean};
});
