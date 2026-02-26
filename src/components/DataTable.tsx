'use client';

import { useState } from 'react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearch?: (q: string) => void;
  onRowClick?: (row: any) => void;
  loading?: boolean;
  title: string;
  actions?: React.ReactNode;
}

export function DataTable({ columns, data, totalCount, page, pageSize, onPageChange, onSearch, onRowClick, loading, title, actions }: DataTableProps) {
  const [search, setSearch] = useState('');
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{totalCount} records</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onSearch && (
            <form onSubmit={(e) => { e.preventDefault(); onSearch(search); }} style={{ display: 'flex', gap: 4 }}>
              <input className="input" style={{ width: 220 }} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="btn btn-secondary btn-sm" type="submit">Search</button>
            </form>
          )}
          {actions}
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No records found</td></tr>
              ) : data.map((row, i) => (
                <tr key={row.id || i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : undefined }}>
                  {columns.map((col) => (
                    <td key={col.key}>{col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
          <span style={{ padding: '4px 12px', fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
