import React from "react";
import { BarChart3, Clock3 } from "lucide-react";
import LazyChart1097 from "./LazyChart1097";
import "../../analytics1097.css";
type Props = {
  comparison: Array<{label: string; current: number; previous: number}>;
  series: Array<{start: string; count: number}>;
};
const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "2-digit", day: "2-digit" });
export default function ComparativeCharts1097({comparison, series}: Props) {
  const points = series.map(point => ({key: point.start, label: time.format(new Date(point.start)), count: point.count}));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return <div className="rep104-chart-grid mop-comparative1097">
    <section className="rep104-panel"><h2><BarChart3 size={17}/> Comparativo por categoria</h2>
      {comparison.length ? <><LazyChart1097 kind="comparison" items={comparison}/>
        <details className="mop-chart1097-details"><summary>Ver valores por categoria</summary><div><table><caption>Registros criados nos períodos comparados</caption><thead><tr><th scope="col">Categoria</th><th scope="col">Atual</th><th scope="col">Anterior</th></tr></thead><tbody>{comparison.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.current}</td><td>{item.previous}</td></tr>)}</tbody></table></div></details>
      </> : <p className="rep104-no-data">Nenhum registro nos períodos comparados.</p>}
    </section>
    <section className="rep104-panel"><h2><Clock3 size={17}/> Distribuição diária de registros</h2>
      {total > 0 ? <LazyChart1097 kind="timeline" points={points} label="Registros"/> : <p className="rep104-no-data">Nenhum registro no período atual.</p>}
      <details className="mop-chart1097-details"><summary>Ver valores por intervalo</summary><div><table><caption>Intervalos consecutivos de 24 horas</caption><thead><tr><th scope="col">Início do intervalo</th><th scope="col">Registros</th></tr></thead><tbody>{series.map(point => <tr key={point.start}><th scope="row">{new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short"}).format(new Date(point.start))}</th><td>{point.count}</td></tr>)}</tbody></table></div></details>
      <p className="rep104-note">As datas consideram intervalos consecutivos de 24 horas, relativos à consulta.</p>
    </section>
  </div>;
}
