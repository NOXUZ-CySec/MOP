import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type TrendPoint = { label: string; key: string; current: number; previous: number };
export type DistributionItem = { label: string; count: number };

type Props = {
  trend: TrendPoint[];
  distribution: DistributionItem[];
  dimension: "condo" | "category";
  setDimension: (value: "condo" | "category") => void;
  selectedDate?: string;
  selectedGroup?: string;
  onDate: (key: string) => void;
  onGroup: (label: string) => void;
};

export default function DashboardCharts({ trend, distribution, dimension, setDimension, selectedDate, selectedGroup, onDate, onGroup }: Props) {
  const gradient = useId().replace(/[^a-z0-9]/gi, "");
  const max = Math.max(1, ...distribution.map(item => item.count));
  const selectedPoint = trend.find(point => point.key === selectedDate);
  return <div className="mop-report-charts">
    <Card className="mop-report-card">
      <CardHeader><h2>Evolução diária</h2><div className="mop-report-legend"><span>Período atual</span><span>Período anterior</span></div></CardHeader>
      <CardContent>
        <ChartContainer className="mop-report-plot">
            <AreaChart data={trend} accessibilityLayer margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              onClick={state => { const point = trend[Number(state.activeTooltipIndex)]; if (point) onDate(point.key); }}>
              <defs><linearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%"><stop stopColor="var(--report-current)" stopOpacity={0.32}/><stop offset="100%" stopColor="var(--report-current)" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--report-line)" strokeDasharray="3 4"/>
              <XAxis dataKey="key" tickFormatter={value => trend.find(point => point.key === value)?.label || value} tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "var(--report-muted)", fontSize: 11 }}/>
              <YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} tick={{ fill: "var(--report-muted)", fontSize: 11 }}/>
              <ChartTooltip content={<ChartTooltipContent/>}/>
              {selectedPoint && <ReferenceLine x={selectedPoint.key} stroke="var(--report-current)" strokeDasharray="4 4"/>}
              <Area type="linear" dataKey="previous" name="Período anterior" stroke="var(--report-previous)" fill="none" strokeDasharray="5 4" isAnimationActive={false}/>
              <Area type="linear" dataKey="current" name="Período atual" stroke="var(--report-current)" fill={"url(#" + gradient + ")"} strokeWidth={2} dot={trend.length === 1} isAnimationActive={false}/>
            </AreaChart>
          </ChartContainer>
        <label className="mop-report-date">Detalhar dia
          <select value={selectedDate ?? ""} onChange={event => onDate(event.target.value)}>
            <option value="">Todos os dias</option>
            {trend.map(point => <option key={point.key} value={point.key}>{point.label} · {point.current}</option>)}
          </select>
        </label>
        {trend.length > 0 && <p className="mop-report-note">Comparação com os mesmos dias consecutivos imediatamente anteriores.</p>}
      </CardContent>
    </Card>
    <Card className="mop-report-card">
      <CardHeader><h2>Distribuição</h2><div className="mop-report-toggle" role="group" aria-label="Agrupar distribuição">
        <Button type="button" size="sm" variant={dimension === "condo" ? "secondary" : "ghost"} aria-pressed={dimension === "condo"} onClick={() => setDimension("condo")}>Condomínio</Button>
        <Button type="button" size="sm" variant={dimension === "category" ? "secondary" : "ghost"} aria-pressed={dimension === "category"} onClick={() => setDimension("category")}>Categoria</Button>
      </div></CardHeader>
      <CardContent className="mop-report-distribution">
        {distribution.length ? distribution.map(item => <button type="button" key={item.label} aria-pressed={selectedGroup === item.label}
          onClick={() => onGroup(item.label)} className="mop-report-bar">
          <span>{item.label}</span><strong>{item.count}</strong>
          <span className="mop-report-bar-track" aria-hidden="true"><i style={{ width: item.count / max * 100 + "%" }}/></span>
        </button>) : <p className="mop-report-note">Nenhum registro neste recorte.</p>}
      </CardContent>
    </Card>
  </div>;
}
