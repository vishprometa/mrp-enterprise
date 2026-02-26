'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
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
  { key: 'Code', label: 'Code' },
  { key: 'Description', label: 'Description' },
  { key: 'Department', label: 'Department' },
  { key: 'Budget', label: 'Budget', render: (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '\u2014' },
  { key: 'Actual Cost', label: 'Actual Cost', render: (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '\u2014' },
  { key: 'Variance', label: 'Variance', render: (v: any) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    const color = n > 0 ? '#10b981' : n < 0 ? '#ef4444' : 'var(--text)';
    return <span style={{ color, fontWeight: 600 }}>{n > 0 ? '+' : ''}{`$${n.toLocaleString()}`}</span>;
  }},
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Department', label: 'Department', type: 'text' as const },
  { name: 'Budget', label: 'Budget', type: 'number' as const },
  { name: 'Actual Cost', label: 'Actual Cost', type: 'number' as const },
  { name: 'Variance', label: 'Variance', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'Under Review'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function CostCentersClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let active = 0;
    let totalBudget = 0;
    let totalVariance = 0;
    for (const r of data) {
      const s = Array.isArray(r.Status) ? r.Status[0] : r.Status;
      if (s === 'Active') active++;
      totalBudget += Number(r.Budget ?? 0);
      totalVariance += Number(r.Variance ?? 0);
    }
    return { total: data.length, active, totalBudget, totalVariance };
  }, [data]);

  // ── Chart: Budget vs Actual (grouped bar) ──
  const budgetChart = useMemo(() => {
    return data
      .filter((r) => Number(r.Budget ?? 0) > 0 || Number(r['Actual Cost'] ?? 0) > 0)
      .map((r) => ({
        name: String(r.Code || r.Department || 'Unknown').length > 12 ? String(r.Code || r.Department).slice(0, 10) + '..' : String(r.Code || r.Department || 'Unknown'),
        budget: Number(r.Budget ?? 0),
        actual: Number(r['Actual Cost'] ?? 0),
      }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 10);
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
    await createRecord(TABLES.COST_CENTERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.COST_CENTERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.COST_CENTERS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cost Centers</h1>
          <p className="page-subtitle">Budget tracking &mdash; monitor spend against budget allocation</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Cost Center
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Cost Centers</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.active}</div>
          <div className="label">Active</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>${stats.totalBudget.toLocaleString()}</div>
          <div className="label">Total Budget</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: stats.totalVariance >= 0 ? '#10b981' : '#ef4444' }}>
            {stats.totalVariance >= 0 ? '+' : ''}${stats.totalVariance.toLocaleString()}
          </div>
          <div className="label">Total Variance</div>
        </div>
      </div>

      {/* ── Chart: Budget vs Actual ────────────── */}
      {budgetChart.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Budget vs Actual by Cost Center</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={budgetChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={55} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any, name: any) => [`$${Number(value).toLocaleString()}`, name]} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Legend verticalAlign="top" iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
              <Bar dataKey="budget" name="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="actual" name="Actual" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Cost Centers <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search cost centers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No cost centers found</div>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Cost Center">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Cost Center">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Cost Center Details">
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
