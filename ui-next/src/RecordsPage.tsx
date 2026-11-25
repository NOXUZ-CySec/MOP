import RecordsTable1097 from './components/records1097/RecordsTable1097';
import { filterOperationalRecords, emptyRecordFilters, recordDateTime, type RecordPeriod as Period } from './components/records1097/recordQuery';
import RecordFilterDropdown from './RecordFilterDropdown';
import './records67.css';
import React,{useEffect,useMemo,useState} from 'react';
import{Search,CalendarDays,Tag,SlidersHorizontal,X,FileText,CheckCircle2,RotateCw,AlertTriangle,Shield,Monitor,Wifi,ClipboardCheck,Wrench,ChevronRight,ChevronLeft,Copy,Pencil,Trash2,Plus,ArrowUpRight,Clock3,ShieldCheck,Info}from'lucide-react';
import type {LucideIcon} from 'lucide-react';

export type RecordStatus='Concluído'|'Em andamento'|'Pendente';
export type RecordCategory='Segurança'|'Sistemas'|'Rotina'|'Manutenção'|'Infraestrutura';
export type OperationalRecord={
  id:string;title:string;description:string;category:RecordCategory;status:RecordStatus;authorId?:string;editReason?:string;actionTaken?:string;priority?:string;nextAction?:string;updatedAt?:string;
  occurredAt:string;author:string;condo:string;details:string; icon:LucideIcon;
};
/** Visual fixtures only. Replace the provider with an authenticated, scoped read model during integration. */
export const sampleRecords:OperationalRecord[]=[
  {id:'R-0142',title:'Acesso não autorizado (Portaria B)',description:'Tentativa de acesso com credencial inválida.',category:'Segurança',status:'Concluído',occurredAt:'2026-11-15T14:20:00-03:00',author:'Operador',condo:'Condomínio Alpha',details:'Tentativa de acesso com credencial inválida, identificada na Portaria B. Usuário orientado e acesso negado conforme protocolo.',icon:Shield},
  {id:'R-0141',title:'Backup de sistemas',description:'Execução do backup diário dos servidores.',category:'Sistemas',status:'Em andamento',occurredAt:'2026-11-15T13:47:00-03:00',author:'Operador',condo:'Condomínio Beta',details:'Backup programado iniciado. Aguardando confirmação de conclusão pela equipe técnica.',icon:Monitor},
  {id:'R-0140',title:'Checklist de monitoramento',description:'Rotina de verificação dos sistemas de CFTV.',category:'Rotina',status:'Concluído',occurredAt:'2026-11-15T12:31:00-03:00',author:'Operador',condo:'Condomínio Alpha',details:'Verificação de câmeras e estações concluída sem anomalias.',icon:ClipboardCheck},
  {id:'R-0139',title:'Manutenção preventiva – CFTV',description:'Ajuste e limpeza da câmera C-07.',category:'Manutenção',status:'Concluído',occurredAt:'2026-11-15T11:08:00-03:00',author:'Supervisor',condo:'Condomínio Gama',details:'Manutenção preventiva e inspeção de imagem registradas em relatório técnico.',icon:Wrench},
  {id:'R-0138',title:'Falha de comunicação – Leitura de crachá',description:'Instabilidade temporária no leitor da Portaria A.',category:'Infraestrutura',status:'Pendente',occurredAt:'2026-11-15T10:22:00-03:00',author:'Operador',condo:'Condomínio Beta',details:'Leitor com perda intermitente de comunicação. Acionamento da equipe responsável pendente.',icon:Wifi},
  {id:'R-0137',title:'Validação de acesso externo',description:'Conferência da documentação de visitante.',category:'Segurança',status:'Concluído',occurredAt:'2026-11-14T16:10:00-03:00',author:'Operador',condo:'Condomínio Alpha',details:'Documentação conferida e acesso autorizado conforme procedimentos.',icon:Shield},
  {id:'R-0136',title:'Atualização de servidor de arquivos',description:'Acompanhamento de janela de manutenção.',category:'Sistemas',status:'Em andamento',occurredAt:'2026-11-14T15:02:00-03:00',author:'Supervisor',condo:'Condomínio Gama',details:'Janela iniciada; aguardando retorno de testes de disponibilidade.',icon:Monitor},
  {id:'R-0135',title:'Inspeção das câmeras externas',description:'Checagem do perímetro do estacionamento.',category:'Rotina',status:'Concluído',occurredAt:'2026-11-13T09:12:00-03:00',author:'Operador',condo:'Condomínio Beta',details:'Imagens do perímetro verificadas conforme checklist.',icon:ClipboardCheck},
  {id:'R-0134',title:'Oscilação de conectividade',description:'Perda parcial de comunicação com o equipamento.',category:'Infraestrutura',status:'Pendente',occurredAt:'2026-11-12T08:55:00-03:00',author:'Operador',condo:'Condomínio Alpha',details:'Instabilidade intermitente identificada; aguardando atendimento.',icon:Wifi},
  {id:'R-0133',title:'Revisão de nobreak',description:'Manutenção preventiva programada.',category:'Manutenção',status:'Concluído',occurredAt:'2026-11-10T15:25:00-03:00',author:'Técnico',condo:'Condomínio Beta',details:'Equipamento revisado conforme programação.',icon:Wrench}
];
export interface RecordProvider{
  readonly mode:'demo'|'operational';
  list():Promise<OperationalRecord[]>;
}
export const demoRecordProvider:RecordProvider={mode:'demo',async list(){return sampleRecords.map(item=>({...item}))}};
const countLabel=(n:number)=>String(n).padStart(2,'0');
const dateTime=recordDateTime;
export type RecordsPageProps={onCreate:()=>void,records?:OperationalRecord[],onAction?:(action:'edit'|'duplicate'|'delete',id:string,reason?:string)=>void|Promise<void>,mode?:'demo'|'operational',role?:string,userId?:string,openRecordId?:string|null,onOpenRecordHandled?:()=>void;loading?:boolean;error?:string;onRetry?:()=>void};
export default function RecordsPage({onCreate,records=sampleRecords,onAction,mode='demo',role='operator',userId='',openRecordId,onOpenRecordHandled,loading=false,error='',onRetry}:RecordsPageProps){

 const [query,setQuery]=useState(''),[period,setPeriod]=useState<Period>(emptyRecordFilters.period);
 const [category,setCategory]=useState(emptyRecordFilters.category),[status,setStatus]=useState(emptyRecordFilters.status);
 const [condo,setCondo]=useState(emptyRecordFilters.condo),[author,setAuthor]=useState(emptyRecordFilters.author);
 const [selectedId,setSelectedId]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [deleteId,setDeleteId]=useState<string|null>(null),[deleteReason,setDeleteReason]=useState(''),[deleting,setDeleting]=useState(false);
 const [revealRecordId,setRevealRecordId]=useState<string|null>(null),[revealToken,setRevealToken]=useState(0);
 const [resetToken,setResetToken]=useState(0);
 useEffect(()=>{
  if(!openRecordId)return;
  setQuery('');setPeriod(emptyRecordFilters.period);setCategory(emptyRecordFilters.category);setStatus(emptyRecordFilters.status);
  setCondo(emptyRecordFilters.condo);setAuthor(emptyRecordFilters.author);
  if(records.some(record=>record.id===openRecordId)){
   setSelectedId(openRecordId);setRevealRecordId(openRecordId);setRevealToken(token=>token+1);setNotice('');
  }else setNotice('O registro solicitado n\u00e3o est\u00e1 dispon\u00edvel nesta consulta.');
  onOpenRecordHandled?.();
 },[openRecordId,records,onOpenRecordHandled]);
 const categories=[emptyRecordFilters.category,...new Set(records.map(record=>record.category))];
 const condos=[emptyRecordFilters.condo,...Array.from(new Set(records.map(record=>record.condo))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
 const authors=[emptyRecordFilters.author,...Array.from(new Set(records.map(record=>record.author))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
 const filters=useMemo(()=>({query,period,category,status,condo,author}),[query,period,category,status,condo,author]);
 const filtered=useMemo(()=>filterOperationalRecords(records,filters),[records,filters]);
 const hasFilters=!!query.trim()||period!==emptyRecordFilters.period||category!==emptyRecordFilters.category||status!==emptyRecordFilters.status||condo!==emptyRecordFilters.condo||author!==emptyRecordFilters.author;
 const resetKey=JSON.stringify([filters,resetToken]);
 const selected=filtered.find(record=>record.id===selectedId)??filtered.reduce<OperationalRecord|undefined>((latest,record)=>!latest||(Date.parse(record.occurredAt)||0)>(Date.parse(latest.occurredAt)||0)?record:latest,undefined);
 const canEdit=role!=='viewer'&&!!selected&&(role==='admin'||role==='supervisor'||(!!userId&&selected.authorId===userId));
 const metrics=[{label:'Total de registros',value:records.length,tone:'blue',icon:FileText},{label:'Concluídos',value:records.filter(r=>r.status==='Concluído').length,tone:'green',icon:CheckCircle2},{label:'Em andamento',value:records.filter(r=>r.status==='Em andamento').length,tone:'amber',icon:RotateCw},{label:'Pendentes',value:records.filter(r=>r.status==='Pendente').length,tone:'red',icon:AlertTriangle}];
 const clear=()=>{setQuery('');setPeriod(emptyRecordFilters.period);setCategory(emptyRecordFilters.category);setStatus(emptyRecordFilters.status);setCondo(emptyRecordFilters.condo);setAuthor(emptyRecordFilters.author);setResetToken(token=>token+1)};
 const act=async(action:'edit'|'duplicate'|'delete')=>{if(!selected)return;if(action==='delete'){setDeleteId(selected.id);setDeleteReason('');setNotice('');return}if(onAction){try{await onAction(action,selected.id)}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível executar a ação.')}}else{setNotice('Ação indisponível nesta versão.')}};
 const confirmDelete=async()=>{if(!deleteId||deleteReason.trim().length<8||deleting)return;setDeleting(true);try{if(!onAction)throw Error('Exclusão indisponível.');await onAction('delete',deleteId,deleteReason.trim());setDeleteId(null);setDeleteReason('');setSelectedId(null);setNotice('Registro excluído logicamente com auditoria.')}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível excluir o registro.')}finally{setDeleting(false)}};
 return <div className="records-screen">
  <div className="records-topline"><div className="records-heading"><FileText size={34}/><div><h1>Registros</h1><p>Consulta, acompanhamento e gestão de registros operacionais.</p></div></div><button className="records-new" type="button" onClick={onCreate} disabled={role==='viewer'} title={mode==='operational'?'Criar registro autorizado':'Criar registro demonstrativo'}><Plus size={20}/> Novo Registro</button></div>
  <div className="records-metrics">{metrics.map(({label,value,tone,icon:Icon})=><div className={'records-metric '+tone} key={label}><div className="records-metric-icon"><Icon size={23}/></div><div className="records-metric-info"><strong>{countLabel(value)}</strong><span>{label}</span></div><svg viewBox="0 0 68 31" className="records-spark" aria-hidden="true"><path d="M0 23 C11 17 18 27 28 16 S42 8 48 13 S57 14 68 3" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round"/></svg></div>)}</div>
  <div className="records-filters" aria-label="Filtros de registros"><label className="records-search"><Search size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);}} placeholder="Buscar registro..." aria-label="Buscar registro"/></label><RecordFilterDropdown label="Período" excludePlaceholder icon={CalendarDays} value={period} options={['Todos os períodos','Hoje','Últimos 7 dias','Últimos 30 dias']} display={x=>x==='Todos os períodos'?'Período':x} onChange={v=>{setPeriod(v as Period);}}/><RecordFilterDropdown label="Categoria" excludePlaceholder icon={Tag} value={category} options={categories} display={x=>x==='Todas as categorias'?'Categoria':x} onChange={v=>{setCategory(v);}}/><RecordFilterDropdown label="Status" excludePlaceholder icon={SlidersHorizontal} value={status} options={['Todos os status','Concluído','Em andamento','Pendente']} display={x=>x==='Todos os status'?'Status':x} onChange={v=>{setStatus(v);}}/><button className="records-clear" type="button" onClick={clear}><X size={17}/> Limpar filtros</button></div>
  <div className="records1097-extra-filters" aria-label="Filtros de condomínio e responsável">
   <RecordFilterDropdown label="Condomínio" value={condo} options={condos} display={value=>value===emptyRecordFilters.condo?'Todos os condomínios':value} onChange={setCondo}/>
   <RecordFilterDropdown label="Responsável" value={author} options={authors} display={value=>value===emptyRecordFilters.author?'Todos os responsáveis':value} onChange={setAuthor}/>
   <span>{hasFilters?'Filtros ativos · '+filtered.length+' resultados':'Consulta dos registros autorizados'}</span>
  </div>
  <div className="records-layout"><RecordsTable1097 data={filtered} totalRecords={records.length} selectedId={selected?.id} onSelect={id=>{setSelectedId(id);setNotice('')}} resetKey={resetKey} revealRecordId={revealRecordId} revealToken={revealToken} hasFilters={hasFilters} onClearFilters={clear} loading={loading} error={error} onRetry={onRetry}/>
  <aside className="records-detail" aria-label="Detalhes do registro">{selected?<><div className="records-detail-top"><div><FileText size={23}/><h2>Registro #{selected.id}</h2></div><span className={'records-status '+selected.status.replaceAll(' ','-')}>{selected.status}</span></div><dl className="records-definition"><div><dt>Título</dt><dd>{selected.title}</dd></div><div><dt>Categoria</dt><dd>{selected.category}</dd></div><div><dt>Data e Hora</dt><dd>{dateTime(selected.occurredAt)}</dd></div><div><dt>Registrado por</dt><dd>{selected.author}</dd></div><div><dt>Condomínio</dt><dd>{selected.condo}</dd></div></dl><div className="records-description"><h3>Descrição</h3><p>{selected.details}</p></div><div className="records-actions"><button type="button" onClick={()=>act('edit')} disabled={role==='viewer'||(mode==='operational'&&!canEdit)}><Pencil size={16}/> Editar</button><button type="button" onClick={()=>act('duplicate')} disabled={role==='viewer'}><Copy size={16}/> Duplicar</button><button type="button" className="danger" onClick={()=>act('delete')} disabled={role!=='admin'}><Trash2 size={16}/> Excluir</button></div>{notice&&<p role="status" className="records-notice"><Info size={15}/>{notice}</p>}</>:<div className="records-detail-empty"><FileText size={25}/><p>Selecione um registro para visualizar os detalhes.</p></div>}</aside></div><p className="records-demo-note"><Info size={13}/>{mode==='demo'?'Dados demonstrativos: crie, edite e duplique registros fictícios. A exclusão é restrita ao administrador de teste.':'Registros autenticados com controle de permissões e auditoria.'}</p>
 {deleteId&&<div className="records96-overlay" role="presentation"><section className="records96-dialog" role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão do registro"><h2>Excluir registro?</h2><p>O registro será ocultado das consultas operacionais, mas continuará preservado para auditoria. Esta ação não apaga o histórico.</p><label>Justificativa obrigatória<textarea value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} maxLength={1000} rows={3} placeholder="Explique o motivo da exclusão (mínimo 8 caracteres)"/></label>{notice&&<p className="records96-error" role="alert">{notice}</p>}<div className="records96-actions"><button type="button" disabled={deleting} onClick={()=>{setDeleteId(null);setNotice('')}}>Cancelar</button><button type="button" className="danger" disabled={deleting||deleteReason.trim().length<8} onClick={()=>void confirmDelete()}>{deleting?'Excluindo...':'Confirmar exclusão'}</button></div></section></div>}
 </div>
}
