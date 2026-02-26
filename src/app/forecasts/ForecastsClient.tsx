'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const PAGE_SIZE = 25;

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

const columns: Column[] = [
  { key: 'Forecast Date', label: 'Forecast Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Period', label: 'Period', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Quantity', label: 'Quantity', render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Confidence Pct', label: 'Confidence %', render: (v: any) => v != null ? `${v}%` : '\u2014' },
  { key: 'Method', label: 'Method', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Forecast Date', label: 'Forecast Date', type: 'date' as const, required: true },
  { name: 'Period', label: 'Period', type: 'select' as const, options: ['Weekly', 'Monthly', 'Quarterly', 'Annual'] },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Confidence Pct', label: 'Confidence Pct', type: 'number' as const },
  { name: 'Method', label: 'Method', type: 'select' as const, options: ['Moving Average', 'Exponential Smoothing', 'Regression', 'Manual', 'AI-Based'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ForecastsClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let totalConfidence = 0;
    let confCount = 0;
    const periods = new Set<string>();
    const methods = new Set<string>();
    for (const r of data) {
      const c = Number(r['Confidence Pct'] ?? 0);
      if (c > 0) { totalConfidence += c; confCount++; }
      const p = Array.isArray(r.Period) ? r.Period[0] : r.Period;
      if (p) periods.add(String(p));
      const m = Array.isArray(r.Method) ? r.Method[0] : r.Method;
      if (m) methods.add(String(m));
    }
    return {
      total: data.length,
      avgConfidence: confCount > 0 ? (totalConfidence / confCount).toFixed(1) : '0',
      periods: periods.size,
      methods: methods.size,
    };
  }, [data]);

  // ── Chart: Avg Forecast Qty by Period ──────
  const periodChart = useMemo(() => {
    const periodTotals: Record<string, { qty: number; count: number }> = {};
    for (const r of data) {
      const p = Array.isArray(r.Period) ? r.Period[0] : String(r.Period ?? 'Unknown');
      if (!p || p === 'undefined') continue;
      if (!periodTotals[p]) periodTotals[p] = { qty: 0, count: 0 };
      periodTotals[p].qty += Number(r.Quantity ?? 0);
      periodTotals[p].count += 1;
    }
    return Object.entries(periodTotals)
      .map(([name, { qty, count }]) => ({ name, avgQty: Math.round(qty / count) }))
      .sort((a, b) => b.avgQty - a.avgQty);
  }, [data]);

  // ── Filtered + paginated ───────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── CRUD handlers ──────────────────────────
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.DEMAND_FORECASTS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.DEMAND_FORECASTS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.DEMAND_FORECASTS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Demand Forecasts</h1>
          <p className="page-subtitle">Forecast management &mdash; demand prediction and planning</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Forecast
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Forecasts</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.avgConfidence}%</div>
          <div className="label">Avg Confidence</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>{stats.periods}</div>
          <div className="label">Periods</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#06b6d4' }}>{stats.methods}</div>
          <div className="label">Methods</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {periodChart.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Avg Forecast Qty by Period</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={periodChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [Number(value).toLocaleString(), 'Avg Quantity']} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="avgQty" name="Avg Quantity" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Forecasts <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search forecasts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No forecasts found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr key={row.id} onClick={() => { setSelected(row); setModalMode('view'); }} style={{ cursor: 'pointer' }}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '\u2014')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {/* ── Modals ────────────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Forecast">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Forecast">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Forecast Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <div className="detail-field-label">{key}</div>
                  <div className="detail-field-value">{val == null || val === '' ? '\u2014' : String(val)}</div>
                </div>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModalMode('edit')}>Edit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
