export type RecordPeriod = 'Todos os períodos' | 'Hoje' | 'Últimos 7 dias' | 'Últimos 30 dias';
export type RecordQueryItem = {
  id: string; title: string; description: string; author: string; condo: string;
  category: string; status: string; occurredAt: string;
};
export type RecordFilters = {
  query: string; period: RecordPeriod; category: string; status: string;
  condo: string; author: string;
};
export const emptyRecordFilters: RecordFilters = {
  query: '', period: 'Todos os períodos', category: 'Todas as categorias',
  status: 'Todos os status', condo: 'Todos os condomínios', author: 'Todos os responsáveis',
};
export function normalizeRecordText(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function recordDay(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(date);
}
export function filterOperationalRecords<T extends RecordQueryItem>(
  records: readonly T[], filters: RecordFilters, now = Date.now(),
): T[] {
  const query = normalizeRecordText(filters.query).trim();
  return records.filter(record => {
    if (query && !normalizeRecordText([record.id, record.title, record.description, record.condo, record.author].join(' ')).includes(query)) return false;
    if (filters.category !== emptyRecordFilters.category && record.category !== filters.category) return false;
    if (filters.status !== emptyRecordFilters.status && record.status !== filters.status) return false;
    if (filters.condo !== emptyRecordFilters.condo && record.condo !== filters.condo) return false;
    if (filters.author !== emptyRecordFilters.author && record.author !== filters.author) return false;
    if (filters.period === 'Todos os períodos') return true;
    const occurredAt = Date.parse(record.occurredAt);
    if (!Number.isFinite(occurredAt) || occurredAt > now) return false;
    if (filters.period === 'Hoje') return recordDay(occurredAt) === recordDay(now);
    return occurredAt >= now - (filters.period === 'Últimos 7 dias' ? 7 : 30) * 86400000;
  });
}
export function recordDateTime(value: string, compact = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', ...(compact ? {} : { year: 'numeric' }),
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(date);
}
