import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Loader2 } from "lucide-react";
import { MopLoginFields } from "../src/components/MopLoginFields";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Label } from "../src/components/ui/label";
const meta: Meta = { id: "mop-fields", title: "Componentes/Campos", tags: ["autodocs"] };
export default meta;
type Story = StoryObj;
function LoginExample({busy=false,error=false}:{busy?:boolean;error?:boolean}) {
 const [login,setLogin]=useState(""),[password,setPassword]=useState(""),[reveal,setReveal]=useState(false),[submitted,setSubmitted]=useState(false);
 return <section className="mop-catalog-login mop-shadcn-login">
  <img className="mop-brand-logo" src="./brand/mop-logo.webp" alt="MOP"/>
  <h2>Bem-vindo ao MOP</h2><p>Exemplo interativo do formulário. Os campos usam apenas dados locais de demonstração.</p>
  <form onSubmit={e=>{e.preventDefault();setSubmitted(true);}}>
   <MopLoginFields login={login} password={password} reveal={reveal} busy={busy} errorId={error?"catalog-login-error":undefined} onLoginChange={setLogin} onPasswordChange={setPassword} onRevealToggle={()=>setReveal(v=>!v)}/>
   {error&&<p id="catalog-login-error" className="mop-catalog-error" role="alert">Confira o usuário e a senha informados.</p>}
   <Button className="mop-login-submit" type="submit" disabled={busy}>{busy?"Entrando…":"Entrar no MOP"}{busy?<Loader2 size={17}/>:<ArrowRight size={17}/>}</Button>
  </form>
  {submitted&&<p role="status">Formulário de demonstração validado.</p>}
 </section>;
}
export const Login: Story = { render:()=> <LoginExample/> };
export const LoginCarregando: Story = { name:"Login · carregando", render:()=> <LoginExample busy/> };
export const LoginErro: Story = { name:"Login · erro", render:()=> <LoginExample error/> };
export const Estados: Story = { name:"Estados dos campos", render:()=> <section className="mop-catalog-fields mop-catalog-panel">
 <header className="mop-catalog-heading"><small>Formulários</small><h1>Estados de entrada</h1><p>Use Tab para conferir o foco. Todos os campos têm rótulo associado.</p></header>
 <div className="mop-catalog-stack">
  <div><Label htmlFor="catalog-normal">Normal</Label><Input id="catalog-normal" placeholder="Digite uma observação"/></div>
  <div><Label htmlFor="catalog-filled">Preenchido</Label><Input id="catalog-filled" defaultValue="Monitoramento do turno"/></div>
  <div><Label htmlFor="catalog-error">Com erro</Label><Input id="catalog-error" aria-invalid="true" aria-describedby="catalog-field-error" defaultValue=""/><p id="catalog-field-error" className="mop-catalog-error">Informe uma descrição antes de continuar.</p></div>
  <div><Label htmlFor="catalog-disabled">Desabilitado</Label><Input id="catalog-disabled" disabled value="Aguardando permissão" readOnly/></div>
 </div>
</section> };
export const Acoes: Story = { name:"Botões e ações", render:()=> <section className="mop-catalog-panel"><header className="mop-catalog-heading"><small>Interação</small><h1>Ações com hierarquia</h1><p>Ação principal, ação secundária e ação destrutiva têm pesos visuais distintos.</p></header><div className="mop-catalog-row"><Button>Salvar alterações</Button><Button variant="secondary">Cancelar</Button><Button variant="outline">Exportar</Button><Button variant="destructive">Excluir</Button><Button disabled>Salvando…</Button></div></section> };
