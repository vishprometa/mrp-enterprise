'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
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
  { key: 'Run Date', label: 'Run Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Planning Horizon Days', label: 'Horizon (Days)' },
  { key: 'Include Safety Stock', label: 'Safety Stock', render: (v: any) => v ? <span className="badge badge-active">Yes</span> : <span className="badge badge-inactive">No</span> },
  { key: 'Include Forecasts', label: 'Forecasts', render: (v: any) => v ? <span className="badge badge-active">Yes</span> : <span className="badge badge-inactive">No</span> },
  { key: 'Total Recommendations', label: 'Recommendations', render: (v: any) => v != null ? <span style={{ fontWeight: 600 }}>{Number(v).toLocaleString()}</span> : '\u2014' },
];

const formFields = [
  { name: 'Run Date', label: 'Run Date', type: 'date' as const, required: true },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Planned', 'Running', 'Completed', 'Failed'] },
  { name: 'Planning Horizon Days', label: 'Planning Horizon Days', type: 'number' as const },
  { name: 'Include Safety Stock', label: 'Include Safety Stock', type: 'checkbox' as const },
  { name: 'Include Forecasts', label: 'Include Forecasts', type: 'checkbox' as const },
  { name: 'Total Recommendations', label: 'Total Recommendations', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function MrpRunsClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let completed = 0;
    let totalRecs = 0;
    let recCount = 0;
    let safetyStockCount = 0;
    for (const r of data) {
      const s = Array.isArray(r.Status) ? r.Status[0] : r.Status;
      if (s === 'Completed') completed++;
      const recs = Number(r['Total Recommendations'] ?? 0);
      if (recs > 0) { totalRecs += recs; recCount++; }
      if (r['Include Safety Stock']) safetyStockCount++;
    }
    return {
      total: data.length,
      completed,
      avgRecs: recCount > 0 ? Math.round(totalRecs / recCount) : 0,
      safetyStockPct: data.length > 0 ? ((safetyStockCount / data.length) * 100).toFixed(0) : '0',
    };
  }, [data]);

  // ── Chart: Recommendations per Run ─────────
  const recsChart = useMemo(() => {
    return [...data]
      .filter((r) => r['Run Date'] && Number(r['Total Recommendations'] ?? 0) > 0)
      .sort((a, b) => new Date(a['Run Date']).getTime() - new Date(b['Run Date']).getTime())
      .slice(-15)
      .map((r) => ({
        date: new Date(r['Run Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        recs: Number(r['Total Recommendations'] ?? 0),
      }));
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
    await createRecord(TABLES.MRP_RUNS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.MRP_RUNS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.MRP_RUNS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">MRP Runs</h1>
          <p className="page-subtitle">Material requirements planning &mdash; run history and outcomes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Run
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Runs</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.completed}</div>
          <div className="label">Completed</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>{stats.avgRecs}</div>
          <div className="label">Avg Recommendations</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#06b6d4' }}>{stats.safetyStockPct}%</div>
          <div className="label">Include Safety Stock</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {recsChart.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Recommendations per Run</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={recsChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [Number(value).toLocaleString(), 'Recommendations']} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="recs" name="Recommendations" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {recsChart.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All MRP Runs <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search runs..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No MRP runs found</div>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New MRP Run">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit MRP Run">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="MRP Run Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <div className="detail-field-label">{key}</div>
                  <div className="detail-field-value">{val == null || val === '' ? '\u2014' : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}</div>
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
