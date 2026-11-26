import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, ArrowUpRight, Bell, BellOff, CalendarDays, Check, CheckCheck, ClipboardList, LoaderCircle, RefreshCw, Repeat2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import RecordFilterDropdown from "./RecordFilterDropdown";
import "./notifications40.css";

export type NoticeTarget = "records" | "handover" | "checklists" | "schedule";
export type MOPNotice = {
  key: string;
  title?: string;
  message?: string;
  description?: string;
  detail?: string;
  type?: string;
  read?: boolean;
  at?: string;
  active?: boolean;
  severity?: string;
  target?: NoticeTarget;
  recordProtocol?: string;
};
type Filter = "all" | "priority" | "unread" | "read";
type Props = {
  notices: MOPNotice[];
  error: string;
  onRead: (key?: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  canOpen: (target: NoticeTarget) => boolean;
  onOpen: (target: NoticeTarget, notice: MOPNotice) => void;
};

const targetLabels: Record<NoticeTarget, string> = {
  records: "Abrir registros", handover: "Abrir passagem", checklists: "Abrir checklists", schedule: "Abrir escala",
};
const groups = {
  all: "Todas as categorias", alerts: "Ocorrências e prazos", handover: "Passagem de turno",
  checklists: "Checklists e rotinas", schedule: "Escala", general: "Geral",
};
type Group = keyof typeof groups;
const filters: [Filter, string][] = [["all", "Todas"], ["priority", "Prioridade"], ["unread", "Não lidas"], ["read", "Lidas"]];
const time = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const stamp = (notice: MOPNotice) => Date.parse(notice.at || "") || 0;
const active = (notice: MOPNotice) => notice.active === true;
const priority = (notice: MOPNotice) => active(notice) && ["danger", "warning"].includes(notice.severity || "");
function targetOf(notice: MOPNotice): NoticeTarget | undefined {
  if (notice.target && Object.hasOwn(targetLabels, notice.target)) return notice.target;
  if (notice.key.startsWith("swap94:")) return "schedule";
  if (notice.type === "shift") return "handover";
  if (notice.type === "checklist") return "checklists";
  if (["overdue", "near", "stale", "critical", "sla"].includes(notice.type || "")) return "records";
}
function category(notice: MOPNotice): Group {
  const target = targetOf(notice);
  return target === "records" ? "alerts" : target || "general";
}
function rank(notice: MOPNotice) {
  if (priority(notice)) return (notice.severity === "danger" ? 0 : 2) + (notice.read ? 1 : 0);
  return notice.read ? 5 : 4;
}
function timeLabel(notice: MOPNotice, now: number) {
  if (!stamp(notice)) return "";
  const minutes = Math.max(0, Math.floor((now - stamp(notice)) / 60000));
  return minutes < 1 ? "Agora" : minutes < 60 ? "Há " + minutes + " min" : minutes < 1440
    ? "Há " + Math.floor(minutes / 60) + " h" : time.format(stamp(notice));
}

export default function NotificationCenter40({ notices, error, onRead, onRefresh, canOpen, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<Group>("all");
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const task = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigating = useRef(false);
  const unread = notices.filter(notice => !notice.read).length;
  const important = notices.filter(priority).length;
  const counts = { all: notices.length, priority: important, unread, read: notices.length - unread };
  const listKey = filter + ":" + group;
  const results = notices.filter(notice => (group === "all" || category(notice) === group) &&
    (filter === "all" || (filter === "priority" ? priority(notice) : filter === "read" ? notice.read : !notice.read)));
  results.sort((a,b) => rank(a) - rank(b) || stamp(b) - stamp(a));
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [open]);

  const run = async (kind: "refresh" | "read" | "readAll", key?: string) => {
    if (task.current) return;
    task.current = true;setBusy(kind);setActionError("");
    try {
      if (kind === "refresh") await onRefresh();
      else await onRead(key);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível atualizar as notificações.");
    } finally {
      task.current = false;setBusy("");
    }
  };

  return <div className="mop-notification-root">
    <Dialog.Root open={open} onOpenChange={value => { setOpen(value);if(value){setNow(Date.now());void run("refresh")} }}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="icon" className="ref-notifications mop-notification-trigger"
          aria-label={"Notificações" + (unread ? " (" + unread + " não lidas)" : "")}>
          <Bell size={20} aria-hidden="true"/>{unread > 0 && <span aria-hidden="true" className="mop-notification-count">{unread > 99 ? "99+" : unread}</span>}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mop-notice-overlay"/>
        <Dialog.Content aria-modal="true" className="mop-notice-sheet" onOpenAutoFocus={event => {event.preventDefault();heading.current?.focus()}}
          onCloseAutoFocus={event => {if(navigating.current){event.preventDefault();navigating.current=false}}}>
          <header className="mop-notice-header">
            <span className="mop-notice-heading-icon"><Bell size={22} aria-hidden="true"/></span>
            <div><Dialog.Title ref={heading} tabIndex={-1}>Central de notificações</Dialog.Title>
              <Dialog.Description aria-live="polite">{unread ? unread + (unread === 1 ? " aviso não lido" : " avisos não lidos") : "Nenhum aviso não lido"}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button type="button" size="icon-sm" variant="ghost" aria-label="Fechar notificações"><X/></Button></Dialog.Close>
          </header>
          <div className="mop-notice-controls">
            <div className="mop-notice-filters" role="group" aria-label="Filtrar notificações">
              {filters.map(([id,label]) => <Button type="button" key={id} variant="outline" size="sm" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}<span className={id === "priority" && important ? "mop-notice-emphasis" : ""}>{counts[id]}</span>
              </Button>)}
            </div>
            <RecordFilterDropdown label="Categoria da notificação" value={group} options={Object.keys(groups)}
              display={value => groups[value as Group]} onChange={value => setGroup(value as Group)}/>
          </div>
          {(actionError || error) && <p role="alert" className="mop-notice-error">{actionError || error}</p>}
          <div className="mop-notice-items" aria-busy={busy === "refresh"}>
            {results.length ? <ul key={listKey} aria-label="Notificações no recorte">{results.map(notice => {
              const kind = category(notice), target = targetOf(notice);
              const Icon = kind === "alerts" ? AlertTriangle : kind === "schedule" ? CalendarDays : kind === "handover" ? Repeat2 : kind === "checklists" ? ClipboardList : Bell;
              const title = notice.title || "Aviso operacional";
              const urgent = priority(notice) && notice.severity === "danger";
              const needsAttention = priority(notice);
              return <li key={notice.key}><Card className="mop-notice-item" data-tone={urgent ? "danger" : needsAttention ? "warning" : "normal"}>
                <span className="mop-notice-item-icon"><Icon size={18} aria-hidden="true"/></span>
                <div className="mop-notice-item-body">
                  <div className="mop-notice-tags">
                    <span>{groups[kind]}</span>
                    {needsAttention && <span className="mop-notice-emphasis">{urgent ? "Crítica" : "Atenção"}</span>}
                    {notice.read ? <span className="mop-notice-read"><Check size={12} aria-hidden="true"/>Lida</span> : <span className="mop-notice-new">Não lida</span>}
                  </div>
                  <h3>{title}</h3>
                  {(notice.detail || notice.message || notice.description) && <p>{notice.detail || notice.message || notice.description}</p>}
                  <div className="mop-notice-item-actions">
                    {stamp(notice) > 0 && <time dateTime={notice.at} title={time.format(stamp(notice))}>{timeLabel(notice, now)}</time>}
                    {target && canOpen(target) && <Button type="button" variant="outline" size="xs" onClick={() => {navigating.current=true;setOpen(false);onOpen(target, notice)}}>
                      <ArrowUpRight aria-hidden="true"/>{target === "records" && notice.recordProtocol ? "Abrir registro" : targetLabels[target]}
                    </Button>}
                    {!notice.read && <Button type="button" variant="ghost" size="xs" disabled={!!busy}
                      aria-label={"Marcar como lida: " + title} onClick={() => void run("read",notice.key)}><Check aria-hidden="true"/>Marcar como lida</Button>}
                  </div>
                </div>
              </Card></li>;
            })}</ul> : <div className="mop-notice-empty" role="status">
              {busy === "refresh" ? <LoaderCircle size={24} className="mop-notice-progress" aria-hidden="true"/> : <BellOff size={24} aria-hidden="true"/>}
              {busy === "refresh" ? "Consultando avisos…" : error ? "Não foi possível confirmar este recorte." : "Nenhum aviso neste recorte."}
              {(filter !== "all" || group !== "all") && <Button type="button" variant="outline" size="sm" onClick={() => {setFilter("all");setGroup("all")}}>Limpar filtros</Button>}
            </div>}
          </div>
          <footer className="mop-notice-footer">
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => void run("refresh")}><RefreshCw className={busy === "refresh" ? "mop-notice-progress" : undefined} aria-hidden="true"/>{busy === "refresh" ? "Atualizando…" : "Atualizar"}</Button>
            <Button type="button" size="sm" disabled={!unread || !!busy} onClick={() => void run("readAll")}>{busy === "readAll" ? <LoaderCircle className="mop-notice-progress" aria-hidden="true"/> : <CheckCheck aria-hidden="true"/>}{busy === "readAll" ? "Marcando avisos…" : "Marcar todas como lidas"}</Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
