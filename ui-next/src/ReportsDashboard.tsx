import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileDown, FileSpreadsheet, FileText, ShieldAlert } from "lucide-react";
import type { OperationalRecord } from "./RecordsPage";
import RecordFilterDropdown from "./RecordFilterDropdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TrendPoint } from "./components/analytics1097/DashboardCharts";
import "./reports-dashboard.css";

const Charts = lazy(() => import("./components/analytics1097/DashboardCharts"));
const TIME_ZONE = "America/Sao_Paulo";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const countFormat = new Intl.NumberFormat("pt-BR");
const dayKey = (date: Date) => dayFormat.format(date);
const shortDay = (day: string) => day.split("-").reverse().slice(0, 2).join("/");
const dayValue = (day: string) => Date.parse(day + "T12:00:00Z") / 86400000;
const toDay = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
const pageSize = 20;

const periods = { today: "Hoje", week: "Últimos 7 dias", month: "Últimos 30 dias", custom: "Personalizado" };
const metrics = [
  { id: "created", label: "Registros criados", icon: FileText },
  { id: "open", label: "Ocorrências abertas", icon: ShieldAlert },
  { id: "overdue", label: "Ocorrências vencidas", icon: AlertTriangle },
  { id: "closed", label: "Registros concluídos", icon: CheckCircle2 },
] as const;
type Metric = typeof metrics[number]["id"];
type Format = "pdf" | "xlsx";
export type DashboardExport = {
  ids: string[];
  start: string;
  end: string;
  metric: Metric;
  selectedDate?: string;
  dimension: "condo" | "category";
  group?: string;
};
type Props = {
  records: OperationalRecord[];
  loading: boolean;
  error: string;
  onOpenRecord: (id: string) => void;
  canExport: boolean;
  exporting: string;
  onExport: (format: Format, data: DashboardExport, filters: { condo: string; category: string; status: string }) => void;
};

const all = { condo: "Todos os condomínios", category: "Todas as categorias", status: "Todos os status" };
const options = (values: string[], first: string) => [first, ...Array.from(new Set(values)).filter(value => value !== first).sort((a, b) => a.localeCompare(b, "pt-BR"))];

function matchesMetric(record: OperationalRecord, metric: Metric, now: number) {
  if (metric === "created") return true;
  if (metric === "closed") return record.status === "Concluído";
  if (record.status === "Concluído" || record.category === "Rotina") return false;
  return metric === "open" || Date.parse(record.deadline || "") < now;
}
function formatDate(value?: string) {
  const date = new Date(value || "");
  return Number.isFinite(+date) ? dateFormat.format(date) : "—";
}

export default function ReportsDashboard({ records, loading, error, onOpenRecord, canExport, exporting, onExport }: Props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = dayKey(new Date(now));
  const todayNumber = dayValue(today);
  const [period, setPeriod] = useState<keyof typeof periods>("month");
  const [custom, setCustom] = useState({ start: toDay(todayNumber - 29), end: today });
  const [filters, setFilters] = useState(all);
  const [metric, setMetric] = useState<Metric>("created");
  const [dimension, setDimension] = useState<DashboardExport["dimension"]>("condo");
  const [group, setGroup] = useState<string>();
  const [date, setDate] = useState<string>();
  const [page, setPage] = useState(0);

  const start = period === "custom" ? custom.start : toDay(todayNumber - { today: 0, week: 6, month: 29 }[period]);
  const end = period === "custom" ? custom.end : today;
  const startNumber = dayValue(start), endNumber = dayValue(end);
  const days = endNumber - startNumber + 1;
  const validPeriod = days >= 1 && days <= 366 && endNumber <= todayNumber;
  const previousStart = validPeriod ? toDay(startNumber - days) : "";
  const eligible = useMemo(() => records.flatMap(record => {
    const time = Date.parse(record.occurredAt);
    if (!Number.isFinite(time) || time > now) return [];
    if ((filters.condo !== all.condo && record.condo !== filters.condo) ||
      (filters.category !== all.category && record.category !== filters.category) ||
      (filters.status !== all.status && record.status !== filters.status)) return [];
    return [{ record, time, day: dayKey(new Date(time)) }];
  }).sort((a, b) => b.time - a.time), [records, filters, now]);

  const current = validPeriod ? eligible.filter(row => row.day >= start && row.day <= end) : [];
  const previous = validPeriod ? eligible.filter(row => row.day >= previousStart && row.day < start) : [];
  const metricRows = current.filter(({ record }) => matchesMetric(record, metric, now));
  const metricsCount = metrics.map(item => current.filter(({ record }) => matchesMetric(record, item.id, now)).length);
  const currentCounts = new Map<string, number>(), previousCounts = new Map<string, number>();
  const groupCounts = new Map<string, number>();
  for (const row of metricRows) {
    currentCounts.set(row.day, (currentCounts.get(row.day) || 0) + 1);
    const label = row.record[dimension];
    groupCounts.set(label, (groupCounts.get(label) || 0) + 1);
  }
  for (const row of previous) {
    if (matchesMetric(row.record, metric, now)) previousCounts.set(row.day, (previousCounts.get(row.day) || 0) + 1);
  }
  const trend: TrendPoint[] = validPeriod ? Array.from({ length: days }, (_, index) => {
    const key = toDay(startNumber + index);
    return { key, label: shortDay(key), current: currentCounts.get(key) || 0, previous: previousCounts.get(toDay(startNumber - days + index)) || 0 };
  }) : [];
  const distribution = Array.from(groupCounts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  const detail = metricRows.filter(row => (!date || row.day === date) && (!group || row.record[dimension] === group));
  const pages = Math.max(1, Math.ceil(detail.length / pageSize));
  const activePage = Math.min(page, pages - 1);
  const activeMetric = metrics.find(item => item.id === metric);
  const resetDetail = () => { setDate(undefined); setGroup(undefined); setPage(0); };
  const applyFilter = (key: keyof typeof all, value: string) => {
    setFilters(currentFilters => ({ ...currentFilters, [key]: value }));
    resetDetail();
  };
  const exportDisabled = loading || Boolean(error) || !validPeriod || !detail.length || Boolean(exporting);
  const exportData = (format: Format) => onExport(format, {
    ids: detail.map(({ record }) => record.id), start, end, metric, selectedDate: date, dimension, group,
  }, filters);

  return <div className="mop-report-dashboard">
    <Card className="mop-report-card mop-report-toolbar">
      <div className="mop-report-toolbar-top">
        <div className="mop-report-toggle" role="group" aria-label="Período do dashboard">
          {Object.entries(periods).map(([key, label]) => <Button key={key} type="button" size="sm"
            variant={period === key ? "secondary" : "ghost"} aria-pressed={period === key}
            onClick={() => { setPeriod(key as keyof typeof periods); resetDetail(); }}>{label}</Button>)}
        </div>
        {canExport && <DropdownMenu><DropdownMenuTrigger asChild>
          <Button type="button" size="sm" className="mop-report-export" disabled={exportDisabled}>
            <FileDown/>{exporting ? "Gerando arquivo…" : "Exportar"}<ChevronDown/>
          </Button>
        </DropdownMenuTrigger><DropdownMenuContent className="mop-report-menu" align="end">
          <DropdownMenuItem onSelect={() => exportData("pdf")}><FileDown size={16}/>Exportar PDF</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportData("xlsx")}><FileSpreadsheet size={16}/>Exportar Excel</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>}
      </div>
      {period === "custom" && <div className="mop-report-dates">
        <label>Data inicial<Input type="date" value={custom.start} max={today} onChange={event => { setCustom({ ...custom, start: event.target.value }); resetDetail(); }}/></label>
        <label>Data final<Input type="date" value={custom.end} min={custom.start} max={today} onChange={event => { setCustom({ ...custom, end: event.target.value }); resetDetail(); }}/></label>
      </div>}
      <div className="rep104-filters">
        <RecordFilterDropdown label="Condomínio" value={filters.condo} options={options(records.map(row => row.condo), all.condo)} onChange={value => applyFilter("condo", value)}/>
        <RecordFilterDropdown label="Categoria" value={filters.category} options={options(records.map(row => row.category), all.category)} onChange={value => applyFilter("category", value)}/>
        <RecordFilterDropdown label="Status" value={filters.status} options={[all.status, "Pendente", "Em andamento", "Concluído"]} onChange={value => applyFilter("status", value)}/>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters(all); setMetric("created"); setPeriod("month"); resetDetail(); }}>Limpar filtros</Button>
      </div>
      {validPeriod && <p className="mop-report-note">Registros criados de {start.split("-").reverse().join("/")} a {end.split("-").reverse().join("/")} · horário de Brasília</p>}
    </Card>

    {!validPeriod ? <p role="status" className="mop-report-state">Selecione um intervalo de 1 a 366 dias, com data final até hoje.</p>
      : loading ? <p role="status" className="mop-report-state">Atualizando indicadores…</p>
      : error ? <p role="status" className="mop-report-state">Indicadores indisponíveis. Atualize os dados para consultar o recorte.</p>
      : <>
        <div className="mop-report-metrics" role="group" aria-label="Indicadores do recorte">
          {metrics.map(({ id, label, icon: Icon }, index) => <Card key={id} className="mop-report-card">
            <Button type="button" variant="ghost" className={"mop-report-metric " + id} aria-pressed={metric === id}
              onClick={() => { setMetric(id); resetDetail(); }}><span>{label}<Icon size={18}/></span><strong>{countFormat.format(metricsCount[index])}</strong></Button>
          </Card>)}
        </div>
        <Suspense fallback={<p role="status" className="mop-report-state">Carregando gráficos…</p>}>
          <Charts trend={trend} distribution={distribution} dimension={dimension} setDimension={value => { setDimension(value); setGroup(undefined); setPage(0); }}
            selectedDate={date} selectedGroup={group} onDate={value => { setDate(value && value !== date ? value : undefined); setPage(0); }}
            onGroup={value => { setGroup(value === group ? undefined : value); setPage(0); }}/>
        </Suspense>
        <Card className="mop-report-card">
          <CardHeader className="mop-report-detail-head"><div><h2>Registros do recorte</h2>
            <p role="status">{activeMetric.label} · {countFormat.format(detail.length)} registro(s){date ? " · " + shortDay(date) : ""}{group ? " · " + group : ""}</p></div>
            {(date || group) && <Button type="button" variant="outline" size="sm" onClick={resetDetail}>Limpar seleção dos gráficos</Button>}
          </CardHeader>
          <CardContent>
            <div className="rep104-table-wrap"><table><thead><tr>
              <th scope="col">Protocolo</th><th scope="col">Registro</th><th scope="col">Condomínio</th><th scope="col">Prioridade</th><th scope="col">Prazo</th><th scope="col">Status</th><th scope="col">Criado em</th>
            </tr></thead><tbody>{detail.slice(activePage * pageSize, (activePage + 1) * pageSize).map(({ record }) => <tr key={record.id}>
              <td><Button type="button" variant="link" size="sm" onClick={() => onOpenRecord(record.id)}>{record.id}</Button></td><td>{record.title}</td><td>{record.condo}</td>
              <td>{record.priority || "—"}</td><td>{formatDate(record.deadline)}</td><td>{record.status}</td><td>{formatDate(record.occurredAt)}</td>
            </tr>)}{!detail.length && <tr><td colSpan={7}>Nenhum registro neste recorte.</td></tr>}</tbody></table></div>
            {pages > 1 && <div className="mop-report-pagination">
              <span>Página {activePage + 1} de {pages}</span>
              <Button type="button" size="sm" variant="outline" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Anterior</Button>
              <Button type="button" size="sm" variant="outline" disabled={activePage === pages - 1} onClick={() => setPage(activePage + 1)}>Próxima</Button>
            </div>}
          </CardContent>
        </Card>
        <p className="mop-report-note">Status e vencimentos refletem a situação atual dos registros criados em cada período. O vencimento considera o prazo informado no registro.</p>
      </>}
  </div>;
}
