import React, { useId, useMemo, useState } from "react";
import { Activity, ClipboardCheck, Info } from "lucide-react";
import LazyChart1097 from "./LazyChart1097";
import {
  buildOccurrenceSeries1097, summarizeRoutines1097,
  type OccurrenceInput1097, type RoutineSnapshot1097,
} from "./analytics-data";
import "../../analytics1097.css";

export type OverviewCharts1097Props = {
  records: readonly OccurrenceInput1097[];
  routines: RoutineSnapshot1097 | null;
  loading?: boolean;
  error?: string;
  routineLoading?: boolean;
  routineError?: string;
  canViewRoutines?: boolean;
  demo?: boolean;
  accepted?: boolean;
  now?: Date;
  onOpenRoutines?: () => void;
};
const dateLabel = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
export default function OverviewCharts1097({
  records, routines, loading = false, error = "", routineLoading = false, routineError = "",
  canViewRoutines = true, demo = false, accepted = true, now = new Date(), onOpenRoutines,
}: OverviewCharts1097Props) {
  const [days, setDays] = useState<7 | 30>(7);
  const id = useId();
  const series = useMemo(() => buildOccurrenceSeries1097(records, days, now), [records, days, now.getTime()]);
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const routineSummary = useMemo(() => routines ? summarizeRoutines1097(routines) : null, [routines]);
  const unavailable = demo
    ? "Indicadores reais ficam disponíveis ao entrar com uma conta operacional."
    : !accepted ? "Os indicadores ficam disponíveis após a preparação do acesso operacional." : "";
  return <section className="mop-overview1097" aria-labelledby={id + "-heading"}>
    <div className="mop-overview1097-heading"><div><span className="mop-overview1097-eyebrow">ACOMPANHAMENTO</span><h2 id={id + "-heading"}>Panorama operacional</h2></div><span>Dados do seu escopo autorizado</span></div>
    {unavailable ? <div className="mop-chart1097-unavailable" role="status"><Info size={18}/>{unavailable}</div> : <div className="mop-overview1097-grid">
      <section className="mop-chart1097-panel" aria-labelledby={id + "-occurrences"}>
        <header><div className="mop-chart1097-title"><span className="mop-chart1097-icon"><Activity size={18}/></span><div><h3 id={id + "-occurrences"}>Ocorrências por dia</h3><p>Registros fora da categoria Rotina</p></div></div>
          <div className="mop-chart1097-period" role="group" aria-label="Período das ocorrências">{([7, 30] as const).map(value => <button type="button" key={value} onClick={() => setDays(value)} aria-pressed={days === value}>{value} dias</button>)}</div>
        </header>
        {loading ? <div className="mop-chart1097-state" role="status">Atualizando ocorrências…</div> : error ? <div className="mop-chart1097-state is-error" role="status">Não foi possível atualizar os registros. Tente atualizar os dados do Início.</div> : <>
          <div className="mop-chart1097-stat"><strong>{total.toLocaleString("pt-BR")}</strong><span>ocorrência{total === 1 ? "" : "s"} no período</span><small>inclui o dia de hoje</small></div>
          {total > 0 ? <LazyChart1097 kind="timeline" points={series} label="Ocorrências"/> : <div className="mop-chart1097-state"><Activity size={23}/><strong>Nenhuma ocorrência neste período</strong><span>Os registros autorizados aparecerão neste gráfico.</span></div>}
          <details className="mop-chart1097-details"><summary>Ver valores por dia</summary><div><table><caption>Ocorrências por data em São Paulo</caption><thead><tr><th scope="col">Data</th><th scope="col">Ocorrências</th></tr></thead><tbody>{series.map(point => <tr key={point.key}><th scope="row">{dateLabel(point.key)}</th><td>{point.count}</td></tr>)}</tbody></table></div></details>
          <p className="mop-chart1097-note">Contagem pela data de criação dos registros disponíveis, no fuso de São Paulo.</p>
        </>}
      </section>
      <section className="mop-chart1097-panel" aria-labelledby={id + "-routines"}>
        <header><div className="mop-chart1097-title"><span className="mop-chart1097-icon is-green"><ClipboardCheck size={18}/></span><div><h3 id={id + "-routines"}>Rotinas do período</h3><p>{routines ? dateLabel(routines.date) + (routines.period ? " · " + routines.period : "") : "Execução prevista no período atual"}</p></div></div>{canViewRoutines && onOpenRoutines && <button type="button" className="mop-chart1097-link" onClick={onOpenRoutines}>Ver rotinas</button>}</header>
        {!canViewRoutines ? <div className="mop-chart1097-state" role="status">Indicadores de rotinas indisponíveis para este perfil.</div> : routineLoading && !routineSummary ? <div className="mop-chart1097-state" role="status">Atualizando rotinas…</div> : routineError || !routineSummary ? <div className="mop-chart1097-state is-error" role="status">Rotinas indisponíveis nesta consulta. Abra Checklists e Rotinas para conferir.</div> : routineSummary.total === 0 ? <div className="mop-chart1097-state"><ClipboardCheck size={25}/><strong>Nenhuma rotina prevista</strong><span>Não há tarefas agendadas para este período no seu escopo.</span></div> : <>
          <div className="mop-chart1097-routines"><LazyChart1097 kind="routines" summary={routineSummary}/><div className="mop-chart1097-routine-values">
            <div><span><i className="is-green"/> Concluídas</span><strong>{routineSummary.completed}</strong></div>
            <div><span><i className="is-amber"/> Aguardando</span><strong>{routineSummary.pending}</strong></div>
            <div className="mop-chart1097-total"><span>Previstas</span><strong>{routineSummary.total}</strong></div>
          </div></div>
          <p className="mop-chart1097-summary">{routineSummary.completed} de {routineSummary.total} rotinas concluídas <span>· {routineSummary.percent}%</span></p>
          <p className="mop-chart1097-note">Cada rotina é contada uma vez. Este resumo considera o dia e o período consultados, independentemente do filtro de ocorrências.</p>
        </>}
      </section>
    </div>}
  </section>;
}
