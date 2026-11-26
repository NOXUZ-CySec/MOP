import { PageHeader, PageAction } from "./PageHeader";
import RecordDetail from "./RecordDetail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog } from "radix-ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import "./records-refinement.css";
import RecordsTable1097 from './components/records1097/RecordsTable1097';
import { filterOperationalRecords, emptyRecordFilters, type RecordPeriod as Period } from './components/records1097/recordQuery';
import RecordFilterDropdown from './RecordFilterDropdown';
import './records67.css';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import { Search, CalendarDays, SlidersHorizontal, X, FileText, CheckCircle2, RotateCw, Clock3, Shield, Monitor, Wifi, ClipboardCheck, Wrench } from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

export type RecordStatus='Concluído'|'Em andamento'|'Pendente';
export type RecordCategory='Segurança'|'Sistemas'|'Rotina'|'Manutenção'|'Infraestrutura';
export type OperationalRecord={
  id:string;title:string;description:string;category:RecordCategory;status:RecordStatus;authorId?:string;editReason?:string;actionTaken?:string;priority?:string;nextAction?:string;updatedAt?:string;assignee?:string;deadline?:string;
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
export type RecordsPageProps={onCreate:()=>void,records?:OperationalRecord[],onAction?:(action:'edit'|'duplicate'|'delete',id:string,reason?:string)=>void|Promise<void>,mode?:'demo'|'operational',role?:string,userId?:string,openRecordId?:string|null,onOpenRecordHandled?:()=>void;loading?:boolean;error?:string;onRetry?:()=>void;initialScope?:'open'|'attention'|'previous';scopeIds?:string[];onScopeHandled?:()=>void};
export default function RecordsPage({onCreate,records=sampleRecords,onAction,mode='demo',role='operator',userId='',openRecordId,onOpenRecordHandled,loading=false,error='',onRetry,initialScope,scopeIds,onScopeHandled}:RecordsPageProps){

 const [query,setQuery]=useState(''),[period,setPeriod]=useState<Period>(emptyRecordFilters.period);
 const [category,setCategory]=useState(emptyRecordFilters.category),[status,setStatus]=useState(emptyRecordFilters.status);
 const [condo,setCondo]=useState(emptyRecordFilters.condo),[author,setAuthor]=useState(emptyRecordFilters.author);
 const [selectedId,setSelectedId]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [deleteId,setDeleteId]=useState<string|null>(null),[deleteReason,setDeleteReason]=useState(''),[deleting,setDeleting]=useState(false);
 const [revealRecordId,setRevealRecordId]=useState<string|null>(null),[revealToken,setRevealToken]=useState(0);
 const [resetToken,setResetToken]=useState(0);
 const [advanced,setAdvanced]=useState(false);
 const [compact,setCompact]=useState(()=>matchMedia("(max-width: 1080px)").matches);
 const [sheet,setSheet]=useState(false);
 const lastRow=useRef<HTMLElement|null>(null);
 const deletingRef=useRef(false);
 const deleteTrigger=useRef<HTMLElement|null>(null);
 const [deleteError,setDeleteError]=useState("");
 useEffect(()=>{
  const viewport=matchMedia("(max-width: 1080px)");
  const change=()=>{setCompact(viewport.matches);if(!viewport.matches)setSheet(false)};
  viewport.addEventListener("change",change);
  return ()=>viewport.removeEventListener("change",change);
 },[]);
 const [briefingScope,setBriefingScope]=useState<{kind:'open'|'attention'|'previous';ids:string[]}|null>(null);
 useEffect(()=>{if(initialScope){setBriefingScope({kind:initialScope,ids:scopeIds||[]});onScopeHandled?.()}},[initialScope,scopeIds,onScopeHandled]);
 useEffect(()=>{
  if(!openRecordId||loading)return;
  setBriefingScope(null);setQuery('');setPeriod(emptyRecordFilters.period);setCategory(emptyRecordFilters.category);setStatus(emptyRecordFilters.status);
  setCondo(emptyRecordFilters.condo);setAuthor(emptyRecordFilters.author);
  if(records.some(record=>record.id===openRecordId)){
   lastRow.current=null;setSheet(compact);setSelectedId(openRecordId);setRevealRecordId(openRecordId);setRevealToken(token=>token+1);setNotice('');
  }else setNotice('O registro solicitado n\u00e3o est\u00e1 dispon\u00edvel nesta consulta.');
  onOpenRecordHandled?.();
 },[openRecordId,records,onOpenRecordHandled,loading,compact]);
 const categories=[emptyRecordFilters.category,...new Set(records.map(record=>record.category))];
 const condos=[emptyRecordFilters.condo,...Array.from(new Set(records.map(record=>record.condo))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
 const authors=[emptyRecordFilters.author,...Array.from(new Set(records.map(record=>record.author))).sort((a,b)=>a.localeCompare(b,'pt-BR'))];
 const filters=useMemo(()=>({query,period,category,status,condo,author}),[query,period,category,status,condo,author]);
 const scoped=useMemo(()=>briefingScope?records.filter(r=>briefingScope.kind==='open'?r.status!=='Concluído':briefingScope.ids.includes(r.id)):records,[records,briefingScope]);
 const filtered=useMemo(()=>filterOperationalRecords(scoped,filters),[scoped,filters]);
 const withoutStatus=useMemo(()=>filterOperationalRecords(scoped,{...filters,status:emptyRecordFilters.status}),[scoped,filters]);
 const hasFilters=!!briefingScope||!!query.trim()||period!==emptyRecordFilters.period||category!==emptyRecordFilters.category||status!==emptyRecordFilters.status||condo!==emptyRecordFilters.condo||author!==emptyRecordFilters.author;
 const resetKey=JSON.stringify([filters,resetToken,briefingScope]);
 const selected=filtered.find(record=>record.id===selectedId)??filtered.reduce<OperationalRecord|undefined>((latest,record)=>!latest||(Date.parse(record.occurredAt)||0)>(Date.parse(latest.occurredAt)||0)?record:latest,undefined);
 const canEdit=role!=='viewer'&&!!selected&&(role==='admin'||role==='supervisor'||(!!userId&&selected.authorId===userId));
 const definitions=[
  {label:"No recorte",target:emptyRecordFilters.status,tone:"total",icon:FileText},
  {label:"Pendentes",target:"Pendente",tone:"pending",icon:Clock3},
  {label:"Em andamento",target:"Em andamento",tone:"active",icon:RotateCw},
  {label:"Concluídos",target:"Concluído",tone:"done",icon:CheckCircle2},
 ];
 const metrics=definitions.map(item=>({...item,value:item.target===emptyRecordFilters.status?withoutStatus.length:withoutStatus.filter(record=>record.status===item.target).length}));
 const clear=()=>{setBriefingScope(null);setQuery('');setPeriod(emptyRecordFilters.period);setCategory(emptyRecordFilters.category);setStatus(emptyRecordFilters.status);setCondo(emptyRecordFilters.condo);setAuthor(emptyRecordFilters.author);setResetToken(token=>token+1)};
 const act=async(action:"edit"|"duplicate"|"delete")=>{
  if(!selected||loading||error||deletingRef.current||role==="viewer")return;
  if(action==="edit"&&mode==="operational"&&!canEdit)return;
  if(action==="delete"){
   if(role!=="admin")return;
   setDeleteId(selected.id);setDeleteReason("");setDeleteError("");return;
  }
  try{if(!onAction)throw Error("Ação indisponível.");await onAction(action,selected.id)}
  catch(err){setNotice(err instanceof Error?err.message:"Não foi possível executar a ação.")}
 };
 const confirmDelete=async()=>{
  const reason=deleteReason.trim();
  if(loading||error||role!=="admin"||!deleteId||reason.length<8||deletingRef.current)return;
  deletingRef.current=true;setDeleting(true);setDeleteError("");
  try{
   if(!onAction)throw Error("Exclusão indisponível.");
   await onAction("delete",deleteId,reason);
   setDeleteId(null);setDeleteReason("");setSheet(false);setSelectedId(null);setNotice("Registro excluído com auditoria.");
  }catch(err){setDeleteError(err instanceof Error?err.message:"Não foi possível excluir o registro.")}
  finally{deletingRef.current=false;setDeleting(false)}
 };
 const blocked=loading||!!error||deleting;
 const detail=selected?<RecordDetail key={selected.id} record={selected} blocked={blocked}
  canEdit={role!=="viewer"&&(mode==="demo"||canEdit)} canDuplicate={role!=="viewer"} canDelete={role==="admin"}
  onEdit={()=>void act("edit")} onDuplicate={()=>void act("duplicate")} onDelete={trigger=>{deleteTrigger.current=trigger;void act("delete")}} onCopyResult={setNotice}/>
  :<p className="mop-record-muted">Selecione um registro da lista.</p>;
 const scopeLabel=briefingScope?{open:"Ocorrências abertas",attention:"Prioridades do briefing",previous:"Registros do turno anterior"}[briefingScope.kind]:"";
 const filterChips=[
  {label:query.trim()?"Busca: "+query.trim():"",reset:()=>setQuery("")},
  {label:period!==emptyRecordFilters.period?period:"",reset:()=>setPeriod(emptyRecordFilters.period)},
  {label:status!==emptyRecordFilters.status?status:"",reset:()=>setStatus(emptyRecordFilters.status)},
  {label:category!==emptyRecordFilters.category?category:"",reset:()=>setCategory(emptyRecordFilters.category)},
  {label:condo!==emptyRecordFilters.condo?condo:"",reset:()=>setCondo(emptyRecordFilters.condo)},
  {label:author!==emptyRecordFilters.author?"Registrado por: "+author:"",reset:()=>setAuthor(emptyRecordFilters.author)},
  {label:scopeLabel,reset:()=>setBriefingScope(null)},
 ].filter(chip=>chip.label);
 const available=!loading&&!error||records.length>0;
 const showRecord=(id:string,trigger?:HTMLElement)=>{
  lastRow.current=trigger||null;
  setSelectedId(id);
  setNotice("");
  if(compact)setSheet(true);
 };
 const closeSheet=(event:Event)=>{
  event.preventDefault();
  if(lastRow.current?.isConnected)lastRow.current.focus({preventScroll:true});
  else document.getElementById("mop-record-search")?.focus({preventScroll:true});
 };
 const closeDeletion=(open:boolean)=>{
  if(!open&&!deletingRef.current){setDeleteId(null);setDeleteReason("");setDeleteError("")}
 };
 return <div className="records-screen records1105 mop-records">
  <PageHeader page="records" title="Registros" description="Consulta e gestão de registros operacionais." actions={<>
   {onRetry&&<PageAction kind="refresh" onClick={onRetry} disabled={loading}>Atualizar</PageAction>}
   <PageAction kind="create" primary onClick={onCreate} disabled={role==="viewer"||loading||!!error}>Novo registro</PageAction>
  </>}/>
  <div className="mop-record-metrics" role="group" aria-label="Filtrar registros por status">
   {metrics.map(({label,value,target,tone,icon:Icon})=><Card key={target} className="mop-record-surface">
    <Button type="button" variant="ghost" className={"mop-record-metric "+tone} aria-pressed={status===target} onClick={()=>setStatus(target)}>
     <span>{label}<Icon size={17} aria-hidden="true"/></span><strong>{available?value:"—"}</strong>
    </Button>
   </Card>)}
  </div>
  <Card className="mop-record-surface mop-record-filters" aria-label="Consulta e filtros">
   <div className="mop-record-actions">
    <div className="mop-record-search"><Search size={17} aria-hidden="true"/><Input id="mop-record-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Protocolo, título ou condomínio" aria-label="Buscar registro"/></div>
    <RecordFilterDropdown label="Período" icon={CalendarDays} value={period} options={["Todos os períodos","Hoje","Últimos 7 dias","Últimos 30 dias"]} display={value=>value===emptyRecordFilters.period?"Período":value} onChange={value=>setPeriod(value as Period)}/>
    <RecordFilterDropdown label="Status" value={status} options={[emptyRecordFilters.status,"Pendente","Em andamento","Concluído"]} display={value=>value===emptyRecordFilters.status?"Status":value} onChange={setStatus}/>
    <Button type="button" size="sm" variant="outline" aria-expanded={advanced} aria-controls="mop-record-advanced" onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal/>{advanced?"Recolher filtros":"Mais filtros"}</Button>
   </div>
   <div hidden={!advanced} id="mop-record-advanced" className="mop-record-actions">
    <RecordFilterDropdown label="Categoria" value={category} options={categories} display={value=>value===emptyRecordFilters.category?"Categoria":value} onChange={setCategory}/>
    <RecordFilterDropdown label="Condomínio" value={condo} options={condos} display={value=>value===emptyRecordFilters.condo?"Condomínio":value} onChange={setCondo}/>
    <RecordFilterDropdown label="Registrado por" value={author} options={authors} display={value=>value===emptyRecordFilters.author?"Registrado por":value} onChange={setAuthor}/>
   </div>
   {filterChips.length>0&&<div className="mop-record-actions" aria-label="Filtros ativos">
    {filterChips.map(chip=><Button key={chip.label} type="button" size="xs" variant="secondary" className="mop-record-chip" aria-label={"Remover filtro "+chip.label} onClick={chip.reset}>{chip.label}<X aria-hidden="true"/></Button>)}
    <Button type="button" size="xs" variant="ghost" onClick={clear}>Limpar filtros</Button>
   </div>}
   <p className="mop-record-muted" role="status">{scopeLabel&&scopeLabel+" · "}{filtered.length} de {records.length} registros{error?" · Consulta desatualizada":loading?" · Atualizando…":""}</p>
  </Card>
  <div className="records-layout mop-record-layout">
   <RecordsTable1097 data={filtered} totalRecords={records.length} selectedId={selected?.id} onSelect={showRecord} resetKey={resetKey} revealRecordId={revealRecordId} revealToken={revealToken} hasFilters={hasFilters} onClearFilters={clear} loading={loading} error={error} onRetry={onRetry}/>
   {!compact&&<aside className="records-detail mop-record-detail" aria-label="Detalhes do registro">{detail}{notice&&<p role="status" className="mop-record-notice">{notice}</p>}</aside>}
  </div>
  {compact&&notice&&!sheet&&<p role="status" className="mop-record-notice">{notice}</p>}
  {mode==="demo"&&<p className="mop-record-muted">Demonstração com dados fictícios.</p>}
  {compact&&<Dialog.Root open={sheet&&!!selected&&selected.id===selectedId} onOpenChange={setSheet}>
   <Dialog.Portal><Dialog.Overlay className="mop-record-overlay"/>
    <Dialog.Content className="mop-record-sheet" aria-modal="true" onCloseAutoFocus={closeSheet}>
     <Dialog.Title className="mop-record-muted">Detalhes do registro</Dialog.Title>
     <Dialog.Description className="sr-only">Dados operacionais do registro selecionado.</Dialog.Description>
     <Dialog.Close asChild><Button type="button" size="icon-sm" variant="ghost" className="mop-record-sheet-close" aria-label="Fechar detalhes"><X/></Button></Dialog.Close>
     {detail}{notice&&<p role="status" className="mop-record-notice">{notice}</p>}
    </Dialog.Content>
   </Dialog.Portal>
  </Dialog.Root>}
  <AlertDialog open={!!deleteId} onOpenChange={closeDeletion}>
   <AlertDialogContent className="mop-record-confirm" overlayClassName="mop-record-confirm-overlay" aria-modal="true"
    onEscapeKeyDown={event=>{if(deletingRef.current)event.preventDefault()}}
    onCloseAutoFocus={event=>{event.preventDefault();if(deleteTrigger.current?.isConnected)deleteTrigger.current.focus({preventScroll:true})}}>
    <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
    <AlertDialogDescription>O registro {deleteId} será ocultado das consultas operacionais e preservado para auditoria.</AlertDialogDescription>
    <label className="mop-record-reason">Justificativa obrigatória<textarea value={deleteReason} onChange={event=>setDeleteReason(event.target.value)} maxLength={1000} rows={3} disabled={deleting} placeholder="Informe o motivo da exclusão (mínimo de 8 caracteres)"/></label>
    {deleteError&&<p role="alert" className="mop-record-notice error">{deleteError}</p>}
    <AlertDialogFooter>
     <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
     <AlertDialogAction variant="destructive" disabled={blocked||role!=="admin"||deleteReason.trim().length<8}
      onClick={event=>{event.preventDefault();void confirmDelete()}}>{deleting?"Excluindo…":"Confirmar exclusão"}</AlertDialogAction>
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </div>;
}
