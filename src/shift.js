'use strict';
// Shared by the browser and tests. All boundaries use the named time zone.
(function(root){
  const zone='America/Sao_Paulo';
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function parts(value){return Object.fromEntries(formatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]));}
  function dateOffset(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function instant(date,hour){
    const target=Date.parse(date+'T'+String(hour).padStart(2,'0')+':00:00Z');let candidate=target;
    for(let i=0;i<4;i++){const p=parts(candidate),wall=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z');const delta=target-wall;if(!delta)break;candidate+=delta;}
    return new Date(candidate).toISOString();
  }
  function at(value=new Date()){
    const now=new Date(value),p=parts(now),hour=Number(p.hour),date=p.year+'-'+p.month+'-'+p.day;
    const type=hour>=6&&hour<18?'Diurno':'Noturno';
    const startDate=hour<6?dateOffset(date,-1):date;
    const start=instant(startDate,type==='Diurno'?6:18);
    const end=instant(type==='Diurno'?startDate:dateOffset(startDate,1),type==='Diurno'?18:6);
    return {id:startDate+'/'+type,date:startDate,type,time_zone:zone,start_at:start,end_at:end};
  }
  function received(handovers,shift){return handovers.some(h=>{try{return at(h.at).id===shift.id;}catch{return false;}});}
  function label(shift){return shift.type+' · '+shift.date.split('-').reverse().join('/');}
  const api=Object.freeze({zone,at,received,label});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MOPShift=api;
})(globalThis);
