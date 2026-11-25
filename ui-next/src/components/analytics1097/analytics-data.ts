export type OccurrenceInput1097 = { id?: string; category: string; occurredAt: string };
export type DailyPoint1097 = { key: string; label: string; count: number };
export type RoutineSnapshot1097 = {
  date: string; scope: string; period?: string;
  tasks: Array<{ id: string; done: boolean }>;
};
export type RoutineSummary1097 = { total: number; completed: number; pending: number; percent: number | null };
const day = 86400000;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
export function saoPauloDate1097(date: Date): string {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function buildOccurrenceSeries1097(
  records: readonly OccurrenceInput1097[], days: 7 | 30, now = new Date(),
): DailyPoint1097[] {
  const today = saoPauloDate1097(now);
  const anchor = Date.parse(today + "T12:00:00Z");
  const points = Array.from({ length: days }, (_, index) => {
    const key = new Date(anchor - (days - index - 1) * day).toISOString().slice(0, 10);
    return { key, label: key.slice(8) + "/" + key.slice(5, 7), count: 0 };
  });
  const counts = new Map(points.map(point => [point.key, point]));
  for (const record of records) {
    if (String(record.category || "").trim().toLocaleLowerCase("pt-BR") === "rotina") continue;
    const parsed = new Date(record.occurredAt);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > now.getTime()) continue;
    const point = counts.get(saoPauloDate1097(parsed));
    if (point) point.count += 1;
  }
  return points;
}
export function summarizeRoutines1097(snapshot: RoutineSnapshot1097): RoutineSummary1097 {
  const tasks = new Map<string, boolean>();
  for (const task of snapshot.tasks) {
    const id = String(task.id || "");
    if (!id) continue;
    tasks.set(id, tasks.get(id) === true || task.done === true);
  }
  const total = tasks.size;
  const completed = [...tasks.values()].filter(Boolean).length;
  return { total, completed, pending: total - completed, percent: total ? Math.round(completed * 100 / total) : null };
}
