import type { ComponentProps } from "react"
import { ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "cn"

function ChartContainer({ className, children, ...props }: ComponentProps<"div"> & Pick<ComponentProps<typeof ResponsiveContainer>, "children">) {
  return <div data-slot="chart" className={cn("min-w-0 text-xs", className)} {...props}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>{children}</ResponsiveContainer>
  </div>
}

const ChartTooltip = Tooltip

function ChartTooltipContent({ active, label, payload }: {
  active?: boolean
  label?: string | number
  payload?: Array<{ dataKey?: string | number; name?: string | number; value?: number | string; color?: string }>
}) {
  if (!active || !payload?.length) return null
  return <div data-slot="chart-tooltip" className="mop-report-tooltip">
    {label !== undefined && <strong>{label}</strong>}
    {payload.map(item => <div key={item.dataKey}>
      <span aria-hidden="true" style={{ backgroundColor: item.color }}/>
      {item.name}<strong>{item.value}</strong>
    </div>)}
  </div>
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
