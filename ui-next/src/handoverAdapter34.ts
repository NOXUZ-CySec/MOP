import{CheckCircle2,AlertTriangle,RotateCw}from'lucide-react';
import type{OperationalRecord}from'./RecordsPage';
import type{HandoverSnapshot,HandoverItem}from'./HandoverPage';
const tz='America/Sao_Paulo';
export function handoverFromRecords(records:OperationalRecord[],operator:string):HandoverSnapshot{
const now=new Date(),hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:tz}).format(now)),day=new Intl.DateTimeFormat('pt-BR',{timeZone:tz}).format(now),shift=hour>=6&&hour<18?'Diurno':'Noturno';
const items:HandoverItem[]=records.slice(0,100).map(r=>{const critical=r.status!=='Concluído'&&/urgente|crític|emergên|falha|invasão/i.test(r.title+' '+r.description);return{id:r.id,title:r.title,description:r.description,status:r.status,category:r.category,occurredAt:new Date(r.occurredAt).toLocaleString('pt-BR',{timeZone:tz,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),priority:critical?'Urgente':'Normal',critical,assignee:r.author||'A definir',nextAction:r.status==='Concluído'?'Encerrado':r.details||'Acompanhar e atualizar registro',readVersion:r.occurredAt,icon:r.status==='Concluído'?CheckCircle2:critical?AlertTriangle:RotateCw}});
return{stage:'delivery',shift,date:day,period:shift==='Diurno'?'06:00 – 18:00':'18:00 – 06:00',outgoing:operator,incoming:null,items,deliverySummary:'',receiptNote:'',criticalConfirmations:{}}
}
