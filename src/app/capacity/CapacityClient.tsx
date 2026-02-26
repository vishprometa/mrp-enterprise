'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

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
  { key: 'Plan Date', label: 'Plan Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Period Start', label: 'Period Start', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Period End', label: 'Period End', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Planned Hours', label: 'Planned Hrs', render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Available Hours', label: 'Avail Hrs', render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Utilization Pct', label: 'Util %', render: (v: any) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    const color = n >= 90 ? '#ef4444' : n >= 75 ? '#f59e0b' : '#10b981';
    return <span style={{ color, fontWeight: 600 }}>{n}%</span>;
  }},
  { key: 'Overtime Hours', label: 'OT Hrs', render: (v: any) => v != null && Number(v) > 0 ? <span style={{ color: '#f97316', fontWeight: 600 }}>{Number(v).toLocaleString()}</span> : '\u2014' },
];

const formFields = [
  { name: 'Plan Date', label: 'Plan Date', type: 'date' as const, required: true },
  { name: 'Period Start', label: 'Period Start', type: 'date' as const, required: true },
  { name: 'Period End', label: 'Period End', type: 'date' as const, required: true },
  { name: 'Planned Hours', label: 'Planned Hours', type: 'number' as const },
  { name: 'Available Hours', label: 'Available Hours', type: 'number' as const },
  { name: 'Utilization Pct', label: 'Utilization Pct', type: 'number' as const },
  { name: 'Overtime Hours', label: 'Overtime Hours', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function CapacityClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let totalUtil = 0;
    let utilCount = 0;
    let totalOT = 0;
    let above90 = 0;
    for (const r of data) {
      const u = Number(r['Utilization Pct'] ?? 0);
      if (u > 0) { totalUtil += u; utilCount++; }
      if (u >= 90) above90++;
      totalOT += Number(r['Overtime Hours'] ?? 0);
    }
    return {
      total: data.length,
      avgUtil: utilCount > 0 ? (totalUtil / utilCount).toFixed(1) : '0',
      totalOT,
      above90,
    };
  }, [data]);

  // ── Chart: Utilization trend over time ─────
  const utilChart = useMemo(() => {
    return [...data]
      .filter((r) => r['Plan Date'] && Number(r['Utilization Pct'] ?? 0) > 0)
      .sort((a, b) => new Date(a['Plan Date']).getTime() - new Date(b['Plan Date']).getTime())
      .map((r) => ({
        date: new Date(r['Plan Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        utilization: Number(r['Utilization Pct'] ?? 0),
      }))
      .slice(-20);
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
    await createRecord(TABLES.CAPACITY_PLANS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.CAPACITY_PLANS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.CAPACITY_PLANS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Capacity Plans</h1>
          <p className="page-subtitle">Capacity planning &mdash; utilization and overtime monitoring</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Plan
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Plans</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.avgUtil}%</div>
          <div className="label">Avg Utilization</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f97316' }}>{stats.totalOT.toLocaleString()}</div>
          <div className="label">Total Overtime Hrs</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: stats.above90 > 0 ? '#ef4444' : '#06b6d4' }}>{stats.above90}</div>
          <div className="label">Plans Above 90%</div>
        </div>
      </div>

      {/* ── Chart: Utilization Trend ──────────── */}
      {utilChart.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Utilization Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={utilChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={[0, 100]} unit="%" />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [`${value}%`, 'Utilization']} />
              <Area type="monotone" dataKey="utilization" stroke="#6366f1" strokeWidth={2} fill="url(#utilGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Capacity Plans <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search plans..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No capacity plans found</div>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Capacity Plan">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Capacity Plan">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Capacity Plan Details">
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
