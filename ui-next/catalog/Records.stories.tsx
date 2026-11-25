import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import RecordsTable1097 from "../src/components/records1097/RecordsTable1097";
import RecordsPage, { sampleRecords, type OperationalRecord } from "../src/RecordsPage";
const data: OperationalRecord[] = Array.from({length:26},(_,index)=>({
 ...sampleRecords[index%sampleRecords.length],
 id:"CAT-"+String(index+1).padStart(3,"0"),
 title:sampleRecords[index%sampleRecords.length].title,
 occurredAt:new Date(Date.UTC(2026,10,25-Math.floor(index/3),15,index)).toISOString(),
 author:index%2?"Operador de exemplo":"Supervisor de exemplo",
 authorId:index%2?"demo-operator":"demo-supervisor",
}));
const meta: Meta<typeof RecordsTable1097> = {
 id:"mop-records", title:"Registros/Tabela", component:RecordsTable1097, tags:["autodocs"],
 parameters:{docs:{description:{component:"Catálogo com registros fictícios. A aplicação fornece somente registros autorizados e mantém as ações existentes."}}},
};
export default meta;
type Story = StoryObj<typeof RecordsTable1097>;
function TableExample({empty=false,loading=false,error=""}:{empty?:boolean;loading?:boolean;error?:string}){
 const [selected,setSelected]=useState<string|null>(null);
 return <section className="mop-catalog-panel"><header className="mop-catalog-heading"><small>Consulta operacional</small><h1>Registros organizados</h1><p>Ordenação, paginação, escolha de colunas e seleção. Dados fictícios para revisão visual.</p></header><RecordsTable1097 data={empty?[]:data} totalRecords={empty?0:data.length} selectedId={selected} onSelect={setSelected} loading={loading} error={error} onRetry={()=>{}}/><p role="status" className="mop-catalog-selection">{selected?"Registro selecionado: "+selected:"Selecione um registro para visualizar seus detalhes."}</p></section>;
}
export const ComDados: Story={name:"Com dados",render:()=> <TableExample/>};
export const Vazia: Story={render:()=> <TableExample empty/>};
export const Carregando: Story={render:()=> <TableExample empty loading/>};
export const Erro: Story={render:()=> <TableExample empty error="Não foi possível consultar os registros."/>};
export const PaginaCompleta: Story={name:"Página completa · visualizador",render:()=> <RecordsPage records={data} mode="operational" role="viewer" userId="demo-viewer" onCreate={()=>{}}/>};
