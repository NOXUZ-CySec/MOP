import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  columnVisibilityFeature, createColumnHelper, createPaginatedRowModel, createSortedRowModel,
  rowPaginationFeature, rowSelectionFeature, rowSortingFeature, tableFeatures, useTable,
  type ColumnVisibilityState, type PaginationState, type SortingState,
} from '@tanstack/react-table';
import { DropdownMenu } from 'radix-ui';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Columns3, FileText, LoaderCircle, RotateCcw } from 'lucide-react';
import type { OperationalRecord } from '../../RecordsPage';
import { recordDateTime } from './recordQuery';
import '../../records1097.css';

export const recordsTableFeatures = tableFeatures({
  columnVisibilityFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});
const columnHelper = createColumnHelper<typeof recordsTableFeatures, OperationalRecord>();
const textCompare = (a: unknown, b: unknown) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
const labels: Record<string, string> = {
  id: 'Protocolo', title: 'Registro', category: 'Categoria', status: 'Status',
  occurredAt: 'Data / Hora', condo: 'Condomínio', author: 'Responsável', priority: 'Prioridade',
};
const defaultVisibility = { id: false, condo: false, author: false, priority: false };
const columns = columnHelper.columns([
  columnHelper.accessor('id', { header: 'Protocolo', sortFn: (a, b) => textCompare(a.original.id, b.original.id) }),
  columnHelper.accessor('title', {
    header: 'Registro', enableHiding: false, sortFn: (a, b) => textCompare(a.original.title, b.original.title),
  }),
  columnHelper.accessor('category', { header: 'Categoria', sortFn: (a, b) => textCompare(a.original.category, b.original.category) }),
  columnHelper.accessor('status', { header: 'Status', sortFn: (a, b) => textCompare(a.original.status, b.original.status) }),
  columnHelper.accessor('occurredAt', {
    header: 'Data / Hora', sortDescFirst: true,
    sortFn: (a, b) => (Date.parse(a.original.occurredAt) || 0) - (Date.parse(b.original.occurredAt) || 0),
  }),
  columnHelper.accessor('condo', { header: 'Condomínio', sortFn: (a, b) => textCompare(a.original.condo, b.original.condo) }),
  columnHelper.accessor('author', { header: 'Responsável', sortFn: (a, b) => textCompare(a.original.author, b.original.author) }),
  columnHelper.accessor('priority', {
    header: 'Prioridade', sortFn: (a, b) => textCompare(a.original.priority, b.original.priority),
    cell: ({ row }) => row.original.priority || 'Não informada',
  }),
]);

export type RecordsTable1097Props = {
  data: OperationalRecord[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  resetKey?: string;
  revealRecordId?: string | null;
  revealToken?: number;
  totalRecords?: number;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function RecordsTable1097({
  data, selectedId, onSelect, resetKey = '', revealRecordId, revealToken = 0,
  totalRecords = data.length, hasFilters = false, onClearFilters, loading = false, error = '', onRetry,
}: RecordsTable1097Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'occurredAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(defaultVisibility);
  const rowSelection = useMemo<Record<string, true>>(() => selectedId ? { [selectedId]: true as const } : {}, [selectedId]);
  const table = useTable({
    features: recordsTableFeatures, data, columns, getRowId: row => row.id,
    state: { sorting, pagination, columnVisibility, rowSelection },
    enableMultiRowSelection: false, enableMultiSort: false, enableSortingRemoval: false,
    autoResetPageIndex: false,
    onSortingChange: updater => {
      setSorting(updater);
      setPagination(previous => ({ ...previous, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
  });
  const requestRef = useRef('');
  useEffect(() => { setPagination(previous => ({ ...previous, pageIndex: 0 })); }, [resetKey]);
  useEffect(() => {
    const max = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1);
    setPagination(previous => previous.pageIndex > max ? { ...previous, pageIndex: max } : previous);
  }, [data.length, pagination.pageSize]);
  useEffect(() => {
    const request = revealRecordId + ':' + revealToken;
    if (!revealRecordId || requestRef.current === request) return;
    const index = table.getSortedRowModel().rows.findIndex(row => row.id === revealRecordId);
    if (index < 0) return;
    requestRef.current = request;
    setPagination(previous => ({ ...previous, pageIndex: Math.floor(index / previous.pageSize) }));
  }, [revealRecordId, revealToken, data, table]);

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(1, table.getPageCount());
  const start = data.length ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const end = Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.length);
  const caption = hasFilters ? data.length + ' de ' + totalRecords + ' registros' : data.length + ' registros';
  const activate = (id: string) => onSelect(id);

  return <section className="records-list records1097" aria-label="Lista de registros" aria-busy={loading}>
    <div className="records1097-toolbar">
      <div className="records1097-result"><FileText size={16} /><strong>{caption}</strong><span>Selecione para ver os detalhes</span></div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="records1097-control" aria-label="Escolher colunas">
          <Columns3 size={15} /> Colunas
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="records1097-menu" align="end" sideOffset={7} collisionPadding={12}
            onEscapeKeyDown={event => event.stopPropagation()}>
            <DropdownMenu.Label className="records1097-menu-label">Colunas visíveis</DropdownMenu.Label>
            {table.getAllLeafColumns().map(column => <DropdownMenu.CheckboxItem
              key={column.id} className="records1097-menu-item" checked={column.getIsVisible()}
              disabled={!column.getCanHide()} onCheckedChange={checked => column.toggleVisibility(checked === true)}
              onSelect={event => event.preventDefault()}>
              <span className="records1097-menu-check"><DropdownMenu.ItemIndicator><Check size={14} /></DropdownMenu.ItemIndicator></span>
              {labels[column.id]}
            </DropdownMenu.CheckboxItem>)}
            <DropdownMenu.Separator className="records1097-menu-separator" />
            <DropdownMenu.Item className="records1097-menu-item" onSelect={() => setColumnVisibility({ ...defaultVisibility })}>
              <RotateCcw size={14} /> Restaurar colunas
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <label className="records1097-mobile-sort">Ordenar<select aria-label="Ordenação dos registros"
        value={(sorting[0]?.id || 'occurredAt') + ':' + (sorting[0]?.desc ? 'desc' : 'asc')}
        onChange={event => {
          const [id, direction] = event.target.value.split(':');
          setSorting([{ id, desc: direction === 'desc' }]);
          setPagination(previous => ({ ...previous, pageIndex: 0 }));
        }}>
        {Object.entries(labels).flatMap(([id, label]) => ['asc', 'desc'].map(direction => <option key={id + direction} value={id + ':' + direction}>
          {label} — {id === 'occurredAt' ? direction === 'desc' ? 'mais recentes' : 'mais antigos' : direction === 'desc' ? 'decrescente' : 'crescente'}
        </option>))}
      </select></label>
    </div>
    {error && <div className="records1097-error" role="alert"><span>{error}</span>{onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}</div>}
    <div className="records1097-scroll" tabIndex={0} role="region" aria-label="Tabela de registros; use as setas para rolar quando necessário">
      <table className="records1097-table">
        <caption className="records1097-sr-only">Registros operacionais autorizados. Ordene pelas colunas ou abra um registro para consultar os detalhes.</caption>
        <thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => {
          const direction = header.column.getIsSorted();
          const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
          return <th key={header.id} scope="col" className={'records1097-col-' + header.column.id}
            aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
            <button type="button" className="records1097-sort" onClick={header.column.getToggleSortingHandler()}
              aria-label={'Ordenar por ' + labels[header.column.id]} title={direction === 'asc' ? 'Ordem crescente' : direction === 'desc' ? 'Ordem decrescente' : 'Ordenar coluna'}>
              {labels[header.column.id]}<Icon size={13} aria-hidden="true" />
            </button>
          </th>;
        })}</tr>)}</thead>
        <tbody>{rows.map(row => <tr key={row.id} data-record-row={row.id} data-selected={row.getIsSelected() || undefined} onClick={() => activate(row.id)}>
          {row.getVisibleCells().map(cell => {
            const record = row.original;
            const Icon = record.icon || FileText;
            const id = cell.column.id;
            return <td key={cell.id} data-label={labels[id]} className={'records1097-col-' + id}>
              {id !== 'title' && <span className="records1097-cell-label">{labels[id]}</span>}
              {id === 'title' ? <button type="button" className="records1097-open" data-record-id={record.id}
                aria-pressed={row.getIsSelected()} aria-label={'Abrir registro ' + record.id + ': ' + record.title}
                onClick={event => { event.stopPropagation(); activate(record.id); }}>
                <span className={'records-row-icon ' + record.status.replaceAll(' ', '-')}><Icon size={17} /></span>
                <span className="records1097-title"><small>#{record.id}</small><strong>{record.title}</strong><span>{record.description}</span></span>
              </button> : id === 'status' ? <span className={'records-status ' + record.status.replaceAll(' ', '-')}>{record.status}</span>
              : id === 'category' ? <span className="records1097-category"><Icon size={13} />{record.category}</span>
              : id === 'occurredAt' ? <time dateTime={record.occurredAt}>{recordDateTime(record.occurredAt, true)}</time>
              : <table.FlexRender cell={cell} />}
            </td>;
          })}
        </tr>)}
          {!rows.length && <tr><td colSpan={table.getVisibleLeafColumns().length}>
            <div className="records1097-empty" role="status">
              {loading ? <LoaderCircle size={25} className="records1097-loader" /> : <FileText size={25} />}
              <strong>{loading ? 'Carregando registros...' : error ? 'Não foi possível carregar os registros' : totalRecords === 0 ? 'Nenhum registro disponível' : 'Nenhum resultado encontrado'}</strong>
              <span>{loading ? 'Preparando a consulta autorizada.' : error ? 'Tente atualizar a consulta.' : totalRecords === 0 ? 'Os registros aparecerão aqui quando forem cadastrados.' : 'Ajuste os termos ou os filtros da consulta.'}</span>
              {hasFilters && !loading && onClearFilters && <button type="button" onClick={onClearFilters}>Limpar filtros</button>}
            </div>
          </td></tr>}
        </tbody>
      </table>
    </div>
    <div className="records1097-footer">
      <span role="status" aria-live="polite">Mostrando {start}–{end} de {data.length}</span>
      <div className="records1097-page-controls">
        <label>Por página<select aria-label="Registros por página" value={pagination.pageSize}
          onChange={event => setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}>
          {[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
        <span>Página {pagination.pageIndex + 1} de {pageCount}</span>
        <button type="button" aria-label="Página anterior" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft size={16} /></button>
        <button type="button" aria-label="Próxima página" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight size={16} /></button>
      </div>
    </div>
  </section>;
}
export default RecordsTable1097;
