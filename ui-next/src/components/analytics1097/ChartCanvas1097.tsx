import React, { useId } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DailyPoint1097, RoutineSummary1097 } from "./analytics-data";

type Props =
  | { kind: "timeline"; points: DailyPoint1097[]; label: string }
  | { kind: "routines"; summary: RoutineSummary1097 }
  | { kind: "comparison"; items: Array<{ label: string; current: number; previous: number }> };

function ChartTooltip1097({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return <div className="mop-chart1097-tooltip">
    {label !== undefined && <strong>{String(label)}</strong>}
    {payload.map((entry, index) => <div key={index}><span className="mop-chart1097-dot" style={{ background: entry.color || "#57c4ed" }}/><span>{entry.name}</span><b>{entry.value}</b></div>)}
  </div>;
}
export default function ChartCanvas1097(props: Props) {
  const gradient = "mop-chart1097-" + useId().replace(/[^a-z0-9]/gi, "");
  if (props.kind === "routines") {
    const values = [
      { name: "Concluídas", value: props.summary.completed, color: "#65d6ae" },
      { name: "Aguardando", value: props.summary.pending, color: "#e8b468" },
    ];
    return <div className="mop-chart1097-donut" role="img" aria-label={props.summary.completed + " de " + props.summary.total + " rotinas concluídas"}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart accessibilityLayer>
          <Pie data={values} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="63%" outerRadius="87%" startAngle={90} endAngle={-270} stroke="#0b2940" strokeWidth={3} isAnimationActive={false}>
            {values.map(value => <Cell key={value.name} fill={value.color}/>)}
          </Pie>
          <Tooltip content={<ChartTooltip1097/>}/>
        </PieChart>
      </ResponsiveContainer>
      <div className="mop-chart1097-donut-label" aria-hidden="true"><strong>{props.summary.percent}%</strong><span>concluído</span></div>
    </div>;
  }
  if (props.kind === "comparison") {
    return <div className="mop-chart1097-canvas" style={{ height: Math.max(250, props.items.length * 52 + 55) }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={props.items} layout="vertical" accessibilityLayer margin={{ top: 6, right: 16, left: 0, bottom: 6 }} barGap={3}>
          <CartesianGrid stroke="#28546c" strokeDasharray="3 4" horizontal={false}/>
          <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--report-muted, #c8dfed)", fontSize: 11 }} axisLine={false} tickLine={false}/>
          <YAxis dataKey="label" type="category" width={110} tick={{ fill: "var(--report-muted, #c8dfed)", fontSize: 11 }} tickFormatter={value => String(value).length > 17 ? String(value).slice(0, 16) + "…" : value} axisLine={false} tickLine={false}/>
          <Tooltip content={<ChartTooltip1097/>} cursor={{ fill: "#1c587333" }}/>
          <Legend wrapperStyle={{ color: "var(--report-muted, #c8dfed)", fontSize: 11 }}/>
          <Bar dataKey="current" name="Período atual" fill="var(--report-current, #73dcfa)" radius={[0, 4, 4, 0]} maxBarSize={15} isAnimationActive={false}/>
          <Bar dataKey="previous" name="Período anterior" fill="var(--report-previous, #ffcd72)" radius={[0, 4, 4, 0]} maxBarSize={15} isAnimationActive={false}/>
        </BarChart>
      </ResponsiveContainer>
    </div>;
  }
  return <div className="mop-chart1097-canvas">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={props.points} accessibilityLayer margin={{ top: 12, right: 16, left: -14, bottom: 6 }}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--report-current, #73dcfa)" stopOpacity={0.35}/><stop offset="100%" stopColor="#4cc2ef" stopOpacity={0.01}/></linearGradient></defs>
        <CartesianGrid stroke="#28546c" strokeDasharray="3 4" vertical={false}/>
        <XAxis dataKey="label" tick={{ fill: "var(--report-muted, #c8dfed)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24}/>
        <YAxis allowDecimals={false} tick={{ fill: "var(--report-muted, #c8dfed)", fontSize: 10 }} axisLine={false} tickLine={false} width={42}/>
        <Tooltip content={<ChartTooltip1097/>} cursor={{ stroke: "#70cfef", strokeDasharray: "3 4" }}/>
        <Area type="linear" dataKey="count" name={props.label} stroke="var(--report-current, #73dcfa)" fill={"url(#" + gradient + ")"} strokeWidth={2.5} dot={props.points.length <= 7 ? { r: 3, fill: "var(--report-current, #73dcfa)", stroke: "#0b2940", strokeWidth: 2 } : false} activeDot={{ r: 5 }} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
