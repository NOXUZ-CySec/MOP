import { PageHeader, PageAction } from "./PageHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Dialog, Tabs } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import RecordFilterDropdown from "./RecordFilterDropdown";
import type { OperationalRecord, RecordStatus } from "./RecordsPage";
import "./occurrences1109.css";

type Member = { user_id: string; display_name?: string; username?: string; condos?: string[] | null };
type Snapshot = {
  tracking: { record_protocol: string; priority: string; assigned_user_id: string | null }[];
  members: Member[];
  updates: { id: string; record_protocol: string; note: string; author_id: string; created_at: string }[];
  statusHistory?: { id: string; record_protocol: string; from: string; to: string; at: string; actor: string; kind: string; source: string }[];
};
type Props = {
  records: OperationalRecord[];
  role: string;
  demo: boolean;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpenRecord: (id: string) => void;
  onEditRecord: (id: string) => void;
  onNewRecord: () => void;
};
const empty: Snapshot = { tracking: [], members: [], updates: [] };
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const stamp = (value?: string) => Date.parse(value || "");
const format = (value?: string) => Number.isFinite(stamp(value)) ? date.format(stamp(value)) : "Não informado";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const statuses: RecordStatus[] = ["Pendente", "Em andamento", "Concluído"];
const priorities = ["Baixa", "Normal", "Alta", "Crítica"];
const defaultFilters = { status: "", category: "", condo: "", period: "", assignee: "", age: "" };
const labels = { status: "Status", category: "Categoria", condo: "Condomínio", period: "Período", assignee: "Responsável", age: "Tempo em aberto" };
const queues = { open: "Em aberto", critical: "Críticas", late: "Prazo vencido", unassigned: "Sem responsável" };
type Queue = keyof typeof queues | "";
type Pending = { id: string; title: string; from: RecordStatus; to: RecordStatus };

function severity(value?: string) {
  const key = normalize(value || "");
  if (/critic|urgente|emerg/.test(key)) return "Crítica";
  if (/alta|high/.test(key)) return "Alta";
  if (/media|moderad/.test(key)) return "Média";
  if (/baixa|low/.test(key)) return "Baixa";
  return key ? "Normal" : "Não definida";
}

const statusTones: Record<RecordStatus, string> = { Pendente: "pending", "Em andamento": "active", "Concluído": "done" };

function Badge({ children, tone = "" }: { children: React.ReactNode; tone?: string }) {
  return <span data-slot="badge" className="occ-badge" data-tone={tone || undefined}>{children}</span>;
}

export default function Occurrences102({ records, role, demo, loading, error, onRefresh, onOpenRecord, onEditRecord, onNewRecord }: Props) {
  const manager = role === "admin" || role === "supervisor";
  const canWrite = !demo && role !== "viewer";
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 1080px)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width: 1080px)");
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  const [now, setNow] = useState(Date.now);
  const [snapshot, setSnapshot] = useState(empty);
  const [ready, setReady] = useState(demo);
  const [trackingError, setTrackingError] = useState("");
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    if (demo) return;
    const request = ++latest.current;
    try {
      const data: Snapshot = await window.mopDesktop?.occurrence103?.("list");
      if (!data) throw Error("Consulta de acompanhamento indisponível.");
      if (request !== latest.current) return;
      setSnapshot(data);
      setReady(true);
      setTrackingError("");
    } catch (err) {
      if (request !== latest.current) return;
      setReady(false);
      setTrackingError(err instanceof Error ? err.message : "Falha ao consultar acompanhamento.");
    }
  }, [demo]);
  useEffect(() => {
    void refresh();
    const off = demo ? undefined : window.mopDesktop?.onSync?.(event => { if (event?.dataChanged) void refresh(); });
    const timer = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 30000);
    return () => { ++latest.current; off?.(); window.clearInterval(timer); };
  }, [demo, refresh]);

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [more, setMore] = useState(false);
  const [queue, setQueue] = useState<Queue>("");
  const [sort, setSort] = useState("Atenção");
  const [chosen, setChosen] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState("summary");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [assignment, setAssignment] = useState<{ id: string; priority: string; assignee: string }>();
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const lastRow = useRef<HTMLButtonElement | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string; error?: boolean }>();

  const tracking = new Map(snapshot.tracking.map(item => [item.record_protocol, item]));
  const members = new Map(snapshot.members.map(member => [member.user_id, member]));
  const name = (id: string) => members.get(id)?.display_name || members.get(id)?.username || "Usuário atribuído";
  const rows = records.filter(row => row.category !== "Rotina" || row.status !== "Concluído").map(record => {
    const tracked = tracking.get(record.id);
    const priority = severity(tracked?.priority || record.priority);
    const open = record.status !== "Concluído";
    return { record, priority, open, critical: open && priority === "Crítica",
      late: open && stamp(record.deadline) < now,
      age: Math.floor(Math.max(0, now - stamp(record.occurredAt)) / 3600000),
      assignee: tracked?.assigned_user_id || "" };
  });
  const inQueue = (row: typeof rows[number], key: Queue) =>
    key === "unassigned" ? ready && row.open && !row.assignee : !key || row[key];
  const search = normalize(query.trim());
  const filtered = rows.filter(row => {
    const r = row.record;
    if (!inQueue(row, queue) || (filters.status && r.status !== filters.status) ||
        (filters.category && r.category !== filters.category) || (filters.condo && r.condo !== filters.condo) ||
        (filters.assignee && (!ready || (filters.assignee === "unassigned" ? Boolean(row.assignee) : row.assignee !== filters.assignee))) ||
        (filters.age && !(row.open && row.age >= Number(filters.age)))) return false;
    if (search && !normalize([r.id, r.title, r.condo, r.description, r.details].join(" ")).includes(search)) return false;
    const time = stamp(r.occurredAt);
    if (filters.period === "Hoje") return Number.isFinite(time) && day.format(time) === day.format(now);
    return !filters.period || (time <= now && time >= now - (filters.period === "Últimos 7 dias" ? 7 : 30) * 86400000);
  });
  const rank = (row: typeof rows[number]) => row.late ? 0 : row.critical ? 1 : row.open ? 2 : 3;
  filtered.sort((a,b) => (sort === "Atenção" ? rank(a) - rank(b) || (a.late && b.late ? stamp(a.record.deadline) - stamp(b.record.deadline) : 0) : 0)
    || (stamp(b.record.occurredAt) || 0) - (stamp(a.record.occurredAt) || 0));
  // Keep the open detail after a write moves its row out of the current queue.
  const selected = rows.find(row => row.record.id === chosen) || (!compact ? filtered[0] : undefined);
  const record = selected?.record;
  const note = record ? drafts[record.id] || "" : "";
  const update = async (id: string, operation: "note" | "assign" | "status", data: object) => {
    if (!canWrite || writing.current) return;
    writing.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await window.mopDesktop?.occurrence103?.(operation, { ...data, id });
      if (!result?.saved) throw Error("A alteração não foi confirmada.");
      if (operation === "note") setDrafts(current => ({ ...current, [id]: "" }));
      if (operation === "assign") setAssignment(undefined);
      setFeedback({ id, text: operation === "note" ? "Providência registrada." : operation === "assign" ? "Responsável e prioridade atualizados." : "Status atualizado." });
      if (operation === "status") onRefresh();
      void refresh();
    } catch (err) {
      setFeedback({ id, error: true, text: err instanceof Error ? err.message : "Não foi possível salvar a alteração." });
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const requestStatus = (to: RecordStatus) => {
    if (!record || !canWrite || busy || to === record.status || (record.status === "Concluído" && !manager)) return;
    if (to === "Concluído" || record.status === "Concluído") setPending({ id: record.id, title: record.title, from: record.status, to });
    else void update(record.id, "status", { status: to });
  };
  const confirm = () => {
    if (!pending) return;
    setPending(undefined);
    const target = rows.find(row => row.record.id === pending.id)?.record;
    if (!target || target.status !== pending.from) {
      setFeedback({ id: pending.id, error: true, text: "A ocorrência mudou. Confira o status antes de tentar novamente." });
      return;
    }
    void update(pending.id, "status", { status: pending.to === "Concluído" ? "Resolvido" : pending.to });
  };
  const setFilter = (key: keyof typeof labels, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const filterText = (key: keyof typeof labels, value: string) => {
    if (value === labels[key]) return value;
    if (key === "assignee") return value === "unassigned" ? "Sem responsável" : name(value);
    return key === "age" ? "Há pelo menos " + value + " h" : value;
  };
  const choices = (key: keyof typeof labels, values: string[]) =>
    <RecordFilterDropdown label={labels[key]} value={filters[key] || labels[key]} options={[labels[key], ...values]}
      display={value => filterText(key, value)} onChange={value => setFilter(key, value === labels[key] ? "" : value)}/>;
  const assignmentDraft = assignment?.id === record?.id ? assignment : undefined;
  const editPriority = assignmentDraft?.priority ?? (priorities.includes(selected?.priority) ? selected?.priority : "Normal");
  const editAssignee = assignmentDraft?.assignee ?? selected?.assignee ?? "";
  const permitted = record ? snapshot.members.filter(member => member.condos == null || member.condos.includes(record.condo)) : [];
  const updates = snapshot.updates.filter(item => item.record_protocol === record?.id);
  const historyEntries = record ? [
    ...updates.map(item => ({ id: item.id, at: item.created_at, title: item.note, meta: name(item.author_id) + " · Central" })),
    ...(snapshot.statusHistory || []).filter(item => item.record_protocol === record.id).map(item => ({
      id: item.id, at: item.at, title: item.kind + ": " + item.from + " → " + item.to, meta: item.actor + " · " + item.source,
    })),
    { id: "created", at: record.occurredAt, title: "Registro criado", meta: record.author },
  ].sort((a,b) => stamp(b.at) - stamp(a.at)) : [];
  const notice = feedback && <p className={"occ-notice " + (feedback.error ? "error" : "success")} role={feedback.error ? "alert" : "status"}>{feedback.id} · {feedback.text}</p>;
  const detail = record && selected ? <>
    <header className="occ-detail-heading">
      <Badge tone={statusTones[record.status]}>{record.status}</Badge>
      <h2>{record.title}</h2><p>{record.id} · {record.condo}</p>
    </header>
    {feedback?.id === record.id && notice}
    <div className="occ-actions">
      {canWrite && <Button type="button" size="sm" onClick={() => setTab("notes")}>Registrar providência</Button>}
      {canWrite && (selected.open || manager) && <RecordFilterDropdown label="Atualizar status" value="" placeholder="Atualizar status"
        disabled={busy} options={statuses.filter(status => status !== record.status)}
        display={value => value === "Concluído" ? "Encerrar ocorrência" : selected.open ? value : "Reabrir · " + value}
        onChange={value => requestStatus(value as RecordStatus)}/>}
      <Button type="button" size="sm" variant="outline" onClick={() => onOpenRecord(record.id)}>Abrir registro</Button>
    </div>
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="occ-tabs" aria-label="Detalhes da ocorrência">
        <Tabs.Trigger value="summary">Resumo</Tabs.Trigger>
        <Tabs.Trigger value="notes">Providências</Tabs.Trigger>
        <Tabs.Trigger value="history">Histórico</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="summary" className="occ-tab">
        <dl className="occ-facts">
          <div><dt>Categoria</dt><dd>{record.category}</dd></div><div><dt>Prioridade</dt><dd>{selected.priority}</dd></div>
          <div><dt>Prazo</dt><dd>{format(record.deadline)} {selected.late && <Badge tone="late">Vencido</Badge>}</dd></div>
          <div><dt>Tempo em aberto</dt><dd>{selected.open && Number.isFinite(selected.age) ? selected.age + " h" : "—"}</dd></div>
          <div><dt>Registrada em</dt><dd>{format(record.occurredAt)}</dd></div><div><dt>Registrada por</dt><dd>{record.author}</dd></div>
          <div><dt>Responsável</dt><dd>{ready ? (selected.assignee ? name(selected.assignee) : "Sem responsável") : "Consulta indisponível"}</dd></div>
        </dl>
        <div className="occ-copy"><h3>Descrição</h3><p>{record.description || "Sem descrição."}</p>
          {record.nextAction && <><h3>Próxima ação</h3><p>{record.nextAction}</p></>}
        </div>
        {manager && canWrite && <details className="occ-management"><summary>Atribuir responsável e prioridade</summary>
          <div className="occ-actions">
            <RecordFilterDropdown label="Prioridade" value={editPriority} options={priorities}
              onChange={value => setAssignment({ id: record.id, priority: value, assignee: editAssignee })}/>
            <RecordFilterDropdown label="Responsável pela ocorrência" value={editAssignee || "none"}
              options={["none", ...new Set([...permitted.map(member => member.user_id), ...(editAssignee ? [editAssignee] : [])])]}
              display={value => value === "none" ? "Sem responsável" : name(value)}
              onChange={value => setAssignment({ id: record.id, priority: editPriority, assignee: value === "none" ? "" : value })}/>
            <Button type="button" size="sm" disabled={busy || !ready || !assignmentDraft}
              onClick={() => void update(record.id, "assign", { priority: editPriority, assigned_user_id: editAssignee || null })}>Salvar atribuição</Button>
          </div>
        </details>}
        {role !== "viewer" && <Button type="button" size="sm" variant="ghost" onClick={() => onEditRecord(record.id)}>Editar registro original</Button>}
      </Tabs.Content>
      <Tabs.Content value="notes" className="occ-tab">
        {record.actionTaken && <div className="occ-copy"><h3>Providência do registro original</h3><p>{record.actionTaken}</p></div>}
        {canWrite && <form onSubmit={event => { event.preventDefault(); if (note.trim().length >= 4) void update(record.id, "note", { note: note.trim() }); }}>
          <label htmlFor="occ-note">Providência</label>
          <textarea id="occ-note" rows={4} maxLength={2000} placeholder="O que foi feito e qual é o próximo passo?" value={note}
            disabled={busy} onChange={event => { const value = event.target.value; setDrafts(current => ({ ...current, [record.id]: value })); }}/>
          <Button type="submit" size="sm" disabled={busy || note.trim().length < 4}>Adicionar ao histórico</Button>
        </form>}
        {!updates.length && <p className="occ-muted">Nenhuma providência de acompanhamento nesta consulta.</p>}
        <ul className="occ-history">{updates.map(item => <li key={item.id}><p>{item.note}</p><small>{name(item.author_id)} · {format(item.created_at)}</small></li>)}</ul>
      </Tabs.Content>
      <Tabs.Content value="history" className="occ-tab">
        <p className="occ-muted">Inclui providências da central e mudanças de status da auditoria desta estação.</p>
        <ul className="occ-history">{historyEntries.map(item => <li key={item.id}><p>{item.title}</p><small>{item.meta} · {format(item.at)}</small></li>)}</ul>
      </Tabs.Content>
    </Tabs.Root>
  </> : <p className="occ-muted">Selecione uma ocorrência na fila.</p>;

  return <section className="occ-workbench">
    <PageHeader page="occurrences" title="Ocorrências" description="Fila operacional do plantão" actions={<>
      <PageAction kind="refresh" disabled={loading} onClick={() => { setNow(Date.now()); onRefresh(); void refresh(); }}>Atualizar</PageAction>
      {role !== "viewer" && <PageAction kind="create" primary onClick={onNewRecord}>Novo registro</PageAction>}
    </>}/>
    {demo && <p className="occ-muted">Demonstração com dados fictícios.</p>}
    {(error || trackingError) && <p role="alert" className="occ-notice error">{[error, trackingError].filter(Boolean).join(" · ")}</p>}
    {feedback && (!record || feedback.id !== record.id || (compact && !sheet)) && notice}
    <div className="occ-metrics" role="group" aria-label="Prioridades da fila">
      {(Object.keys(queues) as Exclude<Queue, "">[]).map(key => {
        const unavailable = loading || !!error || (!ready && key === "unassigned");
        return <Card className="occ-surface" key={key}>
          <Button type="button" variant="ghost" className={"occ-metric " + key} aria-pressed={queue === key} disabled={unavailable}
            onClick={() => setQueue(queue === key ? "" : key)}>
            <span>{queues[key]}</span><strong>{unavailable ? "—" : rows.filter(row => inQueue(row, key)).length}</strong>
          </Button>
        </Card>;
      })}
    </div>
    <Card className="occ-surface occ-toolbar">
      <div className="occ-actions">
        <div className="occ-search"><Search size={16}/><Input aria-label="Buscar ocorrências" placeholder="Protocolo, título ou condomínio" value={query} onChange={event => setQuery(event.target.value)}/></div>
        {choices("status", statuses)}
        <Button type="button" size="sm" variant="outline" aria-expanded={more} aria-controls="occ-more" onClick={() => setMore(!more)}><SlidersHorizontal/>Mais filtros<ChevronDown/></Button>
      </div>
      <div id="occ-more" className="occ-actions" hidden={!more}>
        {choices("category", [...new Set(rows.map(row => row.record.category))])}
        {choices("condo", [...new Set(rows.map(row => row.record.condo))])}
        {choices("period", ["Hoje", "Últimos 7 dias", "Últimos 30 dias"])}
        {choices("assignee", ["unassigned", ...new Set(rows.map(row => row.assignee).filter(Boolean))])}
        {choices("age", ["24", "48", "72", "168"])}
      </div>
      {(query || queue || Object.values(filters).some(Boolean)) && <div className="occ-actions" aria-label="Filtros ativos">
        {query && <Button type="button" size="xs" variant="secondary" onClick={() => setQuery("")}>Busca: {query}<X aria-label="Remover busca"/></Button>}
        {queue && <Button type="button" size="xs" variant="secondary" onClick={() => setQueue("")}>{queues[queue]}<X aria-label="Remover recorte"/></Button>}
        {Object.entries(filters).filter(([,value]) => value).map(([key,value]) => <Button type="button" size="xs" variant="secondary" key={key}
          onClick={() => setFilter(key as keyof typeof labels, "")}>{filterText(key as keyof typeof labels,value)}<X aria-label="Remover filtro"/></Button>)}
        <Button type="button" size="xs" variant="ghost" onClick={() => { setFilters(defaultFilters); setQuery(""); setQueue(""); }}>Limpar filtros</Button>
      </div>}
    </Card>
    <div className="occ-layout">
      <Card className="occ-surface occ-queue">
        <header><div><h2>Fila operacional</h2><p role="status">{loading ? "Atualizando…" : filtered.length + (filtered.length === 1 ? " ocorrência" : " ocorrências")}</p></div>
          <RecordFilterDropdown label="Ordenar fila" value={sort} options={["Atenção", "Mais recentes"]} onChange={setSort}/>
        </header>
        <div className="occ-rows">
          {filtered.map(row => <Button type="button" variant="ghost" className="occ-row" key={row.record.id} aria-pressed={record?.id === row.record.id}
            onClick={event => { lastRow.current = event.currentTarget; setChosen(row.record.id); setTab("summary"); setSheet(compact); }}>
            <span className="occ-row-main"><strong>{row.record.title}</strong><small>{row.record.id} · {row.record.condo}</small></span>
            <span className="occ-badges"><Badge tone={statusTones[row.record.status]}>{row.record.status}</Badge>
              <Badge tone={row.critical ? "critical" : ""}>{row.priority}</Badge>
              {row.late && <Badge tone="late">Prazo vencido</Badge>}</span>
            <small>{ready ? (row.assignee ? name(row.assignee) : "Sem responsável") : "Responsável indisponível"}
              {" · "}{Number.isFinite(stamp(row.record.deadline)) ? "Prazo " + format(row.record.deadline) : "Sem prazo"}
              {row.open && Number.isFinite(row.age) && " · Aberta há " + row.age + " h"}</small>
          </Button>)}
          {!loading && !filtered.length && <p className="occ-muted">Nenhuma ocorrência no recorte atual.</p>}
        </div>
      </Card>
      {!compact && <Card className="occ-surface occ-detail">{detail}</Card>}
    </div>
    {compact && <Dialog.Root open={sheet && Boolean(record)} onOpenChange={setSheet}>
      <Dialog.Portal><Dialog.Overlay className="occ-sheet-overlay"/>
        <Dialog.Content aria-modal="true" data-slot="sheet-content" className="occ-sheet"
          onCloseAutoFocus={event => { event.preventDefault(); lastRow.current?.focus({ preventScroll: true }); }}>
          <Dialog.Title className="occ-sheet-label">Detalhes da ocorrência</Dialog.Title>
          <Dialog.Description className="sr-only">Acompanhamento do registro selecionado.</Dialog.Description>
          <Dialog.Close asChild><Button type="button" variant="ghost" size="icon-sm" className="occ-sheet-close" aria-label="Fechar detalhes"><X/></Button></Dialog.Close>
          {detail}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>}
    <AlertDialog open={Boolean(pending)} onOpenChange={open => { if (!open) setPending(undefined); }}>
      <AlertDialogContent aria-modal="true" className="occ-confirm" overlayClassName="occ-confirm-overlay">
        <AlertDialogTitle>{pending?.to === "Concluído" ? "Encerrar ocorrência?" : "Reabrir ocorrência?"}</AlertDialogTitle>
        <AlertDialogDescription>{pending?.id} · {pending?.title}. O status passará para {pending?.to}.</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirm}>Confirmar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
