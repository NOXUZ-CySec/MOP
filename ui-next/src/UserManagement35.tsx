import { useEffect, useRef, useState } from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, PageAction } from "./PageHeader";
import RecordFilterDropdown from "./RecordFilterDropdown";
import CondoAccessDropdown97 from "./CondoAccessDropdown97";
import { normalizeRecordText } from "./components/records1097/recordQuery";
import "./management-accounts.css";

const roles = {
  operator: { label: "Operador", description: "Registra ocorrências e atua nos fluxos do plantão." },
  supervisor: { label: "Supervisor", description: "Supervisiona a operação e acessa relatórios e auditoria." },
  viewer: { label: "Visualizador", description: "Consulta os dados autorizados com acesso somente leitura." },
  admin: { label: "Administrador", description: "Gerencia usuários e tem acesso a todos os condomínios." },
};
type Role = keyof typeof roles;
export type Member = { user_id?: string; id?: string; username?: string; display_name?: string; role?: string; condos?: string[] | null };
export type NewMember = { username: string; email: string; password: string; display_name: string; role: Role; condos: string[] | null };
type Props = {
  demo: boolean;
  onList?: () => Promise<unknown>;
  onSave?: (member: Member) => Promise<unknown>;
  onCreate?: (member: NewMember) => Promise<unknown>;
};
type Form = NewMember & { id?: string; confirm: string };
const empty = (): Form => ({ username: "", email: "", password: "", confirm: "", display_name: "", role: "operator", condos: [] });
const demoMembers: Member[] = [
  { user_id: "demo-admin", username: "admin.demo", display_name: "Administrador de Testes", role: "admin", condos: null },
  { user_id: "demo-supervisor", username: "supervisor.demo", display_name: "Supervisor de Testes", role: "supervisor", condos: ["Homologação"] },
  { user_id: "demo-operator", username: "operador.demo", display_name: "Operador de Testes", role: "operator", condos: ["Homologação"] },
];
const validRole = (role?: string): Role => Object.hasOwn(roles, role || "") ? role as Role : "viewer";
const memberId = (member: Member) => member.user_id || member.id;
const scope = (condos?: string[] | null) => condos === null ? "Todos os condomínios" :
  condos?.length === 1 ? condos[0] : condos?.length ? condos.length + " condomínios" : "Sem condomínios autorizados";

export default function UserManagement35({ demo, onList, onSave, onCreate }: Props) {
  const [members, setMembers] = useState<Member[]>(demo ? demoMembers : []);
  const [form, setForm] = useState<Form | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const readVersion = useRef(0);
  const submitLock = useRef(false);
  const formTitle = useRef<HTMLHeadingElement>(null);
  const load = async () => {
    if (demo) return;
    const version = ++readVersion.current;
    setLoading(true);setListError("");
    try {
      if (!onList) throw Error("Canal de gestão indisponível.");
      const data = await onList() as Member[] | { members?: Member[]; operators?: Member[] } | null;
      const rows = Array.isArray(data) ? data : data?.members ?? data?.operators;
      if (!Array.isArray(rows)) throw Error("A central retornou uma lista inválida.");
      if (version === readVersion.current) setMembers(rows);
    } catch (error) {
      if (version === readVersion.current) setListError(error instanceof Error ? error.message : "Falha ao consultar usuários.");
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  };
  useEffect(() => { void load(); return () => { ++readVersion.current; }; }, [demo]);
  const showForm = (next: Form | null) => {
    setForm(next);setFormError("");setMessage("");
    if (next) requestAnimationFrame(() => formTitle.current?.focus());
  };
  const edit = (member: Member) => showForm({
    ...empty(), id: memberId(member), username: member.username || "", display_name: member.display_name || "",
    role: validRole(member.role), condos: member.condos === null || member.role === "admin" ? null : member.condos || [],
  });
  const change = (value: Partial<Form>) => setForm(current => current ? { ...current, ...value } : current);
  const changeRole = (role: Role) => {
    if (!form) return;
    change({ role, condos: role === "admin" ? null : form.role === "admin" ? [] : form.condos });
  };
  const visible = members.filter(member => (!roleFilter || member.role === roleFilter) &&
    normalizeRecordText([member.display_name, member.username, ...(member.condos || [])].join(" ")).includes(normalizeRecordText(query.trim())));
  const create = !!form && !form.id;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || demo || submitLock.current) return;
    setFormError("");setMessage("");
    const username = form.username.trim().toLowerCase(), display_name = form.display_name.trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) || !display_name || display_name.includes("@")) {
      setFormError("Use um nome de exibição sem e-mail e um usuário de 3 a 40 caracteres com letras, números, ponto, hífen ou sublinhado.");
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (create && (!email || form.password.trim().length < 12 || new TextEncoder().encode(form.password).length > 72 || form.password !== form.confirm)) {
      setFormError("Informe o e-mail e confirme uma senha de pelo menos 12 caracteres e até 72 bytes.");
      return;
    }
    const access = { username, display_name, role: form.role, condos: form.condos };
    submitLock.current = true;setSaving(true);
    try {
      if (form.id) {
        if (!onSave) throw Error("O serviço de permissões está indisponível.");
        await onSave({ user_id: form.id, ...access });
      } else {
        if (!onCreate) throw Error("O cadastro pela central está indisponível.");
        await onCreate({ email, password: form.password, ...access });
      }
      setForm(null);
      setMessage(create ? "Conta criada na central. O colaborador pode entrar com o usuário cadastrado." : "Permissões atualizadas na central.");
      void load();
    } catch (error) {
      const feedback = error instanceof Error ? error.message : "Falha ao salvar a conta.";
      setFormError(feedback);
    } finally {
      submitLock.current = false;setSaving(false);
    }
  };

  return <section className="mop-accounts">
    <PageHeader page="users" title="Gerenciamento de Usuários" description="Cadastre contas e gerencie o acesso aos condomínios." actions={<>
      <PageAction kind="refresh" onClick={() => void load()} disabled={loading || saving || demo}>{loading ? "Atualizando…" : "Atualizar"}</PageAction>
      <PageAction kind="create" primary onClick={() => showForm(empty())} disabled={saving || demo || !onCreate}>Novo usuário</PageAction>
    </>}/>
    {demo && <p className="mop-account-muted">Demonstração com usuários fictícios. Cadastro indisponível neste modo.</p>}
    {listError && <p role="alert" className="mop-account-message error">{listError}</p>}
    {message && <p role="status" className="mop-account-message">{message}</p>}
    <div className="mop-account-layout">
      <Card className="mop-account-panel">
        <h2>Usuários cadastrados</h2>
        <div className="mop-account-actions">
          <div className="mop-account-search"><Search size={16} aria-hidden="true"/><Input aria-label="Buscar usuário" placeholder="Nome, usuário ou condomínio" value={query} onChange={event => setQuery(event.target.value)}/></div>
          <RecordFilterDropdown label="Filtrar por perfil" value={roleFilter} placeholder="Todos os perfis" options={["all", ...Object.keys(roles)]}
            display={value => value === "all" ? "Todos os perfis" : roles[validRole(value)].label} onChange={value => setRoleFilter(value === "all" ? "" : value)}/>
        </div>
        <p className="mop-account-muted" role="status">{loading ? "Consultando a central…" : visible.length + " de " + members.length + " usuários"}</p>
        <div className="mop-account-list">
          {visible.map(member => <Button key={memberId(member)} type="button" variant="ghost" className="mop-account-row" aria-pressed={!!form?.id && form.id === memberId(member)}
            disabled={saving} onClick={() => edit(member)}>
            <UserRound aria-hidden="true"/><span><strong>{member.display_name || member.username || "Usuário"}</strong><small>{member.username || "Sem identificação"} · {scope(member.condos)}</small></span>
            <span className="mop-account-role">{roles[validRole(member.role)].label}</span>
          </Button>)}
          {!loading && !visible.length && <p className="mop-account-muted">{members.length ? "Nenhum usuário corresponde aos filtros." : "Nenhum usuário disponível."}</p>}
        </div>
      </Card>
      <Card className="mop-account-panel">
        <h2 ref={formTitle} tabIndex={-1}>{form ? create ? "Nova conta" : "Editar acesso" : "Permissões e condomínios"}</h2>
        {form ? <form onSubmit={event => void submit(event)}>
          <fieldset disabled={saving || demo}>
            <label>Nome de exibição<Input required maxLength={100} value={form.display_name} onChange={event => change({ display_name: event.target.value })}/></label>
            <label>Usuário de acesso<Input required minLength={3} maxLength={40} autoComplete="off" spellCheck={false} value={form.username} onChange={event => change({ username: event.target.value })}/></label>
            {create && <>
              <label>E-mail da conta<Input type="email" required maxLength={254} autoComplete="off" value={form.email} onChange={event => change({ email: event.target.value })}/></label>
              <label>Senha inicial<Input type="password" minLength={12} maxLength={72} required autoComplete="new-password" value={form.password} onChange={event => change({ password: event.target.value })}/></label>
              <label>Confirmar senha<Input type="password" minLength={12} maxLength={72} required autoComplete="new-password" value={form.confirm} onChange={event => change({ confirm: event.target.value })}/></label>
              <p className="mop-account-muted">A conta é ativada ao salvar. Confira o e-mail usado para acesso e recuperação.</p>
            </>}
            <div><span className="mop-account-label">Permissões</span><RecordFilterDropdown label="Perfil de acesso" value={form.role} options={Object.keys(roles)}
              disabled={demo || saving} display={value => roles[validRole(value)].label} onChange={value => changeRole(validRole(value))}/>
              <p className="mop-account-muted">{roles[form.role].description}</p>
            </div>
            <div><span className="mop-account-label">Condomínios autorizados</span>
              <CondoAccessDropdown97 value={form.condos} disabled={demo || saving || form.role === "admin"} onChange={condos => change({ condos })}/>
              {!form.condos?.length && form.condos !== null && <p className="mop-account-muted">Sem seleção, a conta fica sem acesso a condomínios.</p>}
            </div>
          </fieldset>
          {formError && <p role="alert" className="mop-account-message error">{formError}</p>}
          <div className="mop-account-actions">
            <Button type="submit" disabled={saving || demo}>{saving ? "Salvando…" : create ? "Criar conta" : "Salvar permissões"}</Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => showForm(null)}>Cancelar</Button>
          </div>
        </form> : <p className="mop-account-empty"><ShieldCheck size={18} aria-hidden="true"/>Selecione um usuário para consultar ou alterar o acesso.</p>}
      </Card>
    </div>
  </section>;
}
