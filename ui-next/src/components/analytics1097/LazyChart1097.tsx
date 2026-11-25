import React, { lazy, Suspense, type ReactNode } from "react";
const Canvas = lazy(() => import("./ChartCanvas1097"));
class ChartBoundary1097 extends React.Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="mop-chart1097-state" role="status">O gráfico não pôde ser exibido. Consulte os valores abaixo.</p>
      : this.props.children;
  }
}
export default function LazyChart1097(props: React.ComponentProps<typeof Canvas>) {
  return <ChartBoundary1097><Suspense fallback={<div className="mop-chart1097-state" role="status">Preparando gráfico…</div>}><Canvas {...props}/></Suspense></ChartBoundary1097>;
}
