const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterOperationalRecords, emptyRecordFilters, recordDay, recordDateTime } = require('../ui-next/src/components/records1097/recordQuery.ts');
const item = (id, overrides = {}) => ({
  id, title: 'Inspeção do perímetro', description: 'Verificação concluída',
  author: 'João Silva', condo: 'Condomínio Alpha', category: 'Segurança', status: 'Concluído',
  occurredAt: '2026-11-25T03:30:00.000Z', ...overrides,
});
const now = Date.parse('2026-11-25T04:00:00.000Z');
test('search is accent-insensitive and includes responsible person', () => {
  const records = [item('A'), item('B', { author: 'Maria', title: 'Backup' })];
  assert.deepEqual(filterOperationalRecords(records, { ...emptyRecordFilters, query: 'joao silva' }, now).map(row => row.id), ['A']);
  assert.deepEqual(filterOperationalRecords(records, { ...emptyRecordFilters, query: 'INSPECAO' }, now).map(row => row.id), ['A']);
});
test('condominium, responsible person, status and text filters combine without mutating input', () => {
  const records = [item('A'), item('B', { condo: 'Beta' }), item('C', { author: 'Maria' }), item('D', { status: 'Pendente' })];
  const original = JSON.stringify(records);
  const result = filterOperationalRecords(records, {
    ...emptyRecordFilters, condo: 'Condomínio Alpha', author: 'João Silva', status: 'Concluído', query: 'perimetro',
  }, now);
  assert.deepEqual(result.map(row => row.id), ['A']);
  assert.equal(JSON.stringify(records), original);
});
test('Today uses Sao Paulo day boundaries rather than the ISO UTC date', () => {
  const records = [
    item('yesterday', { occurredAt: '2026-11-25T01:30:00.000Z' }),
    item('today', { occurredAt: '2026-11-25T03:30:00.000Z' }),
    item('future', { occurredAt: '2026-11-25T05:00:00.000Z' }),
  ];
  assert.equal(recordDay(records[0].occurredAt), '2026-11-24');
  assert.deepEqual(filterOperationalRecords(records, { ...emptyRecordFilters, period: 'Hoje' }, now).map(row => row.id), ['today']);
});
test('rolling seven-day filter includes its boundary and excludes future or invalid timestamps', () => {
  const boundary = now - 7 * 86400000;
  const records = [
    item('boundary', { occurredAt: new Date(boundary).toISOString() }),
    item('older', { occurredAt: new Date(boundary - 1).toISOString() }),
    item('future', { occurredAt: new Date(now + 1).toISOString() }),
    item('invalid', { occurredAt: 'not-a-date' }),
  ];
  assert.deepEqual(filterOperationalRecords(records, { ...emptyRecordFilters, period: 'Últimos 7 dias' }, now).map(row => row.id), ['boundary']);
});
test('all-period view keeps authorized records with missing dates and formats them safely', () => {
  const records = [item('A', { occurredAt: '' })];
  assert.deepEqual(filterOperationalRecords(records, emptyRecordFilters, now), records);
  assert.equal(recordDateTime(''), 'Data não informada');
  assert.equal(recordDateTime('invalid'), 'Data não informada');
});
test('empty authorized source stays empty regardless of filters', () => {
  assert.deepEqual(filterOperationalRecords([], { ...emptyRecordFilters, query: 'all' }, now), []);
});
