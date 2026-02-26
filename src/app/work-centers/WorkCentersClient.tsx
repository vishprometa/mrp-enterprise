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
  { key: 'Code', label: 'Code' },
  { key: 'Description', label: 'Description' },
  { key: 'Department', label: 'Department', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Capacity Per Hour', label: 'Cap/Hr', render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Cost Per Hour', label: 'Cost/Hr', render: (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '\u2014' },
  { key: 'Efficiency Pct', label: 'Efficiency %', render: (v: any) => v != null ? `${v}%` : '\u2014' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Shift Pattern', label: 'Shift', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Department', label: 'Department', type: 'select' as const, options: ['Machining', 'Assembly', 'Welding', 'Painting', 'Packaging', 'Testing'] },
  { name: 'Capacity Per Hour', label: 'Capacity Per Hour', type: 'number' as const },
  { name: 'Cost Per Hour', label: 'Cost Per Hour', type: 'number' as const },
  { name: 'Efficiency Pct', label: 'Efficiency Pct', type: 'number' as const },
  { name: 'Setup Time Mins', label: 'Setup Time Mins', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'Under Maintenance'] },
  { name: 'Shift Pattern', label: 'Shift Pattern', type: 'select' as const, options: ['Single', 'Double', 'Triple', 'Continuous'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function WorkCentersClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let active = 0;
    let totalEfficiency = 0;
    let efficiencyCount = 0;
    let totalCapacity = 0;
    for (const r of data) {
      const s = Array.isArray(r.Status) ? r.Status[0] : r.Status;
      if (s === 'Active') active++;
      const eff = Number(r['Efficiency Pct'] ?? 0);
      if (eff > 0) { totalEfficiency += eff; efficiencyCount++; }
      totalCapacity += Number(r['Capacity Per Hour'] ?? 0);
    }
    return {
      total: data.length,
      active,
      avgEfficiency: efficiencyCount > 0 ? (totalEfficiency / efficiencyCount).toFixed(1) : '0',
      totalCapacity,
    };
  }, [data]);

  // ── Chart: Efficiency by Work Center (horizontal) ──
  const efficiencyChart = useMemo(() => {
    return data
      .filter((r) => Number(r['Efficiency Pct'] ?? 0) > 0)
      .map((r) => ({
        name: String(r.Code || 'Unknown').length > 16 ? String(r.Code).slice(0, 14) + '..' : String(r.Code || 'Unknown'),
        efficiency: Number(r['Efficiency Pct'] ?? 0),
      }))
      .sort((a, b) => b.efficiency - a.efficiency)
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
    await createRecord(TABLES.WORK_CENTERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.WORK_CENTERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.WORK_CENTERS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Centers</h1>
          <p className="page-subtitle">Production work center management &mdash; capacity and efficiency tracking</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Work Center
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Work Centers</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.active}</div>
          <div className="label">Active</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>{stats.avgEfficiency}%</div>
          <div className="label">Avg Efficiency</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#06b6d4' }}>{stats.totalCapacity.toLocaleString()}</div>
          <div className="label">Total Capacity/Hr</div>
        </div>
      </div>

      {/* ── Chart: Efficiency by Work Center (horizontal bar) ── */}
      {efficiencyChart.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Efficiency by Work Center</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, efficiencyChart.length * 36 + 40)}>
            <BarChart data={efficiencyChart} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [`${value}%`, 'Efficiency']} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="efficiency" name="Efficiency %" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {efficiencyChart.map((_, idx) => (
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
            All Work Centers <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search work centers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No work centers found</div>
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
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Work Center">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Work Center">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Work Center Details">
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
