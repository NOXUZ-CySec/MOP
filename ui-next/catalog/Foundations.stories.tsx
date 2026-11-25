import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckCircle2, Clock3, Activity, AlertTriangle } from "lucide-react";
const meta: Meta = { id: "mop-foundations", title: "Fundamentos/Identidade", tags: ["autodocs"] };
export default meta;
type Story = StoryObj;

export const Superficies: Story = {
  name: "Superfícies e identidade",
  render: () => <section>
    <header className="mop-catalog-heading"><small>MOP · Referência visual</small><h1>Uma identidade, em todas as telas</h1><p>As superfícies usam as mesmas variáveis do aplicativo. Cores de status continuam restritas aos indicadores, textos e ícones.</p></header>
    <div className="mop-catalog-grid">
      {[["Painel","--mop-glass-panel","Painéis de conteúdo, tabelas e gráficos."],["Campo","--mop-glass-field","Entradas de dados e filtros."],["Menu","--mop-glass-menu","Menus legíveis sobre os demais painéis."]].map(([label,token,description]) => <article className="mop-catalog-panel" key={token}><h2>{label}</h2><div className="mop-catalog-swatch" style={{background:`var(${token})`}}/><code className="mop-catalog-token">{token}</code><p>{description}</p></article>)}
    </div>
    <div className="mop-catalog-panel" style={{marginTop:20}}><h2>Estados operacionais</h2><div className="mop-catalog-row"><span className="mop-catalog-badge done"><CheckCircle2 size={15}/>Concluído</span><span className="mop-catalog-badge active"><Activity size={15}/>Em andamento</span><span className="mop-catalog-badge pending"><Clock3 size={15}/>Pendente</span><span className="mop-catalog-badge"><AlertTriangle size={15}/>Atenção necessária</span></div><p>Todo estado combina texto e sinal visual. Foco de teclado permanece separado da seleção.</p></div>
  </section>,
};
