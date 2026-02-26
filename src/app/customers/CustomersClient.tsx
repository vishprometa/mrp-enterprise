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
  { key: 'Code', label: 'Code' },
  { key: 'Contact Person', label: 'Contact Person' },
  { key: 'Email', label: 'Email' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Country', label: 'Country' },
  { key: 'Payment Terms', label: 'Payment Terms' },
  { key: 'Credit Limit', label: 'Credit Limit', render: (v: any) => v != null ? `$${Number(v).toLocaleString()}` : '\u2014' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Contact Person', label: 'Contact Person', type: 'text' as const, required: true },
  { name: 'Email', label: 'Email', type: 'text' as const },
  { name: 'Phone', label: 'Phone', type: 'text' as const },
  { name: 'Address', label: 'Address', type: 'textarea' as const },
  { name: 'City', label: 'City', type: 'text' as const },
  { name: 'Country', label: 'Country', type: 'text' as const },
  { name: 'Payment Terms', label: 'Payment Terms', type: 'select' as const, options: ['Net 30', 'Net 45', 'Net 60', 'Immediate'] },
  { name: 'Credit Limit', label: 'Credit Limit', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'VIP', 'Suspended'] },
  { name: 'Tax ID', label: 'Tax ID', type: 'text' as const },
  { name: 'Currency', label: 'Currency', type: 'select' as const, options: ['USD', 'EUR', 'GBP', 'JPY'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function CustomersClient({ data: initialData }: { data: Record<string, any>[] }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    let active = 0;
    let totalCredit = 0;
    const countries = new Set<string>();
    for (const r of data) {
      const status = Array.isArray(r.Status) ? r.Status[0] : r.Status;
      if (status === 'Active' || status === 'VIP') active++;
      totalCredit += Number(r['Credit Limit'] ?? 0);
      if (r.Country) countries.add(String(r.Country));
    }
    return { total: data.length, active, totalCredit, countries: countries.size };
  }, [data]);

  // ── Chart: Payment Terms distribution ──────
  const paymentTermsData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of data) {
      const pt = Array.isArray(r['Payment Terms']) ? r['Payment Terms'][0] : String(r['Payment Terms'] ?? 'Unknown');
      if (pt && pt !== 'undefined' && pt !== 'null') {
        counts[pt] = (counts[pt] || 0) + 1;
      }
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
    await createRecord(TABLES.CUSTOMERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.CUSTOMERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.CUSTOMERS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  return (
    <div>
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Customer management &mdash; track relationships and credit</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Customer
        </button>
      </div>

      {/* ── Stats Row ────────────────────────── */}
      <div className="stat-row">
        <div className="stat-mini">
          <div className="value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="label">Total Customers</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#10b981' }}>{stats.active}</div>
          <div className="label">Active</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#f59e0b' }}>${stats.totalCredit.toLocaleString()}</div>
          <div className="label">Total Credit Limit</div>
        </div>
        <div className="stat-mini">
          <div className="value" style={{ color: '#06b6d4' }}>{stats.countries}</div>
          <div className="label">Countries</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────── */}
      {paymentTermsData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Payment Terms Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentTermsData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                {paymentTermsData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [value, 'Customers']} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Search + Table ────────────────────── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Customers <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div className="search-bar">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 260 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No customers found</div>
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

      {/* ── Create Modal ─────────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Customer">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      {/* ── Edit Modal ───────────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Customer">
        {selected && (
          <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />
        )}
      </Modal>

      {/* ── View Modal ───────────────────────── */}
      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Customer Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <div className="detail-field-label">{key}</div>
                  <div className="detail-field-value">{val == null || val === '' ? '\u2014' : typeof val === 'boolean' ? <StatusBadge value={val ? 'Active' : 'Inactive'} /> : String(val)}</div>
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
