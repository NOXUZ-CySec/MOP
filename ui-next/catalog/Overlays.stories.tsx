import React, { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/components/ui/button";
import { MopCloseDialog } from "../src/components/MopCloseDialog";
import RecordFilterDropdown from "../src/RecordFilterDropdown";
import SwapCalendar109 from "../src/SwapCalendar109";
import RoutineDatePicker99 from "../src/RoutineDatePicker99";
const meta: Meta = { id:"mop-overlays", title:"Componentes/Menus e calendários", tags:["autodocs"] };
export default meta;
type Story = StoryObj;
function DialogExample(){
 const [open,setOpen]=useState(false),[result,setResult]=useState("");
 const trigger=useRef<HTMLButtonElement>(null);
 return <section className="mop-catalog-panel"><header className="mop-catalog-heading"><small>Confirmação</small><h1>Saída com confirmação</h1><p>Cancelar recebe o foco inicial. Tab fica dentro do diálogo e Esc devolve o foco à origem.</p></header><Button ref={trigger} onClick={()=>setOpen(true)}>Abrir confirmação</Button><p role="status">{result}</p><MopCloseDialog open={open} onOpenChange={setOpen} onConfirm={()=>{setResult("Confirmação recebida no catálogo.");setOpen(false);}} onReturnFocus={()=>trigger.current?.focus()}/></section>;
}
function DropdownExample(){
 const [value,setValue]=useState("Todos os status");
 return <section className="mop-catalog-panel"><header className="mop-catalog-heading"><small>Filtros</small><h1>Menu sobre o conteúdo</h1><p>Referência de contraste, foco e sobreposição usada nas telas operacionais.</p></header><div className="mop-catalog-overlay-preview"><RecordFilterDropdown label="Filtrar status" value={value} options={["Todos os status","Pendente","Em andamento","Concluído"]} onChange={setValue}/><p>Conteúdo do painel abaixo do menu.</p><p role="status">Filtro selecionado: {value}</p></div></section>;
}
function CalendarExample(){
 const [value,setValue]=useState("2026-11-25");
 return <section className="mop-catalog-calendar scale70"><header className="mop-catalog-heading"><small>Escala</small><h1>Calendário de solicitação</h1><p>Exemplo fixo de novembro de 2026: o dia 24 e os dias anteriores a 20 estão indisponíveis.</p></header><SwapCalendar109 value={value} onChange={setValue} minDate="2026-11-20" excludeDate="2026-11-24"/></section>;
}
function RoutineExample(){
 const [value,setValue]=useState("2026-11-25");
 return <section className="mop-catalog-panel"><header className="mop-catalog-heading"><small>Rotinas</small><h1>Seleção de data</h1><p>O calendário abre junto ao campo e mantém a data selecionada.</p></header><div style={{minHeight:360,maxWidth:360}}><RoutineDatePicker99 value={value} onChange={setValue}/><p className="mop-catalog-selection" role="status">Data escolhida: {value}</p></div></section>;
}
export const Confirmacao: Story = { render:()=> <DialogExample/> };
export const Dropdown: Story = { render:()=> <DropdownExample/> };
export const CalendarioEscala: Story = { name:"Calendário · escala", render:()=> <CalendarExample/> };
export const CalendarioRotina: Story = { name:"Calendário · rotina", render:()=> <RoutineExample/> };
