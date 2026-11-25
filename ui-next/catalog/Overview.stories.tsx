import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import OverviewCharts1097 from "../src/components/analytics1097/OverviewCharts1097";
const meta: Meta<typeof OverviewCharts1097> = {
 id: "mop-overview", title: "Visão Geral/Indicadores", component: OverviewCharts1097, tags: ["autodocs"],
 args: {
  now: new Date("2026-11-25T15:00:00Z"), accepted: true, demo: false,
  records: [
   {id:"demo-1",category:"Segurança",occurredAt:"2026-11-25T10:00:00-03:00"},
   {id:"demo-2",category:"Segurança",occurredAt:"2026-11-25T11:20:00-03:00"},
   {id:"demo-3",category:"Segurança",occurredAt:"2026-11-24T16:00:00-03:00"},
   {id:"demo-4",category:"Segurança",occurredAt:"2026-11-22T15:00:00-03:00"},
   {id:"demo-5",category:"Rotina",occurredAt:"2026-11-25T08:00:00-03:00"},
  ],
  routines: {date:"2026-11-25",scope:"local",period:"Diurno",tasks:[{id:"r1",done:true},{id:"r2",done:true},{id:"r3",done:false}]},
 },
 parameters: { docs: { description: { component: "Dados fictícios de catálogo. O aplicativo utiliza registros autorizados e rotinas do período atual." } } },
};
export default meta;
type Story = StoryObj<typeof OverviewCharts1097>;
export const ComDados: Story = {name:"Com dados"};
export const Vazio: Story = {args:{records:[],routines:{date:"2026-11-25",scope:"local",period:"Diurno",tasks:[]}}};
export const Carregando: Story = {args:{records:[],routines:null,loading:true,routineLoading:true}};
export const Erro: Story = {args:{records:[],routines:null,error:"Não foi possível consultar os registros.",routineError:"Não foi possível consultar as rotinas."}};
export const AntesDoAceite: Story = {name:"Antes do recebimento do turno",args:{accepted:false,records:[],routines:null}};

export const SomenteConsulta: Story = {name:"Perfil visualizador",args:{canViewRoutines:false,routines:null}};
