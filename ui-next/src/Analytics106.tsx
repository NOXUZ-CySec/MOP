import React,{useEffect,useState} from 'react';
import {TrendingUp,TrendingDown,Minus,RefreshCw,BarChart3,AlertTriangle,ShieldAlert,FileText,Clock3,Info} from 'lucide-react';
import RecordFilterDropdown from './RecordFilterDropdown';
import ComparativeCharts1097 from './components/analytics1097/ComparativeCharts1097';
type Metric={type:string;current:number;previous:number;delta:number;percent:number|null};
type Dataset={days:number;currentCount:number;previousCount:number;metrics:Metric[];comparison:Array<{label:string;current:number;previous:number}>;recurrence:Array<{condo:string;label:string;count:number;ids:string[]}>;series:Array<{start:string;count:number}>};
const metricNames:Record<string,string>={all:'Registros criados',incidents:'Ocorrências não rotineiras',pending:'Registros hoje pendentes',progress:'Registros hoje em andamento'};
const time=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',month:'2-digit',day:'2-digit'});
export default function Analytics106({filters,days,setDays,onOpenRecord}:{filters:{condo:string;category:string;status:string};days:number;setDays:(value:number)=>void;onOpenRecord:(id:string)=>void}){
 const[data,setData]=useState<Dataset|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let valid=true;setBusy(true);const run=async()=>{try{const result=await window.mopDesktop?.reportAnalytics106?.({...filters,days}) as Dataset|undefined;if(!result)throw Error('Análises não disponíveis nesta instalação.');if(valid){setData(result);setError('')}}catch(e){if(valid){setError(e instanceof Error?e.message:'Falha ao consultar análises.');setData(null)}}finally{if(valid)setBusy(false)}};void run();return()=>{valid=false}},[filters.condo,filters.category,filters.status,days,revision]);
 useEffect(()=>window.mopDesktop?.onSync?.(event=>{if(event.dataChanged)setRevision(x=>x+1)}),[]);
 const values=data?.metrics||[];
 return <div className="rep106">
  <div className="rep106-title"><div><h2><TrendingUp size={19}/> Análises comparativas</h2><p>Compare volumes de registros criados em períodos equivalentes, respeitando os filtros da central.</p></div><div className="rep106-tools"><RecordFilterDropdown label="Janela de comparação" value={String(days)} options={['1','7','30']} display={v=>v==='1'?'Últimas 24h × 24h anteriores':v==='7'?'Últimos 7 × 7 anteriores':'Últimos 30 × 30 anteriores'} onChange={v=>setDays(Number(v))}/><button type="button" onClick={()=>setRevision(x=>x+1)} disabled={busy}><RefreshCw size={15}/> Atualizar</button></div></div>
  {error&&<div className="rep104-errors" role="alert">{error}</div>}
  {busy&&<div className="rep106-loading" role="status">Calculando indicadores...</div>}
  {!busy&&data&&<>
   <div className="rep106-metrics">{values.map(m=><div className="rep106-metric" key={m.type}><span>{metricNames[m.type]||m.type}</span><strong>{m.current}</strong><div className={'rep106-delta '+(m.delta>0?'up':m.delta<0?'down':'flat')}>{m.delta>0?<TrendingUp size={15}/>:m.delta<0?<TrendingDown size={15}/>:<Minus size={15}/>} {m.delta>0?'+':''}{m.delta} em relação ao período anterior{m.percent!==null?' ('+(m.percent>0?'+':'')+m.percent+'%)':''}</div><small>Anterior: {m.previous}{m.percent===null&&m.current>0?' · Base anterior zerada':''}</small></div>)}</div>
   <ComparativeCharts1097 comparison={data.comparison} series={data.series}/>
   <section className="rep104-panel"><h2><ShieldAlert size={17}/> Assuntos recorrentes no período atual</h2>{data.recurrence.length?<div className="rep106-repeat"><div className="rep106-head"><span>Condomínio</span><span>Assunto do registro</span><span>Repetições</span></div>{data.recurrence.map((r,i)=><div className="rep106-repeat-row" key={i}><span>{r.condo}</span><button type="button" title="Abrir registro original" onClick={()=>r.ids[0]&&onOpenRecord(r.ids[0])}>{r.label}</button><strong>{r.count}</strong></div>)}</div>:<div className="rep106-empty"><FileText size={18}/> Nenhum título não rotineiro se repetiu na mesma unidade neste recorte.</div>}</section>
   <div className="rep106-notice"><Info size={17}/><span>As comparações usam a <strong>data de criação</strong> dos registros. As contagens “hoje pendentes” e “hoje em andamento” aplicam o <strong>status atual</strong> aos registros criados em cada período — não representam status históricos. Recorrência significa mesmo título normalizado no mesmo condomínio; não comprova a mesma causa ou incidente.</span></div>
  </>}
 </div>;
}
