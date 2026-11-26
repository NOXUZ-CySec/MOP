'use strict';
const {visible}=require('./operations.cjs');
const ExcelJS=require('exceljs');
const {BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const formatTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(d):'Não informado'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clean=value=>String(value??'').trim().slice(0,3000);
const esc=value=>clean(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const named={overview:'Visão geral',records:'Registros',occurrences:'Ocorrências',shift:'Passagem de turno',routines:'Rotinas',analytics:'Análises avançadas'};
const filters={period:['Todos os períodos','Hoje','Últimos 7 dias','Últimos 30 dias'],status:['Todos os status','Pendente','Em andamento','Concluído']};
const isDue=(t,day)=>{const w=new Date(day+'T12:00:00Z').getUTCDay(),r=t.recurrence||'daily';return r==='daily'||r==='weekdays'&&w>=1&&w<=5||r==='weekly'&&Number(t.weekday)===w||(r==='once'||r==='date')&&t.scheduled_date===day};
function authorize(session){if(!session||!['supervisor','admin'].includes(session.role))throw Error('Relatórios e exportações são exclusivos para supervisor e administrador.');}
const DASHBOARD_METRICS={created:'Registros criados',open:'Ocorrências abertas',overdue:'Ocorrências vencidas',closed:'Registros concluídos'};
const DAY=86400000;
const saoPauloDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const parseDashboardDay=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
 const stamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:NaN;
};
function dashboardCategory(value){
 const category=String(value||'');
 if(/acesso|ocorr|seguran/i.test(category))return 'Segurança';
 if(/cftv|sistema|backup/i.test(category))return 'Sistemas';
 if(/manuten|equipamento/i.test(category))return 'Manutenção';
 if(/infra|internet|comunica|energia/i.test(category))return 'Infraestrutura';
 return 'Rotina';
}
function createDashboardData(store,session,input){
 const selection=input.dashboard;
 if(!selection||typeof selection!=='object'||!Array.isArray(selection.ids)||!selection.ids.length||
  !selection.ids.every(id=>typeof id==='string'&&id.length>0&&id.length<=256)||
  !Object.hasOwn(DASHBOARD_METRICS,selection.metric)||!['condo','category'].includes(selection.dimension)||
  (selection.group!==undefined&&(typeof selection.group!=='string'||selection.group.length>3000))){
  throw Error('Seleção do dashboard inválida.');
 }
 const {start,end,selectedDate,group,dimension,metric}=selection;
 const now=Date.now(),day=saoPauloDay.format(new Date(now));
 const first=parseDashboardDay(start),last=parseDashboardDay(end);
 const selected=parseDashboardDay(selectedDate);
 if(!Number.isFinite(first)||!Number.isFinite(last)||last<first||last-first>=366*DAY||end>day||
  (selectedDate!==undefined&&(!Number.isFinite(selected)||selected<first||selected>last))){
  throw Error('Período do dashboard inválido.');
 }
 const condo=clean(input.condo),category=clean(input.category),status=clean(input.status);
 const ids=new Set(selection.ids);
 const items=visible(store.read(),session).items;
 const rows=[],byCategory=new Map(),byCondo=new Map(),daily=new Map();
 const increment=(map,key)=>map.set(key,(map.get(key)||0)+1);
 const counts={created:0,open:0,overdue:0,closed:0};
 for(const item of items){
  const protocol=String(item.protocol||item.id||'—');
  if(item.deleted_at||!ids.has(protocol))continue;
  const time=Date.parse(item.created_at||item.updated_at||'');
  if(!Number.isFinite(time)||time>now)continue;
  const rowDay=saoPauloDay.format(new Date(time));
  const condoName=String(item.condo||'Não informado'),categoryName=dashboardCategory(item.category);
  const rowStatus=item.status==='Resolvido'?'Concluído':item.status==='Em andamento'?'Em andamento':'Pendente';
  const closed=rowStatus==='Concluído',open=!closed&&categoryName!=='Rotina';
  const overdue=open&&Date.parse(item.deadline||'')<now;
  if(rowDay<start||rowDay>end||(selectedDate&&selectedDate!==rowDay)||
   (condo!=='Todos os condomínios'&&condoName!==condo)||
   (category!=='Todas as categorias'&&categoryName!==category)||
   (status!=='Todos os status'&&rowStatus!==status)||
   (group&&group!==(dimension==='condo'?condoName:categoryName))||
   (metric==='closed'&&!closed)||(metric==='open'&&!open)||(metric==='overdue'&&!overdue))continue;
  ids.delete(protocol);
  counts.created++;
  counts.closed+=Number(closed);
  counts.open+=Number(open);
  counts.overdue+=Number(overdue);
  increment(byCategory,categoryName);increment(byCondo,condoName);increment(daily,rowDay);
  rows.push({time,values:[protocol,clean(item.subject||'Registro sem título'),condoName,categoryName,rowStatus,clean(item.priority)||'—',formatTime(item.deadline||''),formatTime(new Date(time).toISOString())]});
 }
 if(ids.size)throw Error('Os registros selecionados mudaram. Atualize o dashboard e tente novamente.');
 rows.sort((a,b)=>b.time-a.time);
 const series=[];
 const displayDate=value=>value.split('-').reverse().join('/');
 for(let date=selectedDate?selected:first;date<=(selectedDate?selected:last);date+=DAY){
  const key=new Date(date).toISOString().slice(0,10);
  series.push([displayDate(key),daily.get(key)||0]);
 }
 return {section:'overview',sectionTitle:'Dashboard operacional',day,condo,category,status,
  period:displayDate(start)+' a '+displayDate(end),role:session.role,operator:clean(session.display_name||session.username||session.userId),
  generated:formatTime(new Date(now).toISOString()),stats:Object.entries(DASHBOARD_METRICS).map(([key,label])=>[label,counts[key]]),
  headings:['Protocolo','Registro','Condomínio','Categoria','Status','Prioridade','Prazo','Criado em'],
  rows:rows.map(row=>row.values),byCategory:[...byCategory],byCondo:[...byCondo],dashboard:{series,dimension},
  caveat:'Seleção: '+DASHBOARD_METRICS[metric]+(selectedDate?' · Dia '+displayDate(selectedDate):'')+(group?' · '+group:'')+
   '. Status e prazo refletem a situação atual.'};
}
function dashboardChartsHtml(report){
 const columns=report.dashboard.series;
 const max=Math.max(1,...columns.map(([,count])=>count));
 const peak=columns.reduce((a,b)=>a[1]>=b[1]?a:b);
 const width=630,height=70;
 const bars=columns.map(([,count],i)=>{
  const step=width/columns.length,barHeight=count/max*(height-4);
  return '<rect x="'+(i*step).toFixed(2)+'" y="'+(height-barHeight).toFixed(2)+'" width="'+(step*.8).toFixed(2)+'" height="'+barHeight.toFixed(2)+'" fill="#147fa6"/>';
 }).join('');
 const grouping=report.dashboard.dimension==='category'?report.byCategory:report.byCondo;
 const top=grouping.slice().sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,8);
 const districts=top.map(([label,count])=>'<div style="margin:5px 0">'+esc(label)+' · '+count+
  '<div style="background:#dbeaf2;height:5px;width:100%"><div style="background:#147fa6;height:5px;width:'+count/top[0][1]*100+'%"></div></div></div>').join('');
 return '<section style="break-inside:avoid"><p>Categoria: '+esc(report.category)+' · Status: '+esc(report.status)+'</p>'+
  '<p>'+esc(report.caveat)+'</p><div style="display:grid;grid-template-columns:3fr 2fr;gap:18px">'+
  '<div><h2>Evolução diária</h2><svg viewBox="0 0 '+width+' '+height+'" width="100%" style="display:block;border-bottom:1px solid #bfd4e0" role="img" aria-label="Total por dia">'+bars+'</svg>'+
  '<p>'+esc(columns[0][0])+' a '+esc(columns.at(-1)[0])+' · Pico: '+peak[1]+' em '+esc(peak[0])+'</p></div>'+
  '<div><h2>Distribuição por '+(report.dashboard.dimension==='category'?'categoria':'condomínio')+'</h2>'+districts+'</div></div></section>';
}
function createData(store,session,input={}){
 authorize(session);
 if(input.dashboard!==undefined){
  if(input.section!=='overview')throw Error('Exportação do dashboard inválida.');
  return createDashboardData(store,session,input);
 }
 if(!named[input.section]||!filters.period.includes(input.period)||!filters.status.includes(input.status))throw Error('Filtros de relatório inválidos.');
 const scoped=visible(store.read(),session);
 const permitted=new Set(scoped.items.filter(x=>!x.deleted_at).map(x=>String(x.condo)));
 const condo=clean(input.condo||'Todos os condomínios');
 if(condo!=='Todos os condomínios'&&!permitted.has(condo))throw Error('Condomínio fora do escopo autorizado ou sem registros.');
 const category=clean(input.category||'Todas as categorias'),validCategories=['Segurança','Sistemas','Rotina','Manutenção','Infraestrutura','Todas as categorias'];
 if(!validCategories.includes(category))throw Error('Categoria inválida.');
 const end=Date.now(),day=today();
 const records=scoped.items.filter(x=>!x.deleted_at).filter(x=>{
  const ms=Date.parse(x.created_at);if(!Number.isFinite(ms))return false;
  if(input.period==='Hoje'&&new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms))!==day)return false;
  if(input.period==='Últimos 7 dias'&&ms<end-7*86400000)return false;
  if(input.period==='Últimos 30 dias'&&ms<end-30*86400000)return false;
  const st=x.status==='Resolvido'?'Concluído':x.status;
  return (condo==='Todos os condomínios'||x.condo===condo)&&(category==='Todas as categorias'||x.category===category)&&(input.status==='Todos os status'||st===input.status);
 }).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const normalized=records.map(x=>({protocol:clean(x.protocol||x.id),title:clean(x.subject),description:clean(x.description),condo:clean(x.condo),category:clean(x.category),status:x.status==='Resolvido'?'Concluído':clean(x.status),priority:clean(x.priority||'Normal'),author:clean(x.created_by||x.created_identity?.display_name||'Não informado'),created:formatTime(x.created_at),createdAt:x.created_at,updated:formatTime(x.updated_at),updatedAt:x.updated_at,action:clean(x.action_taken),next:clean(x.next_action)}));
 const selected=input.section==='occurrences'?normalized.filter(x=>x.category!=='Rotina'):normalized;
 const rows=selected.map(x=>[x.protocol,x.title,x.condo,x.category,x.status,x.priority,x.author,x.created,x.updated,x.description,x.action,x.next]);
 const headings=['Protocolo','Título','Condomínio','Categoria','Status','Prioridade','Registrado por','Data do registro','Última atualização','Descrição','Providências','Próxima ação'];
 const stats=[['Registros no recorte',normalized.length],['Ocorrências não rotineiras',normalized.filter(x=>x.category!=='Rotina').length],['Pendentes',normalized.filter(x=>x.status==='Pendente').length],['Em andamento',normalized.filter(x=>x.status==='Em andamento').length],['Concluídos',normalized.filter(x=>x.status==='Concluído').length]];
 const byCategory=new Map(),byCondo=new Map();for(const r of selected){byCategory.set(r.category,(byCategory.get(r.category)||0)+1);byCondo.set(r.condo,(byCondo.get(r.condo)||0)+1)}
 return {section:input.section,days:[1,7,30].includes(Number(input.days))?Number(input.days):30,sectionTitle:named[input.section],period:input.period,condo,category,status:input.status,operator:clean(session.display_name||session.username||session.userId),role:session.role,generated:formatTime(new Date().toISOString()),rows,headings,stats,byCategory:[...byCategory],byCondo:[...byCondo],day,scoped};
}
async function enrichReport(report,store,sync,session){
 const {section}=report;
 if(section==='analytics'){
  const days=Number(report.days||30);const a=require('./report-analytics106.cjs').analyze(report.scoped.items.filter(x=>!x.deleted_at),{days,condo:report.condo,category:report.category,status:report.status});
  report.period='Últimos '+days+' dia(s) comparados com '+days+' anteriores';
  report.headings=['Categoria','Período atual','Período anterior','Variação'];report.rows=a.comparison.map(x=>[x.label,x.current,x.previous,x.current-x.previous]);
  report.stats=[['Registros atuais',a.currentCount],['Registros anteriores',a.previousCount],...a.metrics.slice(1).map(x=>[x.type==='incidents'?'Ocorrências não rotineiras':x.type==='pending'?'Pendentes no recorte':'Em andamento no recorte',x.current])];
  report.analytics=a;report.caveat='Comparações usam a data de criação; status são os estados atuais dos registros, não reconstruções históricas. Recorrência identifica títulos iguais na mesma unidade. Sem histórico integral de status ou de execução de turnos.';
 }
 if(section==='shift'){
  report.period='Passagem de turno atual';report.condo='Escopo autorizado';report.category='Não se aplica';report.status='Não se aplica';
  const handovers=report.scoped.handovers||[];
  const latest=handovers.slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))[0];
  report.headings=['Entrega','Recebimento','Responsável pela entrega','Resumo','Observação do recebimento','Pendências da entrega'];
  report.rows=latest?[[formatTime(latest.delivered_at||latest.at),latest.receipt_at?formatTime(latest.receipt_at):'Pendente',clean(latest.outgoing_identity?.display_name||latest.outgoing||'Não informado'),clean(latest.handover_note||latest.note),clean(latest.receipt_note),Array.isArray(latest.snapshot)?latest.snapshot.filter(x=>x.status!=='Resolvido').length:0]]:[];
  report.stats=[['Passagem mais recente',latest?'Disponível':'Sem dados'],['Recebimento',latest?.receipt_at?'Concluído':latest?'Pendente':'Não informado']];
  report.caveat='Este relatório mostra apenas a última passagem de turno visível, não um histórico completo.';
 }
 if(section==='routines'){
  report.period='Dia corrente';report.condo='Central operacional';report.category='Não se aplica';report.status='Não se aplica';
  const local=require('./checklist68.cjs');local.setup(store.db);
  const shared=require('./shared-ops93.cjs');
  const data=shared.active(sync,session)?await shared.checklist(sync,session,'list'):local.action(store.db,session,'list');
  const planned=(data.tasks||[]).filter(x=>isDue(x,report.day));
  const done=new Set((data.runs||[]).map(x=>String(x.task_id)));
  report.headings=['Rotina','Período','Horário','Recorrência','Situação'];
  report.rows=planned.map(x=>[clean(x.title),clean(x.period),clean(x.reminder_time||'Sem horário'),clean(x.recurrence||'daily'),done.has(String(x.id))?'Concluída pela equipe':'Aguardando']);
  report.stats=[['Previstas hoje',planned.length],['Concluídas',planned.filter(x=>done.has(String(x.id))).length],['Aguardando',planned.filter(x=>!done.has(String(x.id))).length]];
  report.caveat='Rotinas: retrato do dia corrente. Filtros de período/categoria/status não se aplicam a esta seção.';
 }
 delete report.scoped;
 return report;
}
function sheets(report){
 const workbook=new ExcelJS.Workbook();workbook.creator='MOP · Central Operacional';workbook.created=new Date();
 function add(name,head,values){const ws=workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});ws.addRow(head);ws.getRow(1).eachCell(c=>{c.font={name:'Aptos',bold:true,color:{argb:'FFFFFFFF'},size:11};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123D5B'}};c.alignment={vertical:'middle',wrapText:true};c.border={bottom:{style:'thin',color:{argb:'FF58B9D7'}}}});ws.getRow(1).height=30;for(const v of values)ws.addRow(v.map(x=>typeof x==='string'&&/^[=+@\-\t\r\n]/.test(x)?'\''+x:x));ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:head.length}};ws.eachRow((row,index)=>{if(index>1){row.height=22;row.eachCell(c=>{c.font={name:'Aptos',size:10,color:{argb:'FF17334B'}};c.alignment={vertical:'middle',wrapText:true};if(index%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFF6FA'}}})}});head.forEach((v,i)=>{ws.getColumn(i+1).width=Math.min(46,Math.max(16,String(v).length+6))});return ws}
 add('Resumo',['Indicador','Valor'],[['Relatório',report.sectionTitle],['Período',report.period],['Condomínio',report.condo],['Categoria',report.category],['Status',report.status],['Emitido por',report.operator],['Perfil',report.role],['Data de emissão',report.generated],...report.stats,...(report.caveat?[['Observação',report.caveat]]:[])]);
 add('Detalhamento',report.headings,report.rows);
 if(report.section==='analytics'&&report.analytics){add('Recorrências',['Condomínio','Título','Repetições no recorte'],report.analytics.recurrence.map(x=>[x.condo,x.label,x.count]));add('Série diária',['Início do dia (UTC)','Registros'],report.analytics.series.map(x=>[x.start,x.count]))}
 if(report.dashboard){add('Evolução',['Data','Registros'],report.dashboard.series);}
 if(['overview','records','occurrences'].includes(report.section)){add('Por categoria',['Categoria','Quantidade'],report.byCategory);add('Por condomínio',['Condomínio','Quantidade'],report.byCondo)}
 return workbook;
}
function html(report){
 const table=(head,rows)=>'<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">Nenhum registro no período selecionado.</td></tr>')+'</tbody></table>';
 const charts=report.dashboard?dashboardChartsHtml(report):'';
 const pdfRows=report.rows.length&&report.headings.length===12?report.rows.map(row=>[row[0],row[1],row[2],row[4],row[5],row[7],row[9]]):report.rows;
 const pdfHead=report.headings.length===12?['Protocolo','Título','Condomínio','Status','Prioridade','Data do registro','Descrição']:report.headings;
 return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><style>@page{size:A4 landscape;margin:12mm 10mm}body{font:10px Segoe UI,Arial,sans-serif;color:#193449;margin:0}h1{font-size:25px;margin:0 0 3px}h2{font-size:14px;margin-top:21px;color:#124a71}header{border-bottom:3px solid #167ead;padding:0 0 12px;margin-bottom:14px}header p{color:#647f8e;margin:2px 0}.brand{font-weight:800;letter-spacing:2px;color:#147fa6;font-size:11px}.details{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:13px 0}.details div{border:1px solid #bfd4e0;padding:9px;border-radius:6px}.details strong{display:block;margin-top:5px;font-size:13px}.grid{display:flex;gap:8px;flex-wrap:wrap}.metric{border:1px solid #c4d9e3;border-radius:6px;padding:10px;min-width:105px}.metric span{display:block;color:#60788c}.metric b{font-size:17px}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:8px}th{background:#113b59;color:white;text-align:left;padding:6px}td{border-bottom:1px solid #d4e2e8;padding:6px;vertical-align:top;overflow-wrap:anywhere;max-width:230px}tr:nth-child(even){background:#f0f7fa}thead{display:table-header-group}tr{break-inside:avoid}.notice{color:#627f90;font-size:9px;margin:14px 0}footer{border-top:1px solid #d0e0e8;margin-top:20px;padding-top:8px;color:#7893a1}</style></head><body><header><span class="brand">MOP / CENTRAL OPERACIONAL</span><h1>Relatório de '+esc(report.sectionTitle)+'</h1><p>Documento de apoio à supervisão e administração</p></header><div class="details"><div>Período<strong>'+esc(report.period)+'</strong></div><div>Condomínio<strong>'+esc(report.condo)+'</strong></div><div>Emitido por<strong>'+esc(report.operator)+'</strong></div><div>Emissão<strong>'+esc(report.generated)+'</strong></div></div><h2>Indicadores do recorte</h2><div class="grid">'+report.stats.map(([k,v])=>'<div class="metric"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('')+'</div>'+charts+'<h2>Detalhamento</h2>'+table(pdfHead,pdfRows)+(report.caveat?'<p class="notice">'+esc(report.caveat)+'</p>':'')+'<footer>Fonte: registros autorizados da central MOP · Emitido automaticamente · Uso interno</footer></body></html>';
}
async function generate(report,format,filePath){
 if(format==='xlsx'){const b=await sheets(report).xlsx.writeBuffer();await fs.writeFile(filePath,Buffer.from(b));return}
 const browser=new BrowserWindow({show:false,width:1250,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try{await browser.loadURL('data:text/html;charset=utf-8;base64,'+Buffer.from(html(report)).toString('base64'));const pdf=await browser.webContents.printToPDF({printBackground:true,landscape:true,pageSize:'A4',margins:{marginType:'none'},preferCSSPageSize:true});await fs.writeFile(filePath,pdf)}finally{if(!browser.isDestroyed())browser.destroy()}
}
module.exports={authorize,createData,enrichReport,generate,html,sheets};
