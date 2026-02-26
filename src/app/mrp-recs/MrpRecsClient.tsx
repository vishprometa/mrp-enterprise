'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
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
  { key: 'Type', label: 'Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Recommended Date', label: 'Recommended Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Quantity', label: 'Quantity', render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Priority', label: 'Priority', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Reason', label: 'Reason' },
];

const formFields = [
  { name: 'Type', label: 'Type', type: 'select' as const, options: ['Purchase', 'Production', 'Transfer', 'Cancel'] },
  { name: 'Recommended Date', label: 'Recommended Date', type: 'date' as const, required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['Low', 'Medium', 'High', 'Critical'] },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'Approved', 'Executed', 'Rejected'] },
  { name: 'Reason', label: 'Reason', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function MrpRecsClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let purchaseCount = 0;
    let productionCount = 0;
    let critical = 0;
    let pending = 0;
    for (const r of data) {
      const t = Array.isArray(r.Type) ? r.Type[0] : r.Type;
      if (t === 'Purchase') purchaseCount++;
      else if (t === 'Production') productionCount++;
      const p = Array.isArray(r.Priority) ? r.Priority[0] : r.Priority;
      if (p === 'Critical') critical++;
      const s = Array.isArray(r.Status) ? r.Status[0] : r.Status;
      if (s === 'Pending') pending++;
    }
    return {
      total: data.length,
      purchaseVsProduction: `${purchaseCount} / ${productionCount}`,
      critical,
      pending,
    };
  }, [data]);

  // ── Chart: by Type ─────────────────────────
  const typeChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of data) {
      const t = Array.isArray(r.Type) ? r.Type[0] : String(r.Type ?? 'Unknown');
      if (t && t !== 'undefined') counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  // ── Chart: by Priority ─────────────────────
  const priorityChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of data) {
      const p = Array.isArray(r.Priority) ? r.Priority[0] : String(r.Priority ?? 'Unknown');
      if (p && p !== 'undefined') counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
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
    await createRecord(TABLES.MRP_RECOMMENDATIONS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.MRP_RECOMMENDATIONS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.MRP_RECOMMENDATIONS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">MRP Recommendations</h1>
          <p className="page-subtitle">Action items from MRP runs &mdash; purchase, production, and transfer recommendations</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Recommendation
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Recommendations</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981', fontSize: 18 }}>{stats.purchaseVsProduction}</div>
          <div className="label">Purchase / Production</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: stats.critical > 0 ? '#ef4444' : '#06b6d4' }}>{stats.critical}</div>
          <div className="label">Critical</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
          <div className="label">Pending</div>
        </div>
      </div>

      {/* ── Charts: Type + Priority ───────────── */}
      {(typeChart.length > 0 || priorityChart.length > 0) && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {typeChart.length > 0 && (
            <div className="chart-card">
              <h3>Recommendations by Type</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={typeChart} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                    {typeChart.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Recommendations']} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {priorityChart.length > 0 && (
            <div className="chart-card">
              <h3>Recommendations by Priority</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={priorityChart} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                    {priorityChart.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[(idx + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Recommendations']} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Recommendations <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search recommendations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No recommendations found</div>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Recommendation">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Recommendation">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Recommendation Details">
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
